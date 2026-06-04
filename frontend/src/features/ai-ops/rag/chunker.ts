// Chunker semántico para documentos extraídos.
//
// Reglas (no negociables):
//   1. Cada chunk tiene 300..800 tokens "ideal", 1200 absoluto. Si un bloque
//      individual ya supera 1200 (caso de tablas enormes) NO se corta:
//      preferimos un chunk grande a romper relaciones fila-columna.
//   2. Las tablas y las listas son indivisibles. Viajan como un único chunk
//      o, si exceden el límite, como su propio chunk independiente.
//   3. Se preserva contexto jerárquico: cada chunk anota su breadcrumb
//      (ruta de títulos), y el texto del chunk se prefija con esa ruta para
//      que el embedding capture el contexto sin depender de la metadata.
//   4. Un chunk no cruza secciones (heading nivel <= 2). Sí puede cruzar
//      subsecciones si quedan muy pequeñas, para no fragmentar en exceso.
//
// La estimación de tokens es heurística (≈ ceil(palabras × 1.3)). No
// pretendemos exactitud — solo respetar las ventanas; el LLM final paginará
// el contexto a su manera.

import type { DocumentBlock, ExtractedDocument, RagChunk } from "./types";

const TARGET_MIN = 300;
const TARGET_MAX = 800;
const HARD_MAX = 1200;

export const chunkDocument = (doc: ExtractedDocument): RagChunk[] => {
  const chunks: RagChunk[] = [];
  // Stack de headings activos para construir el breadcrumb. Cada entrada es
  // {level, text, number}. Al ver un heading nivel N, descartamos los
  // niveles >= N y empujamos el nuevo.
  const headingStack: { level: number; text: string; number?: string }[] = [];
  // Acumulador del chunk en curso.
  let buffer: DocumentBlock[] = [];
  let bufferTokens = 0;
  // Página de inicio del chunk en curso.
  let chunkStartPage = doc.blocks[0]?.page ?? 1;
  // ID secuencial por documento para chunks que no tengan number heading.
  let seq = 0;

  const breadcrumb = () => headingStack.map((h) => h.text);
  const currentSectionLevel = () =>
    headingStack.length > 0 ? headingStack[0].level : 99;

  const flush = (forceTipo?: RagChunk["tipo"]) => {
    if (buffer.length === 0) return;
    const text = renderChunkText(buffer, breadcrumb());
    const tipo: RagChunk["tipo"] =
      forceTipo ??
      (buffer.every((b) => b.kind === "table")
        ? "table"
        : buffer.every((b) => b.kind === "list")
          ? "list"
          : buffer.some((b) => b.kind === "table" || b.kind === "list")
            ? "mixed"
            : "text");
    const pageStart = chunkStartPage;
    const pageEnd = buffer[buffer.length - 1].page;
    // ID legible. Prioridad: numeración del heading actual. Si no hay,
    // usamos "p{N}-c{seq}".
    const numId =
      headingStack[headingStack.length - 1]?.number ??
      headingStack[0]?.number ??
      null;
    seq++;
    const id = numId ? `${numId}#${seq}` : `p${pageStart}-c${seq}`;
    const title =
      headingStack[headingStack.length - 1]?.text ??
      headingStack[0]?.text ??
      doc.title;
    chunks.push({
      id,
      docId: doc.docId,
      docTitle: doc.title,
      title,
      breadcrumb: breadcrumb(),
      tipo,
      pagina: pageStart,
      pageStart,
      pageEnd,
      text,
      tokens: bufferTokens,
    });
    buffer = [];
    bufferTokens = 0;
  };

  for (const block of doc.blocks) {
    if (block.kind === "heading") {
      // Cambio de sección de nivel 1 o 2 → cerramos el chunk en curso.
      const isMajorSection = (block.level ?? 6) <= 2;
      if (isMajorSection) flush();
      // Actualizamos la pila de headings.
      const lvl = block.level ?? 6;
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= lvl
      ) {
        headingStack.pop();
      }
      headingStack.push({ level: lvl, text: block.text, number: block.number });
      // Si dentro del chunk en curso ya hay contenido y el heading es de
      // nivel intermedio (>2), lo añadimos solo como contexto del breadcrumb;
      // no fuerza flush salvo que el chunk ya rebose.
      if (bufferTokens >= TARGET_MAX) flush();
      // Si el chunk arranca aquí, ajustamos pagina de inicio.
      if (buffer.length === 0) chunkStartPage = block.page;
      continue;
    }

    const blockTokens = estimateTokens(block.text);

    // Bloque atómico (tabla/lista) que excede el HARD_MAX por sí solo →
    // se emite como chunk independiente, sin fragmentar.
    const isAtomic = block.kind === "table" || block.kind === "list";
    if (isAtomic && blockTokens > TARGET_MAX) {
      flush();
      chunkStartPage = block.page;
      buffer = [block];
      bufferTokens = blockTokens;
      // Tablas grandes: se emite incluso si supera HARD_MAX. Prioridad: no
      // romper la tabla.
      flush(block.kind === "table" ? "table" : "list");
      continue;
    }

    // Si añadir este bloque rebasaría HARD_MAX y NO es atómico, flush antes.
    if (!isAtomic && bufferTokens + blockTokens > HARD_MAX && bufferTokens > 0) {
      flush();
      chunkStartPage = block.page;
    }
    // Si es atómico y al añadirlo se rebasa el TARGET_MAX, cerramos primero
    // (queremos que la tabla/lista viaje con su título, no a medias).
    if (isAtomic && bufferTokens + blockTokens > TARGET_MAX && bufferTokens > 0) {
      flush();
      chunkStartPage = block.page;
    }

    if (buffer.length === 0) chunkStartPage = block.page;
    buffer.push(block);
    bufferTokens += blockTokens;

    // Si llegamos a la ventana objetivo y el siguiente bloque podría
    // sobrepasarla, cerramos aquí para mantener chunks dentro de 300..800.
    if (bufferTokens >= TARGET_MAX) {
      flush();
    }
  }

  // Último chunk pendiente.
  if (bufferTokens > 0) {
    // Si quedó muy chico (< TARGET_MIN) e había chunks previos en la misma
    // sección, lo fusionamos con el anterior para no dejar chunks anémicos.
    if (bufferTokens < TARGET_MIN && chunks.length > 0) {
      const prev = chunks[chunks.length - 1];
      const sameSection = headingStack.length > 0 && prev.breadcrumb.length > 0 &&
        prev.breadcrumb[0] === headingStack[0]?.text;
      if (sameSection) {
        const merged = `${prev.text}\n\n${renderChunkText(buffer, breadcrumb())}`;
        prev.text = merged;
        prev.tokens += bufferTokens;
        prev.pageEnd = buffer[buffer.length - 1].page;
        buffer = [];
        bufferTokens = 0;
      }
    }
    flush();
  }

  // Anotamos el nivel de sección actual solo como side-effect de debug.
  void currentSectionLevel;
  return chunks;
};

// ───── helpers ─────

// Estimación rápida de tokens. No pretende ser exacta — solo guiar al
// chunker dentro de las ventanas. Empíricamente, en español, ~1.3 tokens
// por palabra para tokenizers BPE multilingües.
export const estimateTokens = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
};

// Renderiza el chunk con su breadcrumb al principio. El embedding lee este
// texto, así que conviene que la jerarquía sea explícita: una pregunta
// "¿quién activa el confinamiento?" se beneficia de ver "Operatividad >
// Fases > Situación 1" en el contexto.
const renderChunkText = (blocks: DocumentBlock[], breadcrumb: string[]): string => {
  const path = breadcrumb.length > 0 ? `[${breadcrumb.join(" > ")}]\n` : "";
  const body = blocks
    .map((b) => {
      if (b.kind === "heading") return `\n## ${b.text}\n`;
      if (b.kind === "table") return `\n${b.text}\n`;
      if (b.kind === "list") return `\n${b.text}\n`;
      return b.text;
    })
    .join("\n");
  return `${path}${body.trim()}`;
};
