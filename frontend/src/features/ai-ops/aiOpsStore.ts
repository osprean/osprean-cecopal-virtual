import { create } from "zustand";
import type { ChatToolCall } from "../../services";

// Acciones de mapa ya ejecutadas por la IA. Quedan reflejadas en el chat con
// una ventana de "Deshacer" durante un tiempo corto: la acción se aplica al
// instante (auto-confirm) y el operador puede revertirla si se equivocó.
export type AppliedActionKind =
  | "close_street"
  | "create_perimeter"
  | "create_checkpoint"
  | "register_victim"
  | "add_zone"
  | "register_incident";

export interface AppliedUndoSet {
  closures?: string[];
  perimeters?: string[];
  accessControls?: string[];
  victims?: string[];
  sanitaryZones?: string[];
  incidents?: string[];
}

export interface AppliedAction {
  kind: AppliedActionKind;
  summary: string;          // "Cortada Calle Mayor"
  detail?: string;          // "Madrid Centro · Motivo: incendio"
  undo: AppliedUndoSet;     // ids creados durante la acción, para revertir
  appliedAt: string;        // ISO
  undone?: boolean;         // marcado cuando el operador deshace
}

export type ToolCallStatus = "applied" | "undone";

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: { ok: boolean; message: string };
  applied?: AppliedAction;
  status?: ToolCallStatus;
}

export interface OpsChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallRecord[];
  timestamp: string;
}

interface AiOpsState {
  open: boolean;
  busy: boolean;
  messages: OpsChatMessage[];
  error: string | null;

  setOpen: (v: boolean) => void;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  pushMessage: (msg: Omit<OpsChatMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, patch: Partial<OpsChatMessage>) => void;
  attachToolCalls: (id: string, calls: ChatToolCall[]) => void;
  setToolResult: (
    msgId: string,
    callId: string,
    result: { ok: boolean; message: string },
    applied?: AppliedAction,
  ) => void;
  updateToolCall: (
    msgId: string,
    callId: string,
    patch: Partial<ToolCallRecord>,
  ) => void;
  clear: () => void;
}

const newId = () =>
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const useAiOpsStore = create<AiOpsState>((set) => ({
  open: false,
  busy: false,
  messages: [],
  error: null,

  setOpen: (open) => set({ open }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),

  pushMessage: (msg) => {
    const id = newId();
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id, timestamp: new Date().toISOString() },
      ],
    }));
    return id;
  },

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  attachToolCalls: (id, calls) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              toolCalls: calls.map((c) => {
                let args: Record<string, unknown> = {};
                try {
                  args = JSON.parse(c.function.arguments || "{}");
                } catch {
                  /* ignore */
                }
                return { id: c.id, name: c.function.name, args };
              }),
            }
          : m,
      ),
    })),

  setToolResult: (msgId, callId, result, applied) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          toolCalls: m.toolCalls?.map((c) =>
            c.id === callId
              ? {
                  ...c,
                  result,
                  applied: applied ?? c.applied,
                  status: applied ? "applied" : c.status,
                }
              : c,
          ),
        };
      }),
    })),

  updateToolCall: (msgId, callId, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          toolCalls: m.toolCalls?.map((c) =>
            c.id === callId ? { ...c, ...patch } : c,
          ),
        };
      }),
    })),

  clear: () => set({ messages: [], error: null }),
}));
