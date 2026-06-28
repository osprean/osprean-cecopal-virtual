// e2e front↔back del área SEGURIDAD: login real → vista carga del backend
// (vacío) → crea perímetro → recarga refleja el creado.

import { test, expect } from "@playwright/test";
import { setupDemo } from "./_setup";

const ts = Date.now();
const SLUG = `seg-${ts}`;

const perimetrosGet = (url: string, slug: string) =>
  url.includes(`/emergencias/${slug}/seguridad/perimetros`);

test("seguridad: vista cargada del backend + alta de perímetro round-trip", async ({ page }) => {
  const { tokens } = await setupDemo(SLUG);
  const tokenSeg = tokens[`seg-${SLUG}@x.es`];
  expect(tokenSeg, "token seguridad capturado").toBeTruthy();

  // --- login real por la UI (credencial temporal del rol seguridad) ---
  await page.context().clearCookies();
  await page.goto(`/${SLUG}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${SLUG}`);
  await page.getByPlaceholder(/credencial de acceso/i).fill(tokenSeg);
  const accederBtn = page.getByRole("button", { name: /acceder/i });
  await expect(accederBtn).toBeEnabled({ timeout: 10_000 });
  // Pre-armo waitForResponse ANTES del click (Playwright captura desde la llamada).
  const r1Promise = page.waitForResponse(
    (res) => perimetrosGet(res.url(), SLUG) && res.request().method() === "GET",
    { timeout: 30_000 },
  );
  await accederBtn.click();

  // Cerrar la modal de tareas que se auto-abre (sin bloquear la carga de seguridad).
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.getByRole("button", { name: /cerrar y continuar/i }).click();
  await expect(modal).toBeHidden();

  // La vista de seguridad monta y carga perímetros del backend (vacío).
  const r1 = await r1Promise;
  expect(r1.status()).toBe(200);
  expect(await r1.json()).toEqual([]);

  // --- crear un perímetro con la sesión autenticada del navegador (Bearer) ---
  const token = await page.evaluate(() => localStorage.getItem("cecovi_token"));
  const create = await page.request.post(
    `http://localhost:8000/api/v1/emergencias/${SLUG}/seguridad/perimetros`,
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
  const r2Promise = page.waitForResponse(
    (res) => perimetrosGet(res.url(), SLUG) && res.request().method() === "GET",
    { timeout: 30_000 },
  );
  await page.reload();
  const r2 = await r2Promise;
  const list = (await r2.json()) as Array<{ label: string; estado: string }>;
  expect(list.some((p) => p.label === "Perímetro E2E" && p.estado === "active")).toBeTruthy();
});
