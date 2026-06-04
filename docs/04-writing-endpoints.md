# 04 — Añadir un endpoint nuevo

Tutorial guiado: vamos a añadir `POST /api/v1/products` (y `GET /api/v1/products`,
`GET /api/v1/products/{id}`) atravesando todas las capas del backend.

Patrón de la plantilla:

```
HTTP  ──►  Router (api/v1/products.py)
              │
              ▼
           Service (services/product_service.py)   ← reglas de negocio
              │
              ▼
           Repository (repositories/product_repository.py)   ← solo SQL/ORM
              │
              ▼
           Model (models/product.py)               ← clase SQLAlchemy
```

Los `Schemas` (Pydantic) viven aparte y los usan Router (entrada/salida HTTP) y,
ocasionalmente, el Service.

> 💡 Si el dominio es trivial (CRUD puro sin reglas), está bien saltarse
> `services/` y hacer que el router hable directamente con el repository. Ver
> "Cuándo saltarse capas" al final.

---

## 1) Modelo SQLAlchemy

Crea `backend/app/models/product.py`:

```python
"""Modelo Product."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import User


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cents: Mapped[int] = mapped_column(nullable=False)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    owner: Mapped[User] = relationship()
```

> 💡 Convención: precios y dineros en **enteros (céntimos)**, nunca en
> `float`. Evita errores de redondeo.

Registra el modelo en `backend/app/models/__init__.py` para que Alembic lo
detecte en autogenerate:

```python
from app.models.item import Item
from app.models.product import Product
from app.models.user import User

__all__ = ["Item", "Product", "User"]
```

---

## 2) Schemas Pydantic

Crea `backend/app/schemas/product.py`:

```python
"""Schemas de Product."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    price_cents: int = Field(ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    price_cents: int | None = Field(default=None, ge=0)


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    price_cents: int
    owner_id: int
    created_at: datetime
```

`from_attributes=True` permite a Pydantic leer atributos del ORM directamente
(`ProductRead.model_validate(product)`).

---

## 3) Migración

Genera la migración con autogenerate:

```bash
make migration name="add_products_table"
```

Esto crea un archivo nuevo en `backend/alembic/versions/`, parecido a:

```
backend/alembic/versions/2026_05_21_1830-abc123_add_products_table.py
```

**Ábrelo y revísalo siempre.** Autogenerate detecta tablas/columnas nuevas pero
puede saltarse:

- Índices con nombre custom.
- `CHECK` constraints.
- Cambios de tipo no triviales (varchar→text).
- Datos por defecto en columnas existentes.

Aplica:

```bash
make migrate
```

Verifica:

```bash
docker exec -it app_postgres_dev psql -U app -d app -c "\d products"
```

Más sobre Alembic en [05-database](05-database.md).

---

## 4) Repository

Crea `backend/app/repositories/product_repository.py`:

```python
"""Acceso a datos de Product."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class ProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, product_id: int) -> Product | None:
        return await self._session.get(Product, product_id)

    async def list_by_owner(self, owner_id: int) -> Sequence[Product]:
        stmt = (
            select(Product)
            .where(Product.owner_id == owner_id)
            .order_by(Product.id.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def create(
        self,
        *,
        owner_id: int,
        name: str,
        description: str | None,
        price_cents: int,
    ) -> Product:
        product = Product(
            owner_id=owner_id,
            name=name,
            description=description,
            price_cents=price_cents,
        )
        self._session.add(product)
        await self._session.flush()
        await self._session.refresh(product)
        return product
```

Regla de oro del repository: **solo SQL/ORM**. Nada de HTTP, nada de reglas de
negocio.

---

## 5) Service

Crea `backend/app/services/product_service.py`:

```python
"""Lógica de Product."""

from __future__ import annotations

from collections.abc import Sequence

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.product import Product
from app.repositories.product_repository import ProductRepository


class ProductService:
    def __init__(self, products: ProductRepository) -> None:
        self._products = products

    async def create_for_user(
        self,
        *,
        owner_id: int,
        name: str,
        description: str | None,
        price_cents: int,
    ) -> Product:
        return await self._products.create(
            owner_id=owner_id,
            name=name,
            description=description,
            price_cents=price_cents,
        )

    async def list_for_user(self, owner_id: int) -> Sequence[Product]:
        return await self._products.list_by_owner(owner_id)

    async def get_for_user(self, *, product_id: int, owner_id: int) -> Product:
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise NotFoundError("Product not found", code="product_not_found")
        if product.owner_id != owner_id:
            raise ForbiddenError("Not your product", code="not_owner")
        return product
```

Aquí van las reglas que no son SQL: ownership, validaciones cruzadas,
orquestación con otros services.

Las excepciones (`NotFoundError`, `ForbiddenError`) se traducen automáticamente
a respuestas HTTP por los handlers en
[backend/app/core/exceptions.py](../backend/app/core/exceptions.py).

---

## 6) Router

Crea `backend/app/api/v1/products.py`:

```python
"""Endpoints de Products."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.deps import CurrentUser, DbSession
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductRead
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


def _service(db: DbSession) -> ProductService:
    return ProductService(ProductRepository(db))


@router.post(
    "",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear producto",
)
async def create_product(
    payload: ProductCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ProductRead:
    svc = _service(db)
    product = await svc.create_for_user(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        price_cents=payload.price_cents,
    )
    await db.commit()
    return ProductRead.model_validate(product)


@router.get("", response_model=list[ProductRead], summary="Listar mis productos")
async def list_products(
    db: DbSession,
    current_user: CurrentUser,
) -> list[ProductRead]:
    svc = _service(db)
    products = await svc.list_for_user(current_user.id)
    return [ProductRead.model_validate(p) for p in products]


@router.get(
    "/{product_id}",
    response_model=ProductRead,
    summary="Obtener producto",
)
async def get_product(
    product_id: int,
    db: DbSession,
    current_user: CurrentUser,
) -> ProductRead:
    svc = _service(db)
    product = await svc.get_for_user(
        product_id=product_id, owner_id=current_user.id
    )
    return ProductRead.model_validate(product)
```

Reglas para el router:

- **No** SQL ni reglas de negocio aquí. Solo entrada/salida HTTP.
- `db: DbSession`, `current_user: CurrentUser` son aliases definidos en
  [backend/app/deps.py](../backend/app/deps.py).
- `await db.commit()` en mutaciones — el `get_session` dependency abre la
  sesión pero no hace commit por sí solo.

---

## 7) Registrar el router

Edita [backend/app/api/router.py](../backend/app/api/router.py):

```python
from app.api.v1 import auth, items, products, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(items.router)
api_router.include_router(products.router)
```

---

## 8) Test de integración

Crea `backend/tests/integration/test_products.py`:

```python
"""CRUD básico + ownership de products."""

from __future__ import annotations

from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, email: str) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password-12345", "full_name": None},
    )
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "password-12345"},
    )
    return str(r.json()["access_token"])


async def test_create_and_list_product(client: AsyncClient) -> None:
    token = await _register_and_login(client, "p1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/v1/products",
        json={"name": "Widget", "description": None, "price_cents": 1999},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["price_cents"] == 1999

    r = await client.get("/api/v1/products", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_product_ownership_enforced(client: AsyncClient) -> None:
    alice = await _register_and_login(client, "alice-p@example.com")
    bob = await _register_and_login(client, "bob-p@example.com")

    r = await client.post(
        "/api/v1/products",
        json={"name": "Alice's", "price_cents": 100},
        headers={"Authorization": f"Bearer {alice}"},
    )
    pid = r.json()["id"]

    r = await client.get(
        f"/api/v1/products/{pid}",
        headers={"Authorization": f"Bearer {bob}"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "not_owner"
```

Ejecuta:

```bash
make test
# o solo el archivo:
cd backend && uv run pytest tests/integration/test_products.py -v
```

---

## 9) Verificar en `/docs`

Reinicia el backend (si Uvicorn no detectó el cambio) y abre
<http://localhost:8000/docs>. Deberías ver un nuevo tag `products` con tus tres
endpoints. Probarlos desde ahí confirma que el wiring está bien.

---

## ¿Por qué tantas capas?

| Capa | Beneficio |
|---|---|
| **Schema** | Validación gratis + docs OpenAPI; nunca expones el modelo ORM directo (filtraciones de campos sensibles). |
| **Repository** | Tests unitarios mockeables; migrar de SQLAlchemy a otro ORM toca solo aquí. |
| **Service** | Reglas de negocio centralizadas, testeable sin HTTP. |
| **Router** | Único lugar que sabe de HTTP; cambios de framework (FastAPI → otro) son locales. |

### Cuándo es aceptable saltarse capas

- **CRUD trivial sin reglas**: el router puede llamar al repository directamente.
  Si en el futuro aparece lógica, refactoriza añadiendo el service.
- **Helper de lectura**: un endpoint que solo hace `SELECT` puede vivir sin
  service.

No te saltes nunca el **schema** y el **router**: son la capa pública de la API.

---

## Siguiente paso

- Más sobre migraciones → [05-database](05-database.md).
- Cómo testear lo que acabas de escribir → [06-testing](06-testing.md).
