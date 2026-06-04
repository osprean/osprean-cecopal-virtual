import { apiClient } from "./client";
import type { Item, ItemCreate } from "@/types/api";

export async function listItems(): Promise<Item[]> {
  const { data } = await apiClient.get<Item[]>("/items");
  return data;
}

export async function createItem(payload: ItemCreate): Promise<Item> {
  const { data } = await apiClient.post<Item>("/items", payload);
  return data;
}

export async function getItem(id: number): Promise<Item> {
  const { data } = await apiClient.get<Item>(`/items/${id}`);
  return data;
}
