import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createItem, listItems } from "@/api/items";
import type { Item } from "@/types/api";

export function ItemsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const itemsQuery = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: listItems,
  });

  const createMut = useMutation({
    mutationFn: () => createItem({ name, description: description || null }),
    onSuccess: () => {
      setName("");
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["items"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMut.mutate();
  }

  return (
    <section style={{ maxWidth: 640, margin: "32px auto", fontFamily: "system-ui" }}>
      <h2>Mis items</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: 8, marginRight: 8 }}
        />
        <input
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: 8, marginRight: 8 }}
        />
        <button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? "Creando…" : "Crear"}
        </button>
      </form>

      {itemsQuery.isLoading && <p>Cargando…</p>}
      {itemsQuery.isError && <p role="alert">Error al cargar.</p>}

      <ul>
        {itemsQuery.data?.map((it) => (
          <li key={it.id}>
            <strong>{it.name}</strong>
            {it.description ? ` — ${it.description}` : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
