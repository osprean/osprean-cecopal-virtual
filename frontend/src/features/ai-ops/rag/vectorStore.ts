// Vector store en IndexedDB. Sustituye pgvector/Chroma/Weaviate por una
// solución que funciona en navegador sin backend.
//
// Tradeoffs aceptados para el MVP:
//   - No hay índices ANN. La búsqueda es exhaustiva (cosine sobre todos los
//     vectores). Para un Plan Municipal (<5.000 chunks) es trivial: <50 ms
//     con 384 dims. Si en el futuro el corpus crece, hay que sustituirlo.
//   - Los embeddings se guardan como Float32Array (transferidos como ArrayBuffer
//     a IndexedDB). Mucho más ligero que JSON.
//   - El store está versionado por el ID de modelo: si se cambia el modelo
//     de embeddings, los vectores antiguos se purgan (no son comparables).
//
// API pública mínima: upsertChunks, listDocs, deleteDoc, search.

import { openDB, type IDBPDatabase } from "idb";
import type { IndexedChunk, RagChunk, RetrievalHit, IngestedDocSummary } from "./types";
import { cosine, EMBEDDING_DIM, EMBEDDING_MODEL } from "./embeddings";

const DB_NAME = "emergency-manager-rag";
const DB_VERSION = 1;
const CHUNK_STORE = "chunks";
const DOC_STORE = "documents";

interface StoredDoc {
  docId: string;
  title: string;
  source: "embedded" | "uploaded";
  chunkCount: number;
  indexedAt: number;
  embeddingModel: string;
  embeddingDim: number;
}

interface StoredChunk extends Omit<IndexedChunk, "embedding"> {
  // En IndexedDB guardamos el ArrayBuffer; en runtime lo envolvemos en
  // Float32Array sin copiar.
  embedding: ArrayBuffer;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
const getDb = (): Promise<IDBPDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: "key" });
        store.createIndex("byDoc", "docId", { unique: false });
      }
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: "docId" });
      }
    },
  });
  return dbPromise;
};

// Clave compuesta `${docId}::${chunkId}` para garantizar unicidad inter-doc.
const keyFor = (docId: string, chunkId: string) => `${docId}::${chunkId}`;

export const upsertChunks = async (
  docId: string,
  title: string,
  source: "embedded" | "uploaded",
  chunks: RagChunk[],
  embeddings: Float32Array[],
): Promise<void> => {
  if (chunks.length !== embeddings.length) {
    throw new Error("upsertChunks: chunks y embeddings con tamaños distintos");
  }
  const db = await getDb();
  const tx = db.transaction([CHUNK_STORE, DOC_STORE], "readwrite");
  // Limpia chunks anteriores del mismo doc para evitar duplicados.
  const idx = tx.objectStore(CHUNK_STORE).index("byDoc");
  let cur = await idx.openCursor(IDBKeyRange.only(docId));
  while (cur) {
    cur.delete();
    cur = await cur.continue();
  }
  // Inserta los nuevos.
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const e = embeddings[i];
    if (e.length !== EMBEDDING_DIM) {
      throw new Error(
        `embedding dim ${e.length} != ${EMBEDDING_DIM} (chunk ${c.id})`,
      );
    }
    // Copia explícita a un ArrayBuffer "puro" — Float32Array.buffer puede
    // ser SharedArrayBuffer dependiendo del lib.dom de TS, y IndexedDB
    // serializa ArrayBuffer. Copiar es barato (384 floats = 1.5 KB).
    const copy = new ArrayBuffer(e.byteLength);
    new Float32Array(copy).set(e);
    const stored: StoredChunk & { key: string } = {
      ...c,
      key: keyFor(docId, c.id),
      embedding: copy,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDim: EMBEDDING_DIM,
      indexedAt: Date.now(),
    };
    await tx.objectStore(CHUNK_STORE).put(stored);
  }
  // Metadata del documento.
  const meta: StoredDoc = {
    docId,
    title,
    source,
    chunkCount: chunks.length,
    indexedAt: Date.now(),
    embeddingModel: EMBEDDING_MODEL,
    embeddingDim: EMBEDDING_DIM,
  };
  await tx.objectStore(DOC_STORE).put(meta);
  await tx.done;
};

export const listDocs = async (): Promise<IngestedDocSummary[]> => {
  const db = await getDb();
  const all = (await db.getAll(DOC_STORE)) as StoredDoc[];
  return all
    .filter((d) => d.embeddingModel === EMBEDDING_MODEL && d.embeddingDim === EMBEDDING_DIM)
    .map((d) => ({
      docId: d.docId,
      title: d.title,
      chunkCount: d.chunkCount,
      indexedAt: d.indexedAt,
      source: d.source,
    }));
};

export const getDoc = async (docId: string): Promise<IngestedDocSummary | null> => {
  const db = await getDb();
  const d = (await db.get(DOC_STORE, docId)) as StoredDoc | undefined;
  if (!d) return null;
  return {
    docId: d.docId,
    title: d.title,
    chunkCount: d.chunkCount,
    indexedAt: d.indexedAt,
    source: d.source,
  };
};

export const deleteDoc = async (docId: string): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction([CHUNK_STORE, DOC_STORE], "readwrite");
  const idx = tx.objectStore(CHUNK_STORE).index("byDoc");
  let cur = await idx.openCursor(IDBKeyRange.only(docId));
  while (cur) {
    cur.delete();
    cur = await cur.continue();
  }
  await tx.objectStore(DOC_STORE).delete(docId);
  await tx.done;
};

// Búsqueda exhaustiva por cosine. Devuelve los top-k hits con score.
// `docIds` filtra opcionalmente por documentos (útil si se quiere consultar
// solo el Plan principal y no PDFs adicionales).
export const search = async (
  queryEmbedding: Float32Array,
  k: number,
  docIds?: string[],
): Promise<RetrievalHit[]> => {
  const db = await getDb();
  const tx = db.transaction(CHUNK_STORE, "readonly");
  const store = tx.objectStore(CHUNK_STORE);
  const filter = docIds && docIds.length > 0 ? new Set(docIds) : null;

  // Min-heap simple basado en array — para k pequeño (k<=10) es óptimo
  // mantenerlo así sin estructuras extra.
  const top: { score: number; chunk: RagChunk }[] = [];
  let minIdx = -1;
  let minScore = Infinity;

  let cur = await store.openCursor();
  while (cur) {
    const raw = cur.value as StoredChunk;
    if (
      raw.embeddingModel !== EMBEDDING_MODEL ||
      raw.embeddingDim !== EMBEDDING_DIM
    ) {
      cur = await cur.continue();
      continue;
    }
    if (filter && !filter.has(raw.docId)) {
      cur = await cur.continue();
      continue;
    }
    const v = new Float32Array(raw.embedding);
    const s = cosine(queryEmbedding, v);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding: _e, ...metaOnly } = raw;
    const chunk: RagChunk = {
      id: metaOnly.id,
      docId: metaOnly.docId,
      docTitle: metaOnly.docTitle,
      title: metaOnly.title,
      breadcrumb: metaOnly.breadcrumb,
      tipo: metaOnly.tipo,
      pagina: metaOnly.pagina,
      pageStart: metaOnly.pageStart,
      pageEnd: metaOnly.pageEnd,
      text: metaOnly.text,
      tokens: metaOnly.tokens,
    };
    if (top.length < k) {
      top.push({ score: s, chunk });
      if (s < minScore) {
        minScore = s;
        minIdx = top.length - 1;
      }
      if (top.length === k) {
        // Recalcular el min al cerrar el buffer.
        minIdx = 0;
        minScore = top[0].score;
        for (let i = 1; i < top.length; i++) {
          if (top[i].score < minScore) {
            minScore = top[i].score;
            minIdx = i;
          }
        }
      }
    } else if (s > minScore) {
      top[minIdx] = { score: s, chunk };
      // Recalcular min.
      minIdx = 0;
      minScore = top[0].score;
      for (let i = 1; i < top.length; i++) {
        if (top[i].score < minScore) {
          minScore = top[i].score;
          minIdx = i;
        }
      }
    }
    cur = await cur.continue();
  }
  await tx.done;
  return top.sort((a, b) => b.score - a.score);
};

// Conteo total de chunks indexados (todos los docs).
export const countAllChunks = async (): Promise<number> => {
  const db = await getDb();
  return db.count(CHUNK_STORE);
};

// Purga total (debug / reseed manual).
export const purgeAll = async (): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction([CHUNK_STORE, DOC_STORE], "readwrite");
  await tx.objectStore(CHUNK_STORE).clear();
  await tx.objectStore(DOC_STORE).clear();
  await tx.done;
};
