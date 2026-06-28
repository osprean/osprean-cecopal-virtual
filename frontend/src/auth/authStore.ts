import { create } from "zustand";
import {
  cecoviApi,
  getAuthToken,
  setAuthToken,
  type Me,
} from "../services/cecoviApi";

interface AuthState {
  token: string | null;
  slug: string | null;
  me: Me | null;
  loading: boolean;
  error: string | null;
  login: (
    slug: string,
    credential: string,
    opts?: { email?: string; force?: boolean },
  ) => Promise<void>;
  loadMe: (slug: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getAuthToken(),
  slug: null,
  me: null,
  loading: false,
  error: null,

  login: async (slug, credential, opts = {}) => {
    set({ loading: true, error: null });
    try {
      const res = await cecoviApi.login(slug, credential, opts);
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

  logout: async () => {
    const { slug } = get();
    try {
      if (slug) await cecoviApi.logout(slug);
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    set({ token: null, me: null, slug: null, error: null });
  },
}));
