# 03 — Frontend: integrar uno existente o empezar desde cero

La plantilla viene con un esqueleto React mínimo (login + página protegida +
CRUD de items con TanStack Query). Sirve como punto de partida y como ejemplo
de los patrones recomendados.

Dos escenarios:

- **A** — Tienes ya un frontend hecho y quieres meterlo en la plantilla.
- **B** — Empiezas desde cero, partiendo del esqueleto incluido.

---

## A. Integrar un frontend ya existente

### A1) Limpia el código de ejemplo

```bash
rm -rf frontend/src frontend/public/*
```

> ⚠️ Mantén `frontend/index.html`, `frontend/vite.config.ts`,
> `frontend/tsconfig.json`, `frontend/.eslintrc.cjs`, `frontend/.prettierrc`,
> `frontend/package.json` (lo mergeamos en el siguiente paso) y
> `frontend/tests/setup.ts`.

### A2) Copia tu código

```bash
cp -R /ruta/al/proyecto/src frontend/src
cp -R /ruta/al/proyecto/public frontend/public 2>/dev/null || true
```

Asegúrate de que tu `index.html` apunta a `/src/main.tsx` (o lo que sea tu
entry). Si tu entry es distinto, edita
[frontend/index.html](../frontend/index.html).

### A3) Mergea `package.json`

Estrategia: **mantén las devDeps de la plantilla** (vite, vitest, eslint,
prettier, typescript, RTL, jsdom) y **añade las deps de tu proyecto**.

```bash
cd frontend
# Por cada dep nueva de tu proyecto:
pnpm add nombre-paquete@version
pnpm add -D nombre-dev-dep@version
```

Si tu proyecto trae un `package-lock.json` o `yarn.lock`, **bórralo** — usamos
`pnpm` y el lockfile bueno es `pnpm-lock.yaml`.

### A4) Verifica el proxy de Vite

Abre [frontend/vite.config.ts](../frontend/vite.config.ts) y comprueba que
sigue habiendo:

```typescript
server: {
  port: 5173,
  proxy: {
    "/api": {
      target: "http://localhost:8000",
      changeOrigin: true,
    },
  },
},
```

Esto hace que `fetch("/api/v1/items")` desde tu app vaya transparentemente a
FastAPI. Sin esto, te comerás CORS.

### A5) Adapta tu cliente HTTP

El backend expone todo bajo `/api/v1`. Configura tu cliente con esa base URL.
Ejemplo con axios:

```typescript
import axios from "axios";

export const api = axios.create({ baseURL: "/api/v1" });
```

Para autenticación JWT, añade un interceptor que inyecte el token desde donde
lo guardes. La plantilla ya tiene un patrón completo (con refresh automático
ante 401) en [frontend/src/api/client.ts](../frontend/src/api/client.ts);
cópialo y úsalo como base.

### A6) Otros stacks (no React, otro router…)

Si tu frontend no usa React Router, TanStack Query o axios, **está bien** — no
son obligatorios. Solo asegúrate de:

- Llamar al backend por rutas que empiecen por `/api/`.
- Servir el bundle en `frontend/dist/` (Vite lo hace por defecto).
- Tener un `index.html` en `dist/` (el backend lo devuelve como SPA fallback en
  producción).

Si cambias de React a Svelte/Vue/etc., también necesitarás:

- Cambiar el plugin de Vite: `@vitejs/plugin-react` → `@sveltejs/vite-plugin-svelte` /
  `@vitejs/plugin-vue`.
- Actualizar `frontend/.eslintrc.cjs` con la config correspondiente.
- Quitar `@types/react`, `@testing-library/react`, etc.

### A7) Instala y arranca

```bash
cd frontend
pnpm install
pnpm dev
```

Si todo va bien, ves tu app en <http://localhost:5173> y las llamadas a `/api/*`
llegan a FastAPI en `:8000`.

---

## B. Empezar desde cero (sobre el esqueleto)

El esqueleto que viene en la plantilla ya implementa:

- Login (`/login`).
- Rutas protegidas (`<ProtectedRoute>`).
- Página de perfil (`/me`).
- CRUD de items con TanStack Query (`/items`).

Úsalo como referencia para añadir más cosas.

### B1) Estructura recomendada

```
frontend/src/
├── main.tsx          # entry; QueryClientProvider + <App/>
├── App.tsx           # router + AuthProvider + rutas
├── api/              # un fichero por "recurso" (auth.ts, items.ts...)
│   ├── client.ts     # instancia axios + interceptors
│   └── *.ts          # funciones tipadas que llaman a /api/v1/...
├── components/       # UI reutilizable, agnóstica de página
├── pages/            # una por ruta (LoginPage, MePage, ItemsPage...)
├── hooks/            # hooks custom (useAuth, useDebounce...)
├── lib/              # helpers puros sin React (tokenStorage, formatters...)
└── types/            # tipos TS compartidos (espejo del schema del backend)
```

Convención: **el código se separa por capa, no por feature**. Si una página
crece mucho, sí merece su carpeta `pages/Foo/{FooPage.tsx, FooHeader.tsx,
useFooData.ts}`.

### B2) Añadir una página nueva

Imagina que añades `/profile/settings`.

**1.** Crea `frontend/src/pages/SettingsPage.tsx`:

```typescript
export function SettingsPage() {
  return (
    <section style={{ maxWidth: 480, margin: "32px auto" }}>
      <h1>Ajustes</h1>
      <p>Aquí van los ajustes del usuario.</p>
    </section>
  );
}
```

**2.** Regístrala en [frontend/src/App.tsx](../frontend/src/App.tsx):

```typescript
import { SettingsPage } from "@/pages/SettingsPage";

// ...dentro de <Routes>:
<Route
  path="/profile/settings"
  element={
    <ProtectedRoute>
      <Shell>
        <SettingsPage />
      </Shell>
    </ProtectedRoute>
  }
/>
```

**3.** Añade un link en la nav (`Shell` en `App.tsx`):

```typescript
<Link to="/profile/settings">Ajustes</Link>
```

Vite recarga, listo.

### B3) Llamar a un endpoint nuevo con TanStack Query

Patrón completo: tipo → función API → hook con `useQuery`.

**1.** Tipo en `frontend/src/types/api.ts`:

```typescript
export interface Notification {
  id: number;
  message: string;
  read: boolean;
  created_at: string;
}
```

**2.** Función API en `frontend/src/api/notifications.ts`:

```typescript
import { apiClient } from "./client";
import type { Notification } from "@/types/api";

export async function listNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>("/notifications");
  return data;
}
```

**3.** Úsala en una página o componente:

```typescript
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/api/notifications";

export function NotificationsPage() {
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });

  if (q.isLoading) return <p>Cargando…</p>;
  if (q.isError) return <p role="alert">Error</p>;

  return (
    <ul>
      {q.data?.map((n) => (
        <li key={n.id}>{n.message}</li>
      ))}
    </ul>
  );
}
```

Para mutaciones, usa `useMutation` y luego
`queryClient.invalidateQueries({ queryKey: ["notifications"] })` para refrescar.
Ejemplo completo en
[frontend/src/pages/ItemsPage.tsx](../frontend/src/pages/ItemsPage.tsx).

### B4) ¿Cuándo crear un hook custom?

Usa `useQuery` directamente cuando:

- La query se usa en **un único** componente.
- No tienes lógica derivada (filtrado, agregación, transformaciones).

Crea un hook custom en `frontend/src/hooks/` cuando:

- La misma query se usa en varios sitios.
- Necesitas devolver datos derivados (`{ unreadCount, hasUnread, refetch }`).
- Quieres encapsular invalidaciones cruzadas.

Ejemplo:

```typescript
// frontend/src/hooks/useNotifications.ts
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/api/notifications";

export function useNotifications() {
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });
  const unreadCount = q.data?.filter((n) => !n.read).length ?? 0;
  return { ...q, unreadCount, hasUnread: unreadCount > 0 };
}
```

---

## Build de producción

```bash
cd frontend
pnpm build
```

Genera `frontend/dist/` con `index.html`, `assets/*.js`, `assets/*.css`.

En el contenedor de producción, FastAPI sirve ese directorio:

- `/assets/*` → ficheros estáticos.
- Cualquier ruta no-API → `index.html` (SPA fallback).

Lo construye el stage `frontend-builder` del [docker/Dockerfile](../docker/Dockerfile).
Tú no lo invocas a mano: `make build` lo hace dentro de Docker.

---

## Siguiente paso

- Añadir el endpoint al que llama tu nueva página →
  [04-writing-endpoints](04-writing-endpoints.md).
- Tests del frontend → [06-testing](06-testing.md#frontend).
