// Orquestador del pipeline RAG: ingest, query, status.
//
// Es la única superficie de uso fuera del paquete `rag/`. El resto de la app
// (la tool `rag_query`, la UI de upload, el seeder de PLATERMU) llama aquí.
//
// Reglas operativas:
//   - Score híbrido = 0.7 * cosine + 0.3 * keyword-overlap. El boost por
//     coincidencia literal de términos (teléfonos, nombres propios,
//     "CECOPAL", "Naturgy", "Calle X") sube la recall sobre documentación
//     técnica con jerga estable. Sin este boost, el coseno solo se pierde
//     citas evidentes.
//   - El threshold sobre el score híbrido por debajo del cual NO se
//     responde: 0.35. Es ~equivalente al 0.45 anterior sobre coseno puro,
//     pero ahora un chunk con keyword strong puede pasar aunque su coseno
//     sea más bajo. Sigue siendo conservador para no inducir alucinaciones.
//   - Top-K por defecto: 8 chunks (antes 5). Preguntas amplias como "qué
//     grupos de acción hay" o "fases de emergencia" necesitan más contexto.
//     La candidate pool se amplía a 4*topK antes del rerank para que el
//     keyword boost pueda rescatar chunks que el coseno hundió.
//   - Si el índice está vacío, query devuelve `empty-index` y la tool debe
//     informar de "no hay Plan cargado". Esto puede pasar antes de que el
//     seed termine de embeber al primer arranque.

import { chunkDocument } from "./chunker";
import { embed, embedBatch } from "./embeddings";
import { extractMarkdown } from "./markdownExtractor";
import { extractPdf } from "./pdfExtractor";
import {
  countAllChunks,
  deleteDoc as storeDeleteDoc,
  listDocs as storeListDocs,
  search as storeSearch,
  upsertChunks,
} from "./vectorStore";
import type {
  ExtractedDocument,
  IngestProgress,
  IngestedDocSummary,
  RagDecision,
  RetrievalHit,
} from "./types";

export const RAG_THRESHOLD = 0.35;
export const RAG_TOPK = 8;
// Peso del coseno frente a la coincidencia literal de términos en el
// reranking híbrido. 0.7/0.3 favorece la semántica pero deja que un buen
// match literal (teléfono, calle, nombre propio) rescate chunks.
const RAG_COSINE_WEIGHT = 0.7;
const RAG_KEYWORD_WEIGHT = 0.3;
// Candidatos a recuperar antes del rerank. Más amplio que topK para que el
// boost por keyword pueda promover chunks que el coseno solo descartó.
const RAG_CANDIDATE_FACTOR = 4;

type ProgressListener = (p: IngestProgress) => void;
const listeners: ProgressListener[] = [];
let current: IngestProgress = { phase: "idle", progress: 0, message: "Inactivo." };

const emit = (p: IngestProgress) => {
  current = p;
  for (const l of listeners) l(p);
};

export const onIngestProgress = (cb: ProgressListener): (() => void) => {
  listeners.push(cb);
  cb(current); // emite estado actual al subscribir
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
};

export const getIngestStatus = (): IngestProgress => current;

// ───── ingesta común ─────

const ingestExtracted = async (
  doc: ExtractedDocument,
  source: "embedded" | "uploaded",
): Promise<{ chunkCount: number }> => {
  if (doc.blocks.length === 0) {
    throw new Error(
      "El documento no contiene texto extraíble. Si es un PDF escaneado, " +
        "necesita OCR previo (no soportado en MVP).",
    );
  }
  emit({
    phase: "chunking",
    docId: doc.docId,
    docTitle: doc.title,
    progress: 0,
    message: "Fragmentando documento…",
  });
  const chunks = chunkDocument(doc);
  if (chunks.length === 0) {
    throw new Error("Tras chunking no quedaron fragmentos válidos.");
  }

  emit({
    phase: "embedding",
    docId: doc.docId,
    docTitle: doc.title,
    progress: 0,
    message: `Generando embeddings (${chunks.length} fragmentos)…`,
  });
  const vectors = await embedBatch(
    chunks.map((c) => c.text),
    "passage",
    (done, total) => {
      emit({
        phase: "embedding",
        docId: doc.docId,
        docTitle: doc.title,
        progress: done / total,
        message: `Embedding ${done}/${total}…`,
      });
    },
  );

  emit({
    phase: "indexing",
    docId: doc.docId,
    docTitle: doc.title,
    progress: 0.95,
    message: "Indexando en almacén local…",
  });
  await upsertChunks(doc.docId, doc.title, source, chunks, vectors);

  emit({
    phase: "done",
    docId: doc.docId,
    docTitle: doc.title,
    progress: 1,
    message: `Listo. ${chunks.length} fragmentos indexados.`,
  });
  return { chunkCount: chunks.length };
};

// ───── ingesta de markdown empaquetado ─────

export interface IngestMarkdownOptions {
  docId: string;
  title: string;
  source: string; // el cuerpo markdown
}

export const ingestMarkdown = async (
  opts: IngestMarkdownOptions,
): Promise<{ chunkCount: number }> => {
  emit({
    phase: "extracting",
    docId: opts.docId,
    docTitle: opts.title,
    progress: 0,
    message: "Leyendo documento…",
  });
  try {
    const doc = extractMarkdown(opts.source, { docId: opts.docId, title: opts.title });
    return await ingestExtracted(doc, "embedded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit({
      phase: "error",
      docId: opts.docId,
      docTitle: opts.title,
      progress: 0,
      message: "Error en ingesta.",
      error: msg,
    });
    throw e;
  }
};

// ───── ingesta de PDF subido por el usuario ─────

export const ingestPdfFile = async (file: File): Promise<{ chunkCount: number }> => {
  const buf = await file.arrayBuffer();
  // ID estable: nombre + tamaño + 4 chars del hash de los primeros bytes.
  const sig = await shortFingerprint(buf);
  const docId = `pdf-${slug(file.name)}-${sig}`;
  const title = stripExt(file.name);

  emit({
    phase: "extracting",
    docId,
    docTitle: title,
    progress: 0,
    message: "Extrayendo texto del PDF…",
  });
  try {
    const doc = await extractPdf(buf, {
      docId,
      title,
      onPage: (page, total) =>
        emit({
          phase: "extracting",
          docId,
          docTitle: title,
          progress: page / total,
          message: `Extrayendo página ${page}/${total}…`,
        }),
    });
    return await ingestExtracted(doc, "uploaded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit({
      phase: "error",
      docId,
      docTitle: title,
      progress: 0,
      message: "Error en ingesta del PDF.",
      error: msg,
    });
    throw e;
  }
};

// ───── retrieval ─────

export interface QueryOptions {
  topK?: number;
  threshold?: number;
  docIds?: string[];
}

export const ragQuery = async (
  question: string,
  opts: QueryOptions = {},
): Promise<RagDecision> => {
  const total = await countAllChunks();
  if (total === 0) {
    return { ok: false, reason: "empty-index" };
  }
  const q = question.trim();
  if (!q) return { ok: false, reason: "no-hits" };

  const k = opts.topK ?? RAG_TOPK;
  const threshold = opts.threshold ?? RAG_THRESHOLD;
  const queryVec = await embed(q, "query");

  // Pool ancho: recuperamos más candidatos de los necesarios para que el
  // rerank híbrido pueda promover hits con coincidencia literal fuerte que
  // el coseno solo habría descartado.
  const candidateK = Math.max(k * RAG_CANDIDATE_FACTOR, 20);
  const candidates = await storeSearch(queryVec, candidateK, opts.docIds);

  if (candidates.length === 0) {
    return { ok: false, reason: "no-hits" };
  }

  // Rerank híbrido: combinamos coseno con boost por solapamiento literal
  // de términos clave de la consulta. Imprescindible en este documento
  // (teléfonos, calles, "CECOPAL", "Naturgy GLP", numeración del Plan).
  const queryTokens = extractQueryTokens(q);
  const reranked: RetrievalHit[] = candidates.map((h) => {
    const keywordScore = computeKeywordScore(queryTokens, h.chunk.text);
    const hybrid =
      RAG_COSINE_WEIGHT * h.score + RAG_KEYWORD_WEIGHT * keywordScore;
    return { ...h, score: hybrid };
  });
  reranked.sort((a, b) => b.score - a.score);

  const usable = reranked.filter((h) => h.score >= threshold).slice(0, k);
  if (usable.length === 0) {
    return { ok: false, reason: "below-threshold", best: reranked[0] };
  }
  return { ok: true, hits: usable };
};

// ───── tokenización y scoring keyword (rerank híbrido) ─────

// Stopwords mínimas en español. Sólo las que aparecen muchísimo y aportan
// cero señal. NO incluimos tecnicismos cortos (GLP, 112, PMA, PRL…).
const STOPWORDS = new Set([
  "que", "como", "para", "una", "uno", "del", "las", "los", "con", "por",
  "este", "esta", "estos", "estas", "the", "and", "or", "of", "in", "is",
  "are", "be", "qué", "cuál", "cuáles", "cómo", "cuándo", "dónde", "quién",
  "donde", "cuando", "quien", "ser", "esta", "están", "hay", "hace",
  "tiene", "tienen", "puede", "pueden", "más", "menos", "muy", "todo",
  "toda", "todos", "todas", "sus", "sin",
]);

const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Tokens útiles para keyword overlap. Conservamos:
//   - palabras alfanuméricas de ≥3 chars (no stopword)
//   - cualquier número de ≥2 dígitos (códigos postales, teléfonos parciales)
//   - acrónimos en mayúsculas del texto original (CECOPAL, GLP, SEVESO)
const extractQueryTokens = (q: string): Set<string> => {
  const tokens = new Set<string>();
  // Acrónimos en mayúsculas (preservar antes de normalizar a minúsculas).
  for (const m of q.matchAll(/\b[A-Z]{2,}\b/g)) {
    tokens.add(stripDiacritics(m[0].toLowerCase()));
  }
  const normalized = stripDiacritics(q.toLowerCase());
  for (const m of normalized.matchAll(/[a-z0-9]+/g)) {
    const t = m[0];
    if (t.length >= 3 && !STOPWORDS.has(t)) tokens.add(t);
    else if (/^\d{2,}$/.test(t)) tokens.add(t);
  }
  return tokens;
};

// Devuelve el ratio [0,1] de tokens de la consulta que aparecen en el
// chunk. Cobertura, no frecuencia: una sola coincidencia ya cuenta. El
// objetivo es premiar chunks que tocan los términos exactos pedidos, no
// los que repiten una palabra cien veces.
const computeKeywordScore = (queryTokens: Set<string>, chunkText: string): number => {
  if (queryTokens.size === 0) return 0;
  const text = stripDiacritics(chunkText.toLowerCase());
  let hits = 0;
  for (const t of queryTokens) {
    if (text.includes(t)) hits++;
  }
  return hits / queryTokens.size;
};

// ───── catalogo y mantenimiento ─────

export const listIngestedDocs = (): Promise<IngestedDocSummary[]> => storeListDocs();
export const deleteIngestedDoc = (docId: string): Promise<void> => storeDeleteDoc(docId);

// ───── helpers ─────

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const shortFingerprint = async (buf: ArrayBuffer): Promise<string> => {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-1", buf.slice(0, 8192));
    const view = new Uint8Array(hash);
    return Array.from(view.slice(0, 4))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback determinístico simple. No criptográfico, solo para evitar
  // colisiones triviales entre PDFs subidos con el mismo nombre.
  const view = new Uint8Array(buf, 0, Math.min(64, buf.byteLength));
  let h = 0;
  for (let i = 0; i < view.length; i++) h = (h * 31 + view[i]) | 0;
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8);
};

// Formatea un hit para que el LLM cite con metadata clara.
export const formatHitForLLM = (hit: RetrievalHit): string => {
  const c = hit.chunk;
  const path = c.breadcrumb.length > 0 ? c.breadcrumb.join(" > ") : c.title;
  const pageRef = c.pageStart === c.pageEnd ? `página ${c.pagina}` : `páginas ${c.pageStart}-${c.pageEnd}`;
  return (
    `--- FRAGMENTO ---\n` +
    `chunk_id: ${c.id}\n` +
    `documento: ${c.docTitle}\n` +
    `seccion: ${path}\n` +
    `${pageRef}\n` +
    `tipo: ${c.tipo}\n` +
    `score: ${hit.score.toFixed(3)}\n\n` +
    `${c.text}\n` +
    `--- /FRAGMENTO ---`
  );
};

// Formatea una decisión completa como bloque listo para inyectar al LLM.
export const formatDecisionForLLM = (decision: RagDecision): string => {
  if (decision.ok === true) {
    const blocks = decision.hits.map((h) => formatHitForLLM(h)).join("\n\n");
    return `RAG_STATUS=ok\nFragmentos recuperados (${decision.hits.length}):\n\n${blocks}`;
  }
  if (decision.reason === "empty-index") {
    return `RAG_STATUS=empty\nNo hay ningún Plan Municipal indexado en el almacén local. Pide al operador que cargue el documento antes de responder.`;
  }
  if (decision.reason === "below-threshold") {
    const bestScore = decision.best ? decision.best.score.toFixed(3) : "n/a";
    return (
      `RAG_STATUS=below-threshold\n` +
      `score máximo encontrado: ${bestScore} (umbral: ${RAG_THRESHOLD}).\n` +
      `Ningún fragmento del Plan cubre la consulta con confianza suficiente. ` +
      `Responde literalmente: "La información no está disponible en el Plan Municipal proporcionado."`
    );
  }
  return (
    `RAG_STATUS=no-hits\n` +
    `No hay coincidencias en el Plan para esta consulta. ` +
    `Responde literalmente: "La información no está disponible en el Plan Municipal proporcionado."`
  );
};
