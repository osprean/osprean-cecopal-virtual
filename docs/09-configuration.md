# 09 — Configuración y secretos

Toda la config del backend pasa por una sola clase `Settings` cargada con
`pydantic-settings`. Sin `os.environ.get(...)` repartido por el código.

---

## Cómo funciona `pydantic-settings`

La clase [Settings](../backend/app/config.py) define los campos disponibles
con sus tipos y defaults:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENV: Env = "development"
    DATABASE_URL: str = "postgresql+asyncpg://app:app@localhost:5432/app"
    JWT_SECRET_KEY: str = "dev-insecure-change-me"
    # ...
```

Orden de prioridad de los valores (de mayor a menor):

1. Variables de entorno del proceso (las que ya están exportadas en tu shell o
   inyectadas por K8s).
2. Archivo `.env` en el directorio donde se arranca el backend.
3. Defaults declarados en la clase.

La instancia se obtiene vía `get_settings()` (cacheada con `@lru_cache`):

```python
from app.config import get_settings

settings = get_settings()
print(settings.ENV)
```

> 💡 Como `Settings` está cacheada, cambios en `.env` **no se recogen en
> caliente**. Para y vuelve a arrancar el backend.

---

## Variables disponibles

Todas viven en [.env.example](../.env.example) con valores dummy y comentarios.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `ENV` | `development` | `development`, `staging`, `production`, `test`. En `production` el backend monta los estáticos del frontend. |
| `DATABASE_URL` | `postgresql+asyncpg://app:app@localhost:5432/app` | DSN async SQLAlchemy. **Obligatorio** en prod. |
| `JWT_SECRET_KEY` | `dev-insecure-change-me` | Secret para firmar JWTs. **Obligatorio cambiar en prod.** |
| `JWT_ALGORITHM` | `HS256` | Algoritmo de firma. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | TTL del access token. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | TTL del refresh token. |
| `FRONTEND_DIST_PATH` | `/app/frontend/dist` | Path absoluto al bundle del frontend (solo en producción). |
| `CORS_ORIGINS` | vacío | Lista separada por comas: `http://localhost:5173,http://otro`. Vacío = sin CORS. |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`. |

Adicionalmente, `docker-compose.dev.yml` lee estas (para crear la BD):

| Variable | Por defecto |
|---|---|
| `POSTGRES_USER` | `app` |
| `POSTGRES_PASSWORD` | `app` |
| `POSTGRES_DB` | `app` |

---

## Generar un `JWT_SECRET_KEY` seguro

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Cópialo a tu `.env`. En producción debe venir de un Secret de K8s gestionado
por DevOps.

> ⚠️ Cambiar `JWT_SECRET_KEY` invalida todos los tokens existentes. Los
> usuarios tendrán que loguearse de nuevo.

---

## Añadir una variable nueva

Pasos para añadir `EMAIL_SMTP_URL` (por ejemplo):

### 1) Declárala en `app/config.py`

```python
class Settings(BaseSettings):
    # ... otros campos ...
    EMAIL_SMTP_URL: str = ""
```

Con type hint y default. Si no quieres default (obligatoria), no pongas valor:

```python
EMAIL_SMTP_URL: str   # falla al arrancar si no está definida
```

### 2) Añádela a `.env.example`

```bash
# --- Email ---------------------------------------------------------
# DSN SMTP usado por el módulo notifications.
# Formato: smtp://user:pass@host:port
EMAIL_SMTP_URL=smtp://user:pass@smtp.example.com:587
```

Con un comentario explicando qué es y un valor dummy.

### 3) Úsala en el código

```python
from app.config import get_settings

settings = get_settings()
print(settings.EMAIL_SMTP_URL)
```

### 4) Documéntala aquí

Añade una fila a la tabla de "Variables disponibles" de arriba.

### 5) Comunica a DevOps

Si la nueva var es obligatoria en producción, **avisa a quien gestione los
manifiestos de K8s**. La feature no funcionará hasta que esté en el Secret/
ConfigMap.

> 💡 Comprueba el `.env.example` en cada PR. Si añades una variable y no la
> pones ahí, el siguiente compañero que clone el repo se llevará un susto.

---

## CORS: cuándo y cómo modificarlo

Por defecto, `CORS_ORIGINS` está vacío. Esto es correcto en producción si:

- Frontend y backend comparten origen (es el modelo single-pod por defecto).

Necesitas configurarlo cuando:

- En **desarrollo** Vite está en `:5173` y FastAPI en `:8000` → ya está pre-configurado
  en `.env.example` con `CORS_ORIGINS=http://localhost:5173,http://localhost:8000`.
- En producción sirves el frontend desde **otro dominio** (ej. CDN o subdominio
  separado): añade ese origen.

Formato: lista separada por comas, **sin espacios** alrededor.

```
CORS_ORIGINS=https://app.osprean.net,https://admin.osprean.net
```

Si dejas `*` (`CORS_ORIGINS=*`) cualquier origen puede llamar. **No** lo hagas
en producción con endpoints autenticados; rompe la protección por origen.

---

## Por qué no commiteamos `.env`

`.env` contiene secretos: `JWT_SECRET_KEY`, contraseñas de BD reales, API keys
de terceros. Está en [.gitignore](../.gitignore) y **nunca** se sube al repo.

Lo que sí se commitea:

- `.env.example` — plantilla con claves dummy y comentarios.
- `.env.test.example` (si lo crearas) — config para CI/tests.

> ⚠️ Si por error commitearas un secret real, **rotalo inmediatamente**.
> No sirve con `git rm` y un nuevo commit: GitHub guarda el contenido en
> caches y forks. El secret está quemado en el momento que tocó el remoto.

---

## En producción (Kubernetes)

DevOps inyecta las variables de entorno en el pod a través de:

- `ConfigMap` para config no sensible (`ENV`, `LOG_LEVEL`, `CORS_ORIGINS`…).
- `Secret` para secretos (`JWT_SECRET_KEY`, `DATABASE_URL` con creds…).

Como dev tu responsabilidad es:

1. Declarar la variable en `Settings` con un default razonable o ningún default
   (obligatoria).
2. Documentarla en `.env.example`.
3. **Avisar al equipo de DevOps** de cada variable nueva que tu feature
   requiere antes de mergear.

DevOps las añadirá al `Secret`/`ConfigMap` correspondiente.

---

## Siguiente paso

- Cosas que pueden salir mal y cómo arreglarlas → [10-troubleshooting](10-troubleshooting.md).
