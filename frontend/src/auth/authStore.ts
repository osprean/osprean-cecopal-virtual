import { create } from "zustand";
import { cecoviApi, getAuthToken, setAuthToken, type Me } from "../services/cecoviApi";

interface AuthState {
  token: string | null;
  slug: string | null;
  me: Me | null;
  loading: boolean;
  error: string | null;
  login: (slug: string, credential: string) => Promise<void>;
  loadMe: (slug: string) => Promise<void>;
  seleccionarRoles: (slug: string, roles: string[]) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getAuthToken(),
  slug: null,
  me: null,
  loading: false,
  error: null,

  login: async (slug, credential) => {
    set({ loading: true, error: null });
    try {
      const res = await cecoviApi.login(slug, credential);
      setAuthToken(res.access_token);
      set({ token: res.access_token, slug });
      const me = await cecoviApi.me(slug);
      set({ me, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || "Credencial inválida" });
      throw e;
    }
  },

  loadMe: async (slug) => {
    set({ loading: true, error: null });
    try {
      const me = await cecoviApi.me(slug);
      set({ me, slug, loading: false });
    } catch (e: any) {
      // Token inválido/caducado o de otra emergencia → forzar re-login.
      setAuthToken(null);
      set({ token: null, me: null, loading: false, error: e?.message ?? null });
    }
  },

  seleccionarRoles: async (slug, roles) => {
    set({ loading: true, error: null });
    try {
      const me = await cecoviApi.seleccionarRoles(slug, roles);
      set({ me, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || "No se pudo confirmar la selección" });
      throw e;
    }
  },

  logout: () => {
    setAuthToken(null);
    set({ token: null, me: null, slug: null, error: null });
  },
}));
