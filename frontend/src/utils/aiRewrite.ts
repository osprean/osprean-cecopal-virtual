// Reescribe el cuerpo de un comunicado oficial usando el LLM configurado en
// OpenRouter (VITE_OPENROUTER_API_KEY). Si el cliente no está configurado o la
// llamada falla, cae a una reescritura heurística local para no bloquear al
// usuario.

import { chatComplete, isOpenRouterConfigured } from "../services/openrouter";

const POLITE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bhola\b/gi, "Estimadas autoridades y ciudadanía"],
  [/\bbuenas\b/gi, "Buenas tardes"],
  [/\bgracias\b/gi, "Agradecemos su atención"],
  [/\bporfa\b/gi, "se ruega"],
  [/\bxfa\b/gi, "se ruega"],
  [/\bporfi\b/gi, "se ruega"],
  [/\bya\b/gi, "de inmediato"],
  [/\bpronto\b/gi, "a la mayor brevedad posible"],
  [/\bcuidado\b/gi, "se recomienda extremar la precaución"],
  [/\bpeligro\b/gi, "situación de riesgo elevado"],
  [/\bproblema\b/gi, "incidencia"],
  [/\baviso\b/gi, "comunicación oficial"],
  [/\bgente\b/gi, "población"],
];

const HEADER = "COMUNICADO OFICIAL · PROTECCIÓN CIVIL";
const FOOTER =
  "Se solicita a la población mantener la calma, seguir las indicaciones de las autoridades competentes y consultar exclusivamente fuentes oficiales para evitar la difusión de información no contrastada.";

const stripFiller = (s: string): string =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s*([,.;:!?])\s*/g, "$1 ")
    .replace(/!{2,}/g, ".")
    .replace(/\?{2,}/g, "?")
    .trim();

const ensureSentenceCase = (text: string): string =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" ");

export interface AiRewriteOptions {
  audience?: "population" | "press" | "authorities" | "internal";
  priority?: "critical" | "high" | "medium" | "low";
}

const PRIORITY_PREFIX: Record<NonNullable<AiRewriteOptions["priority"]>, string> = {
  critical: "[PRIORIDAD CRÍTICA]",
  high: "[PRIORIDAD ALTA]",
  medium: "[PRIORIDAD MEDIA]",
  low: "[INFORMATIVO]",
};

const AUDIENCE_OPENER: Record<NonNullable<AiRewriteOptions["audience"]>, string> = {
  population: "Se informa a la población que",
  press: "Se traslada a los medios de comunicación que",
  authorities: "Se comunica a las autoridades competentes que",
  internal: "Se notifica al personal interno que",
};

const AUDIENCE_LABEL: Record<NonNullable<AiRewriteOptions["audience"]>, string> = {
  population: "ciudadanía / población general",
  press: "medios de comunicación / prensa",
  authorities: "autoridades competentes",
  internal: "personal interno de emergencias",
};

const PRIORITY_LABEL: Record<NonNullable<AiRewriteOptions["priority"]>, string> = {
  critical: "crítica",
  high: "alta",
  medium: "media",
  low: "baja / informativa",
};

const buildSystemPrompt = (
  audience: NonNullable<AiRewriteOptions["audience"]>,
  priority: NonNullable<AiRewriteOptions["priority"]>,
): string => `Eres un redactor oficial de comunicados de Protección Civil en España.
Tu tarea es reescribir el borrador del usuario para que sea claro, formal, sereno y operativo, manteniendo TODOS los hechos sin inventar datos.

REGLAS ESTRICTAS:
- No añadas información que no esté en el borrador original (ni cifras, ni nombres, ni horas, ni ubicaciones nuevas).
- No uses lenguaje alarmista ni sensacionalista.
- Voz pasiva impersonal o tercera persona; nada de "nosotros" / "yo".
- Castellano peninsular, registro institucional, vocabulario propio de PLATERMU / INFOMA.
- Audiencia objetivo: ${AUDIENCE_LABEL[audience]}.
- Prioridad: ${PRIORITY_LABEL[priority]}.
- Estructura obligatoria del resultado (en este orden, sin Markdown, sin viñetas, sin comillas envolventes):
  1. Línea 1: "${HEADER}"
  2. Línea 2: "${PRIORITY_PREFIX[priority]}"
  3. Línea 3: vacía
  4. Cuerpo reescrito (1–3 párrafos cortos, frases directas).
  5. Línea final vacía + cierre estándar: "${FOOTER}"
- Devuelve SOLO el comunicado final reescrito, sin explicaciones, sin etiquetas, sin "Aquí tienes:".`;

const localRewrite = (
  body: string,
  audience: NonNullable<AiRewriteOptions["audience"]>,
  priority: NonNullable<AiRewriteOptions["priority"]>,
): string => {
  let text = body.trim();
  if (!text) return text;

  for (const [pat, rep] of POLITE_REPLACEMENTS) {
    text = text.replace(pat, rep);
  }
  text = stripFiller(text);
  text = ensureSentenceCase(text);
  if (!/[.!?]$/.test(text)) text = text + ".";

  const opener = AUDIENCE_OPENER[audience];
  const lower = text.toLowerCase();
  if (!/^se (informa|traslada|comunica|notifica)/i.test(lower)) {
    text = `${opener} ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  return [HEADER, PRIORITY_PREFIX[priority], "", text, "", FOOTER].join("\n");
};

const stripWrappingFences = (s: string): string =>
  s
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

export const aiRewriteCommunique = async (
  body: string,
  opts: AiRewriteOptions = {},
): Promise<string> => {
  const audience = opts.audience ?? "population";
  const priority = opts.priority ?? "high";
  const trimmed = body.trim();
  if (!trimmed) return trimmed;

  if (!isOpenRouterConfigured()) {
    // Pequeña latencia para que la UI pueda mostrar el estado de carga.
    await new Promise((r) => setTimeout(r, 250));
    return localRewrite(trimmed, audience, priority);
  }

  try {
    const content = await chatComplete(
      [
        { role: "system", content: buildSystemPrompt(audience, priority) },
        {
          role: "user",
          content: `Borrador a reescribir:\n\n${trimmed}`,
        },
      ],
      { temperature: 0.3, maxTokens: 700 },
    );
    const cleaned = stripWrappingFences(content).trim();
    if (!cleaned) {
      return localRewrite(trimmed, audience, priority);
    }
    return cleaned;
  } catch (err) {
    console.warn("[aiRewrite] OpenRouter falló, usando fallback local:", err);
    return localRewrite(trimmed, audience, priority);
  }
};
