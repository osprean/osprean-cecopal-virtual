// Extractor de bloques de un markdown. Pensado para el PLATERMU empaquetado
// y para cualquier `.md` que use el mismo convenio de secciones
// (`<!-- SECTION:clave -->`). Como no hay paginación real en un markdown,
// "página" se simula: cada marcador SECTION arranca una página nueva. Esto
// nos permite mantener la misma metadata que con un PDF y citar al operador
// "página 4" en su sección correspondiente.
//
// El parser es deliberadamente conservador: no normalizamos formato, no
// inferimos jerarquías ausentes. Si el markdown está mal estructurado,
// preferimos chunks "raros" antes que inventar contexto.

import type { DocumentBlock, ExtractedDocument } from "./types";

const SECTION_RE = /<!--\s*SECTION:([a-z0-9-]+)\s*-->/gi;

interface ParseOptions {
  docId: string;
  title: string;
}

export const extractMarkdown = (
  source: string,
  opts: ParseOptions,
): ExtractedDocument => {
  const blocks: DocumentBlock[] = [];
  // Recorremos el documento por "páginas" delimitadas por SECTION. La 0
  // contiene el preámbulo (título principal y nota introductoria).
  const segments: { start: number; end: number; sectionKey?: string }[] = [];
  const matches = [...source.matchAll(SECTION_RE)];
  if (matches.length === 0) {
    segments.push({ start: 0, end: source.length });
  } else {
    if ((matches[0].index ?? 0) > 0) {
      segments.push({ start: 0, end: matches[0].index ?? 0 });
    }
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? source.length : source.length;
      segments.push({ start, end, sectionKey: m[1] });
    }
  }

  segments.forEach((seg, idx) => {
    const page = idx + 1; // 1-indexed
    const text = source.slice(seg.start, seg.end);
    parseSegment(text, page, blocks);
  });

  return { docId: opts.docId, title: opts.title, blocks };
};

// ───── parsing por segmento ─────

const parseSegment = (segment: string, page: number, out: DocumentBlock[]) => {
  // Recorremos línea a línea acumulando bloques. Una tabla detectada se
  // emite como un único DocumentBlock (kind="table") con su markdown intacto
  // para que el chunker no la corte. Lo mismo para listas: las agregamos
  // contiguamente.
  const lines = segment.split(/\r?\n/);
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    if (text) out.push({ kind: "paragraph", text, page });
    para = [];
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      flushPara();
      i++;
      continue;
    }

    // Heading ATX (#, ##, ### …)
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      const level = heading[1].length;
      const titleText = heading[2].trim();
      const numMatch = /^(\d+(?:\.\d+)*)[\s.)-]+/.exec(titleText);
      out.push({
        kind: "heading",
        text: titleText,
        page,
        level,
        number: numMatch?.[1],
      });
      i++;
      continue;
    }

    // Tabla markdown: línea con `|` seguida de separador `|---|`
    if (line.includes("|") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^\|?\s*:?-{2,}/.test(next)) {
        flushPara();
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().includes("|")) {
          tableLines.push(lines[i].trimEnd());
          i++;
        }
        out.push({ kind: "table", text: tableLines.join("\n"), page });
        continue;
      }
    }

    // Lista (- * + o numerada). Agrupamos items contiguos en un solo bloque
    // para que el chunker decida si fragmentarlos. Una lista corta debería
    // viajar entera con su contexto.
    if (/^(?:[-*+]|\d+[.)])\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^(?:[-*+]|\d+[.)])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim());
        i++;
        // Permitimos líneas vacías dentro de listas pequeñas.
        if (i < lines.length && lines[i].trim() === "") {
          // mira si la siguiente sigue siendo lista
          if (i + 1 < lines.length && /^(?:[-*+]|\d+[.)])\s+/.test(lines[i + 1].trim())) {
            i++;
            continue;
          }
          break;
        }
      }
      out.push({ kind: "list", text: items.join("\n"), page });
      continue;
    }

    // Texto normal: acumular en párrafo (varias líneas seguidas).
    para.push(line);
    i++;
  }
  flushPara();
};
