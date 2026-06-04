# 10 — Troubleshooting: problemas comunes

Catálogo de errores que vas a ver al menos una vez. Cada entrada: síntoma →
causa → solución.

---

## Backend no arranca

### `connection refused` o `could not connect to server` al arrancar el backend

**Síntoma:**

```
asyncpg.exceptions.ConnectionDoesNotExistError: connection was closed
# o
ConnectionRefusedError: [Errno 61] Connect call failed
```

**Causa:** Postgres no está levantado.

**Solución:**

```bash
make db-up
docker compose -f docker-compose.dev.yml ps   # verifica que está "healthy"
make backend-dev
```

Si `make db-up` falla con "port already in use", ver más abajo *Puerto 5432
ocupado*.

---

### `ModuleNotFoundError: No module named 'X'`

**Causa:** Alguien añadió una dep nueva tras tu último `pull`, o has cambiado
de rama.

**Solución:**

```bash
cd backend
uv sync
```

Vuelve a `make backend-dev`.

---

### `Settings validation error` al arrancar

**Síntoma:** Pydantic se queja de que una env var es obligatoria o tiene tipo
incorrecto.

```
pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings
JWT_SECRET_KEY
  Field required
```

**Causa:** Falta una variable en `.env` (o se llama distinto).

**Solución:**

```bash
diff .env .env.example     # compara qué falta
cp .env.example .env       # si no tienes .env, créalo y edítalo
```

---

## Migraciones

### `target database is not up to date`

**Síntoma:** Al generar una nueva migración Alembic se queja de que la BD no
está al día.

```
ERROR [alembic.util.messaging] Target database is not up to date.
```

**Causa:** Hay migraciones pendientes en `alembic/versions/` que no se han
aplicado.

**Solución:**

```bash
make migrate          # aplica las pendientes
make migration name="lo_que_querías"
```

---

### `Can't locate revision identified by 'XXX'`

**Síntoma:** Alembic no encuentra una revisión que la tabla `alembic_version`
en la BD dice que está aplicada.

**Causa:** Cambiaste de rama y la migración que la BD tiene aplicada ya no
existe en `alembic/versions/`.

**Solución (modo destructivo, solo en local):**

```bash
docker compose -f docker-compose.dev.yml down -v
make db-up
make migrate
```

Reseteas la BD y vuelves a aplicar desde cero.

---

### Autogenerate detecta "drop + add" cuando esperabas un rename

**Causa:** Alembic no infiere renames. Ve la columna vieja como eliminada y la
nueva como añadida.

**Solución:** Edita la migración a mano:

```python
# en vez de:
op.drop_column("users", "name")
op.add_column("users", sa.Column("full_name", sa.String(255)))

# escribe:
op.alter_column("users", "name", new_column_name="full_name")
```

Más en [05-database](05-database.md#3-revisa-siempre-el-archivo-generado).

---

## Frontend

### 404 al llamar a `/api/...` desde el navegador

**Causa más común:** El proxy de Vite no está apuntando correctamente o el
backend no está corriendo.

**Solución:**

1. Verifica que el backend corre: `curl http://localhost:8000/health/live`.
2. Mira [frontend/vite.config.ts](../frontend/vite.config.ts) → debe tener:
   ```typescript
   server: {
     proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
   },
   ```
3. Reinicia el dev server (`Ctrl+C` y `make frontend-dev` de nuevo) — cambios
   en `vite.config.ts` requieren reinicio.

---

### Login funciona pero todas las llamadas devuelven 401

**Posibles causas (en orden de frecuencia):**

1. **Access token caducado** (vida = 30 min por defecto). El interceptor
   debería renovar automáticamente. Si no lo hace:
   - Mira en DevTools → Network. ¿Sale un POST a `/api/v1/auth/refresh`?
   - Si **no** sale: el interceptor no se está disparando — revisa
     [frontend/src/api/client.ts](../frontend/src/api/client.ts).
   - Si **sale y devuelve 401**: el refresh también caducó (≥ 7 días). Logout
     y login de nuevo.

2. **`JWT_SECRET_KEY` cambió** entre el momento del login y la siguiente
   request. Cualquier token previo queda invalidado. Limpia el localStorage:
   ```javascript
   localStorage.clear()
   ```
   y vuelve a entrar.

3. **El backend está reiniciándose constantemente** (uvicorn `--reload`) por
   algún cambio en bucle. Eso por sí solo no invalida tokens, pero si combinado
   con un `.env` distinto entre reinicios, sí.

---

### CORS error: `No 'Access-Control-Allow-Origin' header`

**Causa:** Estás haciendo la llamada **sin pasar por el proxy de Vite** (por
ejemplo, hardcodeando `http://localhost:8000/api/v1/items` en el cliente).

**Solución:** Llama por **path relativo**: `apiClient.get("/items")` →
`/api/v1/items` → Vite proxea a `:8000` → sin CORS.

Si necesitas saltarte el proxy (raro), añade el origen a `CORS_ORIGINS` en
`.env` y reinicia el backend.

---

### TypeScript se queja de tipos pero el código "funciona"

**Causa:** `noUncheckedIndexedAccess: true` en `tsconfig.json` hace que
acceder a un array o dict devuelva `T | undefined`.

**Ejemplo:**

```typescript
const first = items[0];          // tipo: Item | undefined
console.log(first.name);          // ❌ error: first puede ser undefined
```

**Solución:** Maneja el caso `undefined`:

```typescript
const first = items[0];
if (!first) return null;
console.log(first.name);          // ✅ ahora es Item
```

Vivirás con esto al principio; salva muchos bugs.

---

## Calidad de código y commits

### `pre-commit` falla al hacer commit

**Síntoma típico:**

```
ruff.....................................................................Failed
- hook id: ruff
- files were modified by this hook
```

**Causa:** Una herramienta arregló cosas automáticamente. Pre-commit aborta el
commit y deja los cambios sin staged.

**Solución:**

```bash
git add -A
git commit -m "tu mensaje"
```

Si falla de verdad (no por modificación automática), corre los fixers a mano:

```bash
make format
cd frontend && pnpm format
```

---

### CI falla pero en local pasa

**Causas comunes:**

1. **Olvidaste commitear el lockfile** (`uv.lock` o `pnpm-lock.yaml`). CI
   instala desde lockfile y no ve tu dep nueva.
2. **Test dependiente de Postgres específicamente.** Local corre SQLite por
   defecto. Reproduce con:
   ```bash
   make db-up
   TEST_DATABASE_URL="postgresql+asyncpg://app:app@localhost:5432/app" \
     uv run pytest -x
   ```
3. **Test dependiente de zona horaria.** Fija el `tzinfo` explícitamente con
   `datetime.now(UTC)` en vez de `datetime.now()`.

---

## Docker

### `docker compose: command not found`

**Causa:** Tienes Docker viejo con `docker-compose` (con guion) en vez del
plugin v2.

**Solución:** Actualiza a Docker v20+ con `docker compose` (sin guion).
Alternativamente, en el Makefile sustituye `docker compose` por
`docker-compose`.

---

### Puerto 5432 ocupado (Postgres del host)

**Síntoma:**

```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

**Causa:** Tienes Postgres instalado en el host y corriendo.

**Solución (elige una):**

- Para el Postgres del host: `brew services stop postgresql` (macOS) o
  `sudo systemctl stop postgresql` (Linux).
- Cambia el puerto en `docker-compose.dev.yml`:
  ```yaml
  ports:
    - "5433:5432"
  ```
  Y actualiza `DATABASE_URL` en `.env` a `...@localhost:5433/...`.

---

### Puerto 8000 u 8000 ocupado

```
[Errno 48] Address already in use
```

**Ver quién lo tiene:**

```bash
lsof -i :8000           # macOS/Linux
lsof -i :5173
```

**Matar el proceso:**

```bash
kill -9 <PID>
```

O arranca en otro puerto:

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8001
```

(Recuerda actualizar el proxy del frontend si cambias el puerto del backend.)

---

### La imagen Docker pesa más de lo esperado

**Causa:** Algo grande entró por error (node_modules, `.venv`, tests…).

**Solución:** Comprueba `.dockerignore`. Las exclusiones por defecto son:

```
node_modules/
.venv/
__pycache__/
backend/tests/
frontend/tests/
*.md
```

Inspecciona la imagen:

```bash
docker images osprean-webapp:local
docker history osprean-webapp:local
```

---

## Tests

### `RuntimeError: Event loop is closed` en tests async

**Causa:** Mezclar `pytest-asyncio` con código que usa `asyncio.run()`
internamente, o fixtures con scope incorrecto.

**Solución:** Asegúrate de que la fixture afectada usa `scope="function"` (es
el default) y no llamas a `asyncio.run` desde un test que ya está dentro de un
event loop.

---

### `coverage failed: total of N% is less than fail_under=80`

**Causa:** Has añadido código sin tests o has borrado tests.

**Solución:**

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
```

Mira la columna "Missing" para ver qué líneas no se ejecutan y añade tests.
Si una rama no merece test (logging defensivo, branches imposibles), exclúyela:

```python
if impossible:  # pragma: no cover
    raise RuntimeError("unreachable")
```

---

### Tests pasan en local pero un `make test` global falla

**Causa:** Estás corriendo desde un directorio inesperado o falta `make install`.

**Solución:**

```bash
make install
make test
```

Asegúrate de estar en la raíz del repo cuando lanzas `make`.

---

## ¿Algo más roto?

1. Revisa los logs del backend (`make backend-dev` los imprime en stdout — son
   JSON estructurado por structlog).
2. Revisa los logs de Postgres: `make db-logs`.
3. Mira si hay issues abiertas en el repo de la plantilla.
4. Pregunta en el canal de Slack del equipo.

Si encuentras un problema reproducible que no está aquí, **añade la entrada a
este archivo** en el siguiente PR. Esta doc crece con el uso.
