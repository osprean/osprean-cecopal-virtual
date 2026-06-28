// P5: store de tareas operativas. Carga del backend al entrar al CECOVI y
// expone aceptar/completar/cancelar con persistencia + reload optimista.

import { create } from "zustand";
import { cecoviApi, type Tarea } from "../services/cecoviApi";

interface TareasState {
  loading: boolean;
  error: string | null;
  items: Tarea[];
  cargar: (slug: string) => Promise<void>;
  aceptar: (slug: string, id: number) => Promise<void>;
  completar: (slug: string, id: number) => Promise<void>;
  cancelar: (slug: string, id: number) => Promise<void>;
}

export const useTareasStore = create<TareasState>((set, get) => ({
  loading: false,
  error: null,
  items: [],

  cargar: async (slug) => {
    set({ loading: true, error: null });
    try {
      const items = await cecoviApi.tareas.list(slug);
      set({ items, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Error cargando tareas" });
    }
  },

  aceptar: async (slug, id) => {
    const updated = await cecoviApi.tareas.aceptar(slug, id);
    set({ items: get().items.map((t) => (t.id === id ? updated : t)) });
  },

  completar: async (slug, id) => {
    const updated = await cecoviApi.tareas.completar(slug, id);
    set({ items: get().items.map((t) => (t.id === id ? updated : t)) });
  },

  cancelar: async (slug, id) => {
    const updated = await cecoviApi.tareas.cancelar(slug, id);
    set({ items: get().items.map((t) => (t.id === id ? updated : t)) });
  },
}));
