import { create } from "zustand";
import type { RealtimeEvent } from "../types";
import { mockRealtimeEvents } from "../mocks";

const MAX_EVENTS = 200;

interface RealtimeState {
  events: RealtimeEvent[];
  streaming: boolean;
  pushEvent: (event: RealtimeEvent) => void;
  clear: () => void;
  setStreaming: (streaming: boolean) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  events: mockRealtimeEvents,
  streaming: true,
  pushEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_EVENTS),
    })),
  clear: () => set({ events: [] }),
  setStreaming: (streaming) => set({ streaming }),
}));
