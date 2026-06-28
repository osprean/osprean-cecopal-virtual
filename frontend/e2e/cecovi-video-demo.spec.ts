// Demo "the movie" — vista /demo con pipeline. Botón "Simular emergencia" →
// se ve cómo el pipeline se llena: credenciales emitidas → usuarios entran →
// tareas en curso → finalizada. Después se abre la emergencia con varias
// credenciales para mostrar el login y las sesiones aparecer/desaparecer.

import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CECOVI_FE = "http://localhost:5174";
const CECOVI_API = "http://localhost:8000";
const SINK_DIR =
  "/Users/luisgomez/Desktop/kraken/osprean-cecopal-virtual/backend/var/email_sink";

const PAUSA = async (page: Page, ms = 1500) => page.waitForTimeout(ms);
const LARGA = async (page: Page) => page.waitForTimeout(3500);

test.describe.configure({ mode: "serial" });

test("demo movie · pipeline en vivo end-to-end", async ({ page, request }) => {
  test.setTimeout(10 * 60_000);

  // ═══════════════════════════════════════════════════════════════
  // 1 · Abrir /demo y mostrar el estado inicial vacío
  // ═══════════════════════════════════════════════════════════════
  await page.context().clearCookies();
  await page.goto(`${CECOVI_FE}/demo`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${CECOVI_FE}/demo`);
  await page.waitForLoadState("networkidle");
  await LARGA(page);
  await LARGA(page);

  // ═══════════════════════════════════════════════════════════════
  // 2 · Click "Simular emergencia" → se crean credenciales
  // ═══════════════════════════════════════════════════════════════
  const beforeSink = listSink();
  await page.getByRole("button", { name: /simular emergencia/i }).click();
  await page.waitForResponse(
    (r) => r.url().includes("/demo/simular") && r.status() === 201,
    { timeout: 20_000 },
  );
  await LARGA(page);
  await LARGA(page);

  // ═══════════════════════════════════════════════════════════════
  // 3 · Pipeline se llena: credenciales aparecen
  // ═══════════════════════════════════════════════════════════════
  await expect(page.getByText("Credenciales emitidas").first()).toBeVisible({ timeout: 10_000 });
  // 7 credenciales (5 master + 2 backup): aparecen los chips MASTER y BACKUP.
  await expect(page.locator("text=MASTER").first()).toBeVisible();
  await expect(page.locator("text=BACKUP").first()).toBeVisible();
  await LARGA(page);
  await LARGA(page);

  // Capturar tokens generados por la simulación (del sink local) para entrar
  // por la UI con varias credenciales.
  const tokens = readTokens(beforeSink);
  const slug = await page.evaluate(() => localStorage.getItem("cecovi_demo_slug"));
  expect(slug).toBeTruthy();

  const tAlc = tokens["alcaldesa@villa.demo"];
  const tSeg = tokens["policia@villa.demo"];
  const tBackup = tokens["concejal-gob@villa.demo"]; // suplente de dirección
  expect(tAlc, "token alcaldesa").toBeTruthy();
  expect(tSeg, "token seguridad").toBeTruthy();

  // ═══════════════════════════════════════════════════════════════
  // 4 · Abrir la emergencia con la credencial de la alcaldesa (master)
  // ═══════════════════════════════════════════════════════════════
  const page2 = await page.context().newPage();
  await page2.goto(`${CECOVI_FE}/${slug}`);
  await page2.waitForLoadState("networkidle");
  await LARGA(page2);
  await page2.getByPlaceholder(/credencial de acceso/i).fill(tAlc);
  await PAUSA(page2);
  await page2.getByRole("button", { name: /acceder/i }).click();
  await page2.waitForResponse(
    (r) => r.url().includes("/auth/me") && r.status() === 200,
    { timeout: 20_000 },
  );
  await LARGA(page2);

  // Modal de tareas: aceptar 1 + completar 1
  const modal = page2.getByRole("dialog");
  if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
    await PAUSA(page2);
    await modal.locator("label", { hasText: /^Aceptar$/ }).first().click();
    await PAUSA(page2);
    await modal.locator("label", { hasText: /^Completada$/ }).first().click();
    await LARGA(page2);
    await modal.getByRole("button", { name: /cerrar y continuar/i }).click();
    await LARGA(page2);
  }
  await LARGA(page2);

  // ═══════════════════════════════════════════════════════════════
  // 5 · Volver al pipeline → ver que aparece sesión activa + tarea completada
  // ═══════════════════════════════════════════════════════════════
  await page.bringToFront();
  await page.reload();
  await LARGA(page);
  await expect(page.getByText("Usuarios conectados").first()).toBeVisible();
  await expect(page.getByText("alcaldesa@villa.demo")).toBeVisible({ timeout: 20_000 });
  await LARGA(page);
  await LARGA(page);

  // ═══════════════════════════════════════════════════════════════
  // 6 · Login del jefe de seguridad — el pipeline lo refleja
  // ═══════════════════════════════════════════════════════════════
  const page3 = await page.context().newPage();
  await page3.goto(`${CECOVI_FE}/${slug}`);
  await page3.waitForLoadState("networkidle");
  await LARGA(page3);
  await page3.getByPlaceholder(/credencial de acceso/i).fill(tSeg);
  await PAUSA(page3);
  await page3.getByRole("button", { name: /acceder/i }).click();
  await page3.waitForResponse(
    (r) => r.url().includes("/auth/me") && r.status() === 200,
    { timeout: 20_000 },
  );
  await LARGA(page3);
  // Saltar modal si aparece.
  const m3 = page3.getByRole("dialog");
  if (await m3.isVisible({ timeout: 3000 }).catch(() => false)) {
    await m3.getByRole("button", { name: /cerrar y continuar/i }).click();
  }
  await LARGA(page3);
  await page3.close();

  // Volver al pipeline → ahora hay 2 usuarios conectados
  await page.bringToFront();
  await page.reload();
  await LARGA(page);
  await expect(page.getByText("policia@villa.demo")).toBeVisible({ timeout: 20_000 });
  await LARGA(page);
  await LARGA(page);

  // ═══════════════════════════════════════════════════════════════
  // 7 · Login backup (con email) — credencial backup queda nominada
  // ═══════════════════════════════════════════════════════════════
  if (tBackup) {
    const page4 = await page.context().newPage();
    await page4.goto(`${CECOVI_FE}/${slug}`);
    await page4.waitForLoadState("networkidle");
    await LARGA(page4);
    await page4.getByPlaceholder(/credencial de acceso/i).fill(tBackup);
    await PAUSA(page4);
    await page4.getByPlaceholder(/tu email/i).fill("concejal-gob@villa.demo");
    await PAUSA(page4);
    // El master de dirección está dentro → backup deshabilitada (alcaldesa ya entró).
    // Esperamos cualquier response, OK o 401.
    const resp = page4.waitForResponse((r) => r.url().includes("/auth/login"), { timeout: 15_000 });
    await page4.getByRole("button", { name: /acceder/i }).click();
    try {
      await resp;
    } catch {
      /* ok */
    }
    await LARGA(page4);
    await page4.close();
  }

  // ═══════════════════════════════════════════════════════════════
  // 8 · Volver al pipeline, ver estado final
  // ═══════════════════════════════════════════════════════════════
  await page.bringToFront();
  await page.reload();
  await LARGA(page);
  await LARGA(page);
  await LARGA(page);
});

// ──────────────────── helpers ─────────────────────────────────────

function listSink(): Set<string> {
  try {
    return new Set(
      readdirSync(SINK_DIR).filter((f) => {
        try {
          return statSync(join(SINK_DIR, f)).isFile();
        } catch {
          return false;
        }
      }),
    );
  } catch {
    return new Set();
  }
}

function readTokens(before: Set<string>): Record<string, string> {
  const after = listSink();
  const tokens: Record<string, string> = {};
  for (const f of after) {
    if (before.has(f)) continue;
    const content = readFileSync(join(SINK_DIR, f), "utf-8");
    const to = content.match(/^To:\s*(.+)$/m);
    const t = content.match(/Credencial temporal:\s*(.+)$/m) ||
      content.match(/Tu credencial temporal:\s*(.+)$/m);
    if (to && t) tokens[to[1].trim()] = t[1].trim();
  }
  return tokens;
}
