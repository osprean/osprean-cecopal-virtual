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

// Recurso de COMACON (solo lectura) con coordenadas renderables.
export interface RecursoComacon {
  resource_id: number;
  name: string;
  status: string | null;
  kind: string;
  lat: number | null;
  lng: number | null;
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

export const cecoviApi = {
  login: (slug: string, token: string) => post<TokenOut>(`${base(slug)}/auth/login`, { token }),
  me: (slug: string) => apiFetch<Me>(`${base(slug)}/auth/me`),
  catalogoRoles: (slug: string) =>
    apiFetch<{ seleccionables: string[] }>(`${base(slug)}/roles/catalogo`),
  seleccionarRoles: (slug: string, roles: string[]) =>
    post<Me>(`${base(slug)}/roles/seleccion`, { roles }),

  // Recursos COMACON (solo lectura, acotado por org de la emergencia).
  recursos: (slug: string) => apiFetch<RecursoComacon[]>(`${base(slug)}/recursos`),

  // --- seguridad ---
  seg: {
    listPerimetros: (slug: string) => apiFetch<any[]>(`${base(slug)}/seguridad/perimetros`),
    crearPerimetro: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/seguridad/perimetros`, body),
    estadoPerimetro: (slug: string, id: number, estado: string) =>
      post<any>(`${base(slug)}/seguridad/perimetros/${id}/estado`, { estado }),
    listAccesos: (slug: string) => apiFetch<any[]>(`${base(slug)}/seguridad/accesos`),
    crearAcceso: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/seguridad/accesos`, body),
    estadoAcceso: (slug: string, id: number, estado: string) =>
      post<any>(`${base(slug)}/seguridad/accesos/${id}/estado`, { estado }),
    listCortes: (slug: string) => apiFetch<any[]>(`${base(slug)}/seguridad/cortes`),
    crearCorte: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/seguridad/cortes`, body),
    estadoCorte: (slug: string, id: number, estado: string) =>
      post<any>(`${base(slug)}/seguridad/cortes/${id}/estado`, { estado }),
    listIncidencias: (slug: string) => apiFetch<any[]>(`${base(slug)}/seguridad/incidencias`),
    crearIncidencia: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/seguridad/incidencias`, body),
    estadoIncidencia: (slug: string, id: number, estado: string) =>
      post<any>(`${base(slug)}/seguridad/incidencias/${id}/estado`, { estado }),
  },
};
