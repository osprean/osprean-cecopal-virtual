// Adaptador de embeddings basado en @xenova/transformers (WASM/ONNX en el
// navegador). Modelo elegido: `Xenova/multilingual-e5-small` (384 dims).
//
// Razonamiento del modelo:
//   - Multilingüe (entrenado en 100+ idiomas) → el PLATERMU está en español
//     técnico con tecnicismos jurídicos; un modelo solo-inglés perdería
//     señal en términos como "CECOPAL", "confinamiento", "PLATERCAM".
//   - Tamaño pequeño (~120 MB en bytes ONNX) → carga viable en navegador
//     con caché del browser. Modelos "base" (~440 MB) son inviables para
//     primer uso.
//   - El prefijo "query:" / "passage:" del E5 es importante: la similitud
//     mejora notablemente si distingues documento vs consulta.
//
// El pipeline es un singleton: el modelo solo se carga una vez por sesión,
// y el primer arranque tarda 5-20 s la primera vez (descarga + warm-up) —
// después la caché del browser lo deja en <2 s.

import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

// Por defecto, transformers.js intenta cargar modelos locales primero, lo
// que falla en navegador. Forzamos el CDN público de HuggingFace (mismo que
// usa por defecto la lib, pero lo dejamos explícito).
env.allowLocalModels = false;
// La caché en IndexedDB es lo que hace viable la segunda carga.
env.useBrowserCache = true;

const MODEL_ID = "Xenova/multilingual-e5-small";
export const EMBEDDING_MODEL = MODEL_ID;
export const EMBEDDING_DIM = 384;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
let progressListeners: ((p: { ratio: number; status: string }) => void)[] = [];

export const onEmbeddingProgress = (
  cb: (p: { ratio: number; status: string }) => void,
) => {
  progressListeners.push(cb);
  return () => {
    progressListeners = progressListeners.filter((l) => l !== cb);
  };
};

const ensurePipeline = (): Promise<FeatureExtractionPipeline> => {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = pipeline("feature-extraction", MODEL_ID, {
    quantized: true,
    progress_callback: (p: { status: string; progress?: number; loaded?: number; total?: number }) => {
      // Empuja eventos de progreso a la UI: descarga del modelo, ready, etc.
      const ratio =
        p.progress != null
          ? p.progress / 100
          : p.loaded && p.total
            ? p.loaded / p.total
            : 0;
      for (const l of progressListeners) l({ ratio, status: p.status });
    },
  }) as Promise<FeatureExtractionPipeline>;
  return pipelinePromise;
};

// Precalienta el pipeline sin embeber nada — útil al abrir el drawer para
// que el primer query no espere a la descarga.
export const warmEmbeddings = async (): Promise<void> => {
  await ensurePipeline();
};

// Genera un embedding normalizado (L2) para que el dot product = cosine.
// `kind` controla el prefijo que el modelo E5 espera: "passage" para chunks
// indexados, "query" para consultas en runtime.
export const embed = async (
  text: string,
  kind: "passage" | "query",
): Promise<Float32Array> => {
  const pipe = await ensurePipeline();
  const prefix = kind === "query" ? "query: " : "passage: ";
  const result = await pipe(prefix + text, { pooling: "mean", normalize: true });
  // result.data es Float32Array de longitud = dim.
  return new Float32Array(result.data as Float32Array);
};

// Versión en batch: secuencial pero con yield al event loop entre items
// para no congelar la UI durante la ingesta. Si el navegador soporta web
// workers para transformers.js, sería ideal moverlo, pero para MVP la
// ingesta de un Plan ocurre una sola vez y es aceptable bloquear ~30 s.
export const embedBatch = async (
  texts: string[],
  kind: "passage" | "query",
  onProgress?: (done: number, total: number) => void,
): Promise<Float32Array[]> => {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embed(texts[i], kind));
    onProgress?.(i + 1, texts.length);
    // Cede el hilo cada 4 chunks para que la UI repinte.
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
};

// Similitud coseno asumiendo vectores ya normalizados (dot product).
export const cosine = (a: Float32Array, b: Float32Array): number => {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
};
