// API pública del paquete RAG. El resto de la app NO debe importar
// archivos internos del paquete — solo a través de este index.
export {
  ragQuery,
  ingestMarkdown,
  ingestPdfFile,
  listIngestedDocs,
  deleteIngestedDoc,
  onIngestProgress,
  getIngestStatus,
  formatDecisionForLLM,
  formatHitForLLM,
  RAG_THRESHOLD,
  RAG_TOPK,
} from "./ragService";
export { seedPlatermuIfNeeded, PLATERMU_DOC_ID } from "./seedPlatermu";
export { warmEmbeddings, onEmbeddingProgress } from "./embeddings";
export type {
  RagChunk,
  RetrievalHit,
  RagDecision,
  IngestProgress,
  IngestedDocSummary,
} from "./types";
