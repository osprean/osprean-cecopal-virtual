import { test, expect } from "@playwright/test";

// e2e front↔back del área SEGURIDAD (Paso 3, primera área):
// login real por la UI → la vista de seguridad carga su estado DEL BACKEND
// (vacío, sin mocks) → se crea un perímetro con la sesión del navegador → al
// recargar, la vista lo refleja (round-trip real, sin datos mock).
const SLUG = "seg-e2e";
const TOKEN = "1.segsecret"; // credencial acuñada para el usuario de prueba (rol seguridad)

const perimetrosGet = (url: string) =>
  url.includes(`/emergencias/${SLUG}/seguridad/perimetros`);

test("seguridad: vista cargada del backend + alta de perímetro round-trip", async ({ page }) => {
  // --- login real por la UI (credencial temporal) ---
  await page.goto(`/${SLUG}`);
  await page.fill('input[type="password"]', TOKEN);
  await page.getByRole("button", { name: /acceder/i }).click();

  // La vista de seguridad monta y carga perímetros del backend (vacío, sin mocks).
  const r1 = await page.waitForResponse(
    (res) => perimetrosGet(res.url()) && res.request().method() === "GET",
    { timeout: 30_000 },
  );
  expect(r1.status()).toBe(200);
  expect(await r1.json()).toEqual([]);

  // --- crear un perímetro con la sesión autenticada del navegador (Bearer) ---
  const token = await page.evaluate(() => localStorage.getItem("cecovi_token"));
  const create = await page.request.post(
    `http://localhost:5273/api/v1/emergencias/${SLUG}/seguridad/perimetros`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        kind: "exclusion",
        label: "Perímetro E2E",
        shape: "polygon",
        points: [
          { lat: 39.4, lng: -0.3 },
          { lat: 39.41, lng: -0.31 },
          { lat: 39.42, lng: -0.3 },
        ],
      },
    },
  );
  expect(create.status()).toBe(201);

  // --- al recargar, la vista vuelve a cargar del backend y refleja el creado ---
  await page.reload();
  const r2 = await page.waitForResponse(
    (res) => perimetrosGet(res.url()) && res.request().method() === "GET",
    { timeout: 30_000 },
  );
  const list = (await r2.json()) as Array<{ label: string; estado: string }>;
  expect(list.some((p) => p.label === "Perímetro E2E" && p.estado === "active")).toBeTruthy();
});
