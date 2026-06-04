"""Lógica de Item."""

from __future__ import annotations

from collections.abc import Sequence

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.item import Item
from app.repositories.item_repository import ItemRepository


class ItemService:
    def __init__(self, items: ItemRepository) -> None:
        self._items = items

    async def create_for_user(
        self,
        *,
        owner_id: int,
        name: str,
        description: str | None,
    ) -> Item:
        return await self._items.create(owner_id=owner_id, name=name, description=description)

    async def list_for_user(self, owner_id: int) -> Sequence[Item]:
        return await self._items.list_by_owner(owner_id)

    async def get_for_user(self, *, item_id: int, owner_id: int) -> Item:
        item = await self._items.get_by_id(item_id)
        if item is None:
            raise NotFoundError("Item not found", code="item_not_found")
        if item.owner_id != owner_id:
            raise ForbiddenError("Not your item", code="not_owner")
        return item
