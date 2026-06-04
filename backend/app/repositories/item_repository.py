"""Acceso a datos de Item."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item


class ItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, item_id: int) -> Item | None:
        return await self._session.get(Item, item_id)

    async def list_by_owner(self, owner_id: int) -> Sequence[Item]:
        stmt = select(Item).where(Item.owner_id == owner_id).order_by(Item.id.desc())
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def create(
        self,
        *,
        owner_id: int,
        name: str,
        description: str | None,
    ) -> Item:
        item = Item(owner_id=owner_id, name=name, description=description)
        self._session.add(item)
        await self._session.flush()
        await self._session.refresh(item)
        return item
