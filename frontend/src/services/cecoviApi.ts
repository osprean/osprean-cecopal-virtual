// Cliente API de CECOVI. En dev, Vite proxya /api → FastAPI :8000; en prod la
// SPA y la API comparten origen (FastAPI sirve dist). El JWT temporal (login por
// credencial) viaja en Authorization: Bearer.

const TOKEN_KEY = "cecovi_token";

let _token: string | null = localStorage.getItem(TOKEN_KEY);

export function setAuthToken(token: string | null): void {
  _token = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return _token;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const err = new Error(body?.error?.message || res.statusText) as ApiError;
    err.status = res.status;
    err.code = body?.error?.code;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// --- endpoints CECOVI (acotados por slug de emergencia) ---
const base = (slug: string) => `/api/v1/emergencias/${encodeURIComponent(slug)}`;

export interface TokenOut {
  access_token: string;
  token_type: string;
  emergencia_id: number;
  nivel: string;
}

export interface Me {
  usuario_id: number;
  emergencia_id: number;
  nombre: string;
  telefono: string | null;
  nivel: string;
  solo_lectura: boolean;
  roles_confirmados: boolean;
  roles: string[];
}

export const cecoviApi = {
  login: (slug: string, token: string) =>
    apiFetch<TokenOut>(`${base(slug)}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  me: (slug: string) => apiFetch<Me>(`${base(slug)}/auth/me`),
  catalogoRoles: (slug: string) =>
    apiFetch<{ seleccionables: string[] }>(`${base(slug)}/roles/catalogo`),
  seleccionarRoles: (slug: string, roles: string[]) =>
    apiFetch<Me>(`${base(slug)}/roles/seleccion`, {
      method: "POST",
      body: JSON.stringify({ roles }),
    }),
};
