"""Endpoints de Items (ejemplo end-to-end)."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.deps import CurrentUser, DbSession
from app.repositories.item_repository import ItemRepository
from app.schemas.item import ItemCreate, ItemRead
from app.services.item_service import ItemService

router = APIRouter(prefix="/items", tags=["items"])


def _service(db: DbSession) -> ItemService:
    return ItemService(ItemRepository(db))


@router.post(
    "",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear item",
)
async def create_item(
    payload: ItemCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ItemRead:
    svc = _service(db)
    item = await svc.create_for_user(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
    )
    await db.commit()
    return ItemRead.model_validate(item)


@router.get("", response_model=list[ItemRead], summary="Listar mis items")
async def list_items(
    db: DbSession,
    current_user: CurrentUser,
) -> list[ItemRead]:
    svc = _service(db)
    items = await svc.list_for_user(current_user.id)
    return [ItemRead.model_validate(i) for i in items]


@router.get("/{item_id}", response_model=ItemRead, summary="Obtener item por id")
async def get_item(
    item_id: int,
    db: DbSession,
    current_user: CurrentUser,
) -> ItemRead:
    svc = _service(db)
    item = await svc.get_for_user(item_id=item_id, owner_id=current_user.id)
    return ItemRead.model_validate(item)
