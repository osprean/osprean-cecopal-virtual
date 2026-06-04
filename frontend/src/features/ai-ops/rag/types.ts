// Tipos del pipeline RAG document-grounded.
//
// El sistema fuerza una cadena estricta: bloque crudo extraído del documento →
// chunk con metadata jerárquica → vector indexado en IndexedDB → resultado de
// retrieval con score y referencia citable. Si en cualquier paso se pierde la
// trazabilidad documento/página/sección, la cita al operador no es fiable y
// hay que rechazar la respuesta. Por eso todos los tipos llevan los campos
// mínimos para reconstruir "de qué documento, qué página y qué sección sale
// esto" en cualquier momento.

// ───── ingesta ─────

// Bloque crudo tras parsear el documento, antes de chunkar. Mantiene
// orientación a página y un tipo grueso para que el chunker decida si puede
// cortar o no (las tablas y los protocolos no se cortan).
export type BlockKind = "heading" | "paragraph" | "table" | "list" | "caption";

export interface DocumentBlock {
  kind: BlockKind;
  // Texto literal del bloque. Para tablas: markdown ya formateado con
  // separadores `| col | col |`. Para listas: cada item en una línea.
  text: string;
  // Página 1-indexada donde aparece el bloque en el documento original.
  page: number;
  // Nivel de heading (1..6) cuando kind === "heading". Para el resto, undef.
  level?: number;
  // Numeración detectada al inicio del heading (p.ej. "4.2.1"). Permite
  // construir IDs de chunk legibles ("4.2.1") sin depender de slugs.
  number?: string;
}

// Resultado mínimo de un extractor (pdf, markdown, …). Lleva la lista de
// bloques en orden de aparición y un título global del documento.
export interface ExtractedDocument {
  title: string;
  blocks: DocumentBlock[];
  // Identificador estable del documento. Para el plan empaquetado es
  // "platermu-el-alamo"; para PDFs subidos se deriva de nombre+hash corto.
  docId: string;
}

// ───── chunks ─────

export type ChunkKind = "text" | "table" | "list" | "mixed";

export interface ChunkMetadata {
  // ID local del chunk dentro del documento. Ej: "4.2.1" o "p7-c2".
  id: string;
  // Documento al que pertenece (clave de la colección).
  docId: string;
  // Título del documento — se replica para que el LLM pueda citarlo sin
  // necesidad de hacer un join contra la lista de documentos.
  docTitle: string;
  // Título humano de la sección (más cercano hacia arriba en la jerarquía).
  title: string;
  // Ruta jerárquica de títulos ("Riesgos > Inundaciones > Antecedentes").
  // Sirve para situar al LLM y al operador en el documento.
  breadcrumb: string[];
  // Tipo dominante del contenido del chunk.
  tipo: ChunkKind;
  // Página principal del chunk (la primera página donde empieza).
  pagina: number;
  // Rango de páginas si el chunk cruza páginas (ej. tabla larga).
  pageStart: number;
  pageEnd: number;
}

export interface RagChunk extends ChunkMetadata {
  // Texto literal del chunk tal y como se va a citar al LLM. Las tablas
  // van como markdown estructurado para preservar fila/columna.
  text: string;
  // Conteo aproximado de tokens (heurístico) — para depurar el chunker.
  tokens: number;
}

// Chunk con su embedding asociado. Es lo que se persiste en IndexedDB.
export interface IndexedChunk extends RagChunk {
  // Vector de embedding normalizado (cosine = dot product).
  embedding: Float32Array;
  // Modelo y dimensión, para invalidar el índice si se cambia el modelo.
  embeddingModel: string;
  embeddingDim: number;
  // Timestamp de indexación, útil para debug.
  indexedAt: number;
}

// ───── retrieval ─────

export interface RetrievalHit {
  chunk: RagChunk;
  // Cosine similarity, en [0, 1] aprox (con vectores normalizados).
  score: number;
}

export type RagDecision =
  // Hay contexto suficiente para responder.
  | { ok: true; hits: RetrievalHit[] }
  // No hay contexto suficiente. El LLM debe rechazar la respuesta.
  | { ok: false; reason: "no-hits" | "below-threshold" | "empty-index"; best?: RetrievalHit };

// ───── estado de ingesta ─────

export type IngestPhase =
  | "idle"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "done"
  | "error";

export interface IngestProgress {
  phase: IngestPhase;
  // Documento que se está procesando (si aplica).
  docId?: string;
  docTitle?: string;
  // 0..1 para barras de progreso (embeddings es la fase larga).
  progress: number;
  // Mensaje legible para la UI.
  message: string;
  // Si phase === "error".
  error?: string;
}

export interface IngestedDocSummary {
  docId: string;
  title: string;
  chunkCount: number;
  indexedAt: number;
  source: "embedded" | "uploaded";
}
