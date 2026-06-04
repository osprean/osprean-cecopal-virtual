// Pre-ingiere el PLATERMU empaquetado al primer arranque. Idempotente: si
// el documento ya está indexado con el modelo de embeddings actual, no
// vuelve a procesarlo.
//
// Se llama una sola vez al abrir el drawer del Centro Operativo IA. Es
// asíncrono: si todavía no ha terminado cuando el operador hace su primera
// pregunta, la tool `rag_query` devolverá `empty-index` y el LLM avisará.

import platermuRaw from "../knowledge/platermu.md?raw";
import { getDoc } from "./vectorStore";
import { ingestMarkdown } from "./ragService";

export const PLATERMU_DOC_ID = "platermu-el-alamo";
const PLATERMU_TITLE = "PLATERMU El Álamo — Plan Territorial Municipal de Protección Civil";

let seedingPromise: Promise<void> | null = null;

export const seedPlatermuIfNeeded = (): Promise<void> => {
  if (seedingPromise) return seedingPromise;
  seedingPromise = (async () => {
    const existing = await getDoc(PLATERMU_DOC_ID);
    if (existing) return; // ya ingerido con el modelo actual
    await ingestMarkdown({
      docId: PLATERMU_DOC_ID,
      title: PLATERMU_TITLE,
      source: platermuRaw,
    });
  })();
  // Si falla, permitir reintento en la siguiente apertura.
  seedingPromise.catch(() => {
    seedingPromise = null;
  });
  return seedingPromise;
};
