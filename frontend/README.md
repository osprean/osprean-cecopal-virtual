# Frontend — React + Vite

SPA en React 18 + TypeScript strict, fetching con TanStack Query, cliente axios con auth JWT.

## Setup

```bash
cd frontend
pnpm install
pnpm dev
```

Servirá en `http://localhost:5173`. Las peticiones a `/api` se proxean a `http://localhost:8000` (FastAPI).

## Scripts

|                   |                            |
| ----------------- | -------------------------- |
| `pnpm dev`        | Vite dev server con HMR    |
| `pnpm build`      | tsc + vite build → `dist/` |
| `pnpm preview`    | sirve el bundle local      |
| `pnpm lint`       | ESLint                     |
| `pnpm format`     | Prettier                   |
| `pnpm type-check` | tsc --noEmit               |
| `pnpm test`       | Vitest                     |

## Layout

```
src/
├── main.tsx
├── App.tsx
├── api/        # cliente axios, endpoints tipados
├── components/ # AuthProvider, ProtectedRoute, ...
├── pages/      # LoginPage, MePage, ItemsPage
├── hooks/      # useAuth (context)
├── lib/        # tokenStorage
└── types/      # tipos API
```

## Auth

- `tokenStorage` guarda access + refresh en `localStorage`.
- Interceptor de `axios` añade `Authorization: Bearer <access>` y reintenta una vez con refresh ante 401.
- `AuthProvider` cuelga del React context, expone `login()`, `logout()`, `user`.

En prod nada cambia: el bundle se sirve desde FastAPI en el mismo origen, así
que cookies/credenciales se simplifican y CORS deja de ser necesario.
