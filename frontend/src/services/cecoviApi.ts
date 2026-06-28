// Cliente API de CECOVI. En dev, Vite proxya /api → FastAPI :8000; en prod la
// SPA y la API comparten origen (FastAPI sirve dist). El JWT temporal (login por
// credencial) viaja en Authorization: Bearer.
//
// Cambios P3/P5/P9/P10/P11 (master/backup + tareas + notif + transferir + cierre).

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

// P3: el login devuelve roles (lista) + tipo (master|backup) + sesion_id.
export interface TokenOut {
  access_token: string;
  token_type: string;
  emergencia_id: number;
  roles: string[];
  tipo: "master" | "backup";
  sesion_id: number;
}

// P3: `roles_confirmados` deja de tener sentido (los roles vienen del JWT).
export interface Me {
  usuario_id: number | null;
  emergencia_id: number;
  nombre: string | null;
  telefono: string | null;
  nivel: string | null;
  solo_lectura: boolean;
  roles: string[];
  tipo: "master" | "backup";
}

// P7: recurso de COMACON ampliado (foto se servirá vía photo_url cuando esté).
export interface RecursoComacon {
  resource_id: number;
  name: string;
  status: string | null;
  kind: string;
  lat: number | null;
  lng: number | null;
  observations?: string | null;
  phone_number?: string | null;
  organism?: string | null;
  linked_user_email?: string | null;
}

// P5: tareas operativas (snapshot del diagrama de actividades por rol).
export interface Tarea {
  id: number;
  emergencia_id: number;
  rol: string;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  orden: number;
  estado: "pending" | "accepted" | "completed" | "cancelled";
  accepted_by_id: number | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// P9: notificaciones cross-area.
export interface Notificacion {
  id: number;
  emergencia_id: number;
  rol_destino: string;
  actor_id: number | null;
  tipo: string;
  mensaje: string;
  payload: Record<string, unknown>;
  leida_at: string | null;
  created_at: string;
}

// P10: cuerpo de transferencia de rol.
export interface TransferirIn {
  nombre: string;
  email: string;
  telefono?: string | null;
  motivo: string;
}

export interface TransferirOut {
  credencial_origen_id: number;
  credencial_nueva_id: number;
  nuevo_usuario_id: number;
}

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

export const cecoviApi = {
  login: (
    slug: string,
    token: string,
    opts: { force?: boolean; email?: string } = {},
  ) =>
    post<TokenOut>(`${base(slug)}/auth/login`, {
      token,
      force: opts.force ?? false,
      ...(opts.email ? { email: opts.email } : {}),
    }),

  logout: (slug: string) => post<null>(`${base(slug)}/auth/logout`, {}),

  me: (slug: string) => apiFetch<Me>(`${base(slug)}/auth/me`),

  transferir: (slug: string, payload: TransferirIn) =>
    post<TransferirOut>(`${base(slug)}/auth/transferir`, payload),

  // Recursos COMACON (solo lectura, acotado por org de la emergencia).
  recursos: (slug: string) => apiFetch<RecursoComacon[]>(`${base(slug)}/recursos`),

  // --- P5: tareas operativas ---
  tareas: {
    list: (slug: string) => apiFetch<Tarea[]>(`${base(slug)}/tareas`),
    aceptar: (slug: string, id: number) => post<Tarea>(`${base(slug)}/tareas/${id}/aceptar`, {}),
    completar: (slug: string, id: number) =>
      post<Tarea>(`${base(slug)}/tareas/${id}/completar`, {}),
    cancelar: (slug: string, id: number) => post<Tarea>(`${base(slug)}/tareas/${id}/cancelar`, {}),
  },

  // --- P9: notificaciones cross-area ---
  notificaciones: {
    list: (slug: string, since?: string, onlyUnread = false) => {
      const params = new URLSearchParams();
      if (since) params.set("since", since);
      if (onlyUnread) params.set("only_unread", "true");
      const qs = params.toString();
      return apiFetch<Notificacion[]>(
        `${base(slug)}/notificaciones${qs ? `?${qs}` : ""}`,
      );
    },
    create: (
      slug: string,
      body: { rol_destino: string; tipo: string; mensaje: string; payload?: Record<string, unknown> },
    ) => post<Notificacion>(`${base(slug)}/notificaciones`, body),
    marcarLeida: (slug: string, id: number) =>
      post<Notificacion>(`${base(slug)}/notificaciones/${id}/leida`, {}),
  },

  // --- P11: cierre y PDF ---
  finalizar: (slug: string) => post<any>(`${base(slug)}/finalizar`, {}),
  reactivar: (slug: string) => post<any>(`${base(slug)}/reactivar`, {}),
  // Para descargar PDF, abrir directamente la URL (el navegador la baja):
  informePdfUrl: (slug: string) => `${base(slug)}/informe.pdf`,

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

  // --- direccion ---
  dir: {
    listGrupos: (slug: string) => apiFetch<any[]>(`${base(slug)}/direccion/grupos`),
    crearGrupo: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/direccion/grupos`, body),
    estadoGrupo: (slug: string, id: number, estado: string) =>
      post<any>(`${base(slug)}/direccion/grupos/${id}/estado`, { estado }),
    listEvacuaciones: (slug: string) => apiFetch<any[]>(`${base(slug)}/direccion/evacuaciones`),
    crearEvacuacion: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/direccion/evacuaciones`, body),
    estadoEvacuacion: (slug: string, id: number, estado: string) =>
      post<any>(`${base(slug)}/direccion/evacuaciones/${id}/estado`, { estado }),
  },

  // --- logistica ---
  log: {
    listSuministros: (slug: string) => apiFetch<any[]>(`${base(slug)}/logistica/suministros`),
    crearSuministro: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/logistica/suministros`, body),
    ajustarStock: (slug: string, id: number, delta: number) =>
      post<any>(`${base(slug)}/logistica/suministros/${id}/stock`, { delta }),
  },

  // --- sanitario ---
  san: {
    listVictimas: (slug: string) => apiFetch<any[]>(`${base(slug)}/sanitario/victimas`),
    crearVictima: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/sanitario/victimas`, body),
  },


  // --- gabinete ---
  gab: {
    listPublicaciones: (slug: string) => apiFetch<any[]>(`${base(slug)}/gabinete/publicaciones`),
    crearPublicacion: (slug: string, body: unknown) =>
      post<any>(`${base(slug)}/gabinete/publicaciones`, body),
  },
};
