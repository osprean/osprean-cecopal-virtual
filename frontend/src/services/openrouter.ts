// Thin OpenRouter client. Frontend-only by design — the API key lives in
// VITE_OPENROUTER_API_KEY and is therefore visible to anyone inspecting the
// browser. Acceptable for a demo; rotate the key before any public deploy.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
const model =
  (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) ??
  "anthropic/claude-3.5-haiku";

export const isOpenRouterConfigured = () => Boolean(apiKey);

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required";
  signal?: AbortSignal;
}

export interface ChatResponse {
  content: string | null;
  tool_calls?: ChatToolCall[];
  finish_reason?: string;
}

export const chatComplete = async (
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> => {
  const res = await chatCompleteRaw(messages, opts);
  return res.content ?? "";
};

export const chatCompleteRaw = async (
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResponse> => {
  if (!apiKey) {
    throw new Error("OpenRouter API key no configurada (VITE_OPENROUTER_API_KEY).");
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1000,
  };
  if (opts.topP != null) body.top_p = opts.topP;
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? "auto";
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "Emergency Manager",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: ChatToolCall[] };
      finish_reason?: string;
    }>;
  };
  const choice = json.choices?.[0];
  if (!choice?.message) throw new Error("Respuesta vacía de OpenRouter.");
  return {
    content: choice.message.content ?? null,
    tool_calls: choice.message.tool_calls,
    finish_reason: choice.finish_reason,
  };
};
