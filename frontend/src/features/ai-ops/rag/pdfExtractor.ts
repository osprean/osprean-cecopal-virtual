// Extractor de bloques desde un PDF, usando pdfjs-dist en el navegador.
//
// La fidelidad del retrieval depende casi por completo de este paso: si las
// tablas se rompen aquí, el chunker no puede repararlas y el LLM acabará
// citando filas/columnas mezcladas. El objetivo es:
//   1. Agrupar los `items` que devuelve pdfjs en líneas (misma fila Y).
//   2. Detectar tablas comparando posiciones X de columnas entre líneas
//      consecutivas: si dos o más líneas comparten el patrón de gaps,
//      asumimos que son filas de la misma tabla.
//   3. Detectar headings por tamaño de fuente: ítems con altura claramente
//      superior a la mediana de la página.
//   4. Detectar listas: líneas que empiezan por "·", "-", "•" o numeración.
//
// No hacemos OCR ni inferimos contenido fuera del flujo de texto. Si el PDF
// es un escaneo (sin capa de texto) el extractor devolverá bloques vacíos y
// el RAG service rechazará la ingesta con un mensaje claro.

import type { DocumentBlock, ExtractedDocument } from "./types";

// pdfjs requiere su worker. Vite resuelve el `?url` import a una URL servible.
// Usamos el build .mjs porque es el que distribuye pdfjs-dist@4.
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface RawLine {
  // Coordenadas de la línea (en unidades PDF, eje Y crece hacia arriba).
  y: number;
  // Items individuales con su posición X de inicio y texto.
  items: { x: number; width: number; text: string; height: number }[];
  // Tamaño de fuente medio de la línea (alto del transform en pdfjs).
  fontSize: number;
}

export interface PdfExtractOptions {
  docId: string;
  title: string;
  onPage?: (page: number, total: number) => void;
}

export const extractPdf = async (
  data: ArrayBuffer,
  opts: PdfExtractOptions,
): Promise<ExtractedDocument> => {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const blocks: DocumentBlock[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    opts.onPage?.(p, doc.numPages);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = groupItemsIntoLines(tc.items as TextItem[]);
    classifyLinesIntoBlocks(lines, p, blocks);
    page.cleanup();
  }

  await doc.cleanup();
  await doc.destroy();
  return { docId: opts.docId, title: opts.title, blocks };
};

// ───── 1. agrupar items en líneas por coordenada Y ─────

const groupItemsIntoLines = (items: TextItem[]): RawLine[] => {
  // Tolerancia para considerar dos items en la misma línea: usamos el alto
  // promedio del item como guía. Para fuentes estándar 10-12pt, ~3-4 puntos
  // es seguro.
  const Y_TOL = 2.5;
  const sorted = items
    .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
    .map((it) => {
      // it.transform = [scaleX, skewY, skewX, scaleY, x, y]
      const x = it.transform[4];
      const y = it.transform[5];
      const height = Math.abs(it.transform[3]) || it.height || 10;
      return { x, y, height, text: it.str, width: it.width ?? 0 };
    })
    // Orden descendente en Y para procesar de arriba abajo, y ascendente en X.
    .sort((a, b) => (b.y === a.y ? a.x - b.x : b.y - a.y));

  const lines: RawLine[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_TOL) {
      last.items.push({ x: it.x, width: it.width, text: it.text, height: it.height });
      // Promediamos para mantener Y y fontSize estables.
      last.y = (last.y + it.y) / 2;
      last.fontSize = (last.fontSize + it.height) / 2;
    } else {
      lines.push({
        y: it.y,
        fontSize: it.height,
        items: [{ x: it.x, width: it.width, text: it.text, height: it.height }],
      });
    }
  }
  // Reordenamos los items dentro de cada línea por X (lectura izda→dcha).
  for (const ln of lines) ln.items.sort((a, b) => a.x - b.x);
  return lines;
};

// ───── 2. clasificar líneas en bloques (heading/parr/tabla/lista) ─────

const classifyLinesIntoBlocks = (
  lines: RawLine[],
  page: number,
  out: DocumentBlock[],
) => {
  if (lines.length === 0) return;

  // Mediana de tamaño de fuente: línea de base para detectar headings.
  const sizes = [...lines.map((l) => l.fontSize)].sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 10;
  const headingThreshold = median * 1.18; // ~18% por encima

  // Recorremos las líneas y agrupamos las que comparten patrón de tabla.
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    const cols = detectColumnsCount(ln);

    // Detección de tabla: la línea actual y al menos la siguiente comparten
    // el mismo nº de columnas con posiciones X similares.
    if (cols >= 2 && i + 1 < lines.length) {
      const groupStart = i;
      const xs = ln.items.map((it) => it.x);
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        const nCols = detectColumnsCount(next);
        if (nCols < cols - 1) break; // demasiado cambio → fin de tabla
        if (!columnsAlign(xs, next.items.map((it) => it.x))) break;
        j++;
      }
      // Solo aceptamos como tabla si tenemos >=2 filas consecutivas.
      if (j - groupStart >= 2) {
        const tableLines = lines.slice(groupStart, j);
        const md = renderTableAsMarkdown(tableLines);
        out.push({ kind: "table", text: md, page });
        i = j;
        continue;
      }
    }

    // Heading: tamaño de fuente notable por encima del baseline y poco texto.
    const text = lineText(ln);
    if (ln.fontSize >= headingThreshold && text.length < 140) {
      const numMatch = /^(\d+(?:\.\d+)*)[\s.)-]+/.exec(text);
      const level = guessHeadingLevel(ln.fontSize, median);
      out.push({
        kind: "heading",
        text,
        page,
        level,
        number: numMatch?.[1],
      });
      i++;
      continue;
    }

    // Lista: bullets reconocibles.
    if (/^[\s]*(?:[•·●▪–-]|\d+[.)])\s+/.test(text)) {
      const items: string[] = [text];
      let j = i + 1;
      while (j < lines.length) {
        const t = lineText(lines[j]);
        if (!/^[\s]*(?:[•·●▪–-]|\d+[.)])\s+/.test(t)) break;
        items.push(t);
        j++;
      }
      out.push({ kind: "list", text: items.join("\n"), page });
      i = j;
      continue;
    }

    // Párrafo: acumulamos líneas seguidas con tamaño normal hasta hallar un
    // separador (heading, tabla, lista o salto grande de Y).
    const paraLines: string[] = [text];
    let j = i + 1;
    while (j < lines.length) {
      const nxt = lines[j];
      const t = lineText(nxt);
      if (!t) break;
      if (nxt.fontSize >= headingThreshold) break;
      if (/^[\s]*(?:[•·●▪–-]|\d+[.)])\s+/.test(t)) break;
      if (detectColumnsCount(nxt) >= 2 && j + 1 < lines.length) break;
      // Salto de línea grande → fin de párrafo.
      const dy = Math.abs(lines[j - 1].y - nxt.y);
      if (dy > median * 1.8) break;
      paraLines.push(t);
      j++;
    }
    out.push({ kind: "paragraph", text: paraLines.join(" "), page });
    i = j;
  }
};

const lineText = (ln: RawLine): string =>
  ln.items.map((it) => it.text).join(" ").replace(/\s+/g, " ").trim();

// Detecta "columnas" en una línea mediante gaps de espacio horizontal entre
// items consecutivos. Un gap se considera frontera de columna si supera
// ~2.5× el ancho medio de un caracter de la línea.
const detectColumnsCount = (ln: RawLine): number => {
  if (ln.items.length < 2) return 1;
  const charWidth =
    ln.items.reduce((sum, it) => sum + it.width / Math.max(1, it.text.length), 0) /
    ln.items.length;
  const gapThreshold = Math.max(8, charWidth * 2.5);
  let cols = 1;
  for (let k = 1; k < ln.items.length; k++) {
    const prev = ln.items[k - 1];
    const cur = ln.items[k];
    const gap = cur.x - (prev.x + prev.width);
    if (gap > gapThreshold) cols++;
  }
  return cols;
};

// Comprueba si los inicios de columna de una línea coinciden, aprox., con
// los de la "fila modelo" de la tabla en curso.
const columnsAlign = (model: number[], candidate: number[]): boolean => {
  if (candidate.length === 0) return false;
  const tol = 12;
  // Aceptamos si la mayoría de columnas del candidato encajan en alguna
  // posición del modelo.
  let matches = 0;
  for (const cx of candidate) {
    if (model.some((mx) => Math.abs(mx - cx) <= tol)) matches++;
  }
  return matches >= Math.min(model.length, candidate.length) - 1;
};

const guessHeadingLevel = (size: number, baseline: number): number => {
  const ratio = size / baseline;
  if (ratio >= 1.9) return 1;
  if (ratio >= 1.55) return 2;
  if (ratio >= 1.3) return 3;
  if (ratio >= 1.18) return 4;
  return 5;
};

// Render de tabla como markdown estructurado. Conservamos el orden de
// columnas detectado y separamos cabecera (primera fila) del resto. Si la
// primera fila no parece cabecera (números) igual la dejamos como tal —
// preferimos markdown válido a inferir.
const renderTableAsMarkdown = (lines: RawLine[]): string => {
  // Determinamos N columnas por la fila más rica.
  const cols = Math.max(...lines.map((l) => l.items.length));
  const rows: string[][] = lines.map((l) => {
    const cells = l.items.map((it) => it.text.trim());
    while (cells.length < cols) cells.push("");
    return cells.slice(0, cols);
  });
  const header = rows[0] ?? [];
  const sep = header.map(() => "---");
  const body = rows.slice(1);
  const toLine = (cells: string[]) =>
    `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
  return [toLine(header), toLine(sep), ...body.map(toLine)].join("\n");
};
