// e2e del flujo CECOVI completo (P3 + P5 + P9 + P10 + P11):
//   - login alcaldesa (master direccion) por la UI
//   - modal de tareas se auto-abre, acepta una y la cierra
//   - login backup seguridad: pide email; master entra después y deshabilita
//   - transferencia: alcaldesa transfiere a otra persona (API)
//   - finalizar emergencia + descarga PDF
//
// Asume stack arriba: uvicorn CECOVI :8000 con EMAIL_SINK_DIR set, vite :5174,
// docker cecovi_test_pg2 corriendo.

import { test, expect } from "@playwright/test";
import { setupDemo } from "./_setup";

const ts = Date.now();

test("flujo alcaldesa: login → modal tareas → aceptar → cerrar", async ({ page }) => {
  const slug = `flujo-${ts}-a`;
  const { tokens } = await setupDemo(slug);
  const tokenAlcaldesa = tokens[`alcaldesa-${slug}@x.es`];
  expect(tokenAlcaldesa, "token alcaldesa capturado del sink").toBeTruthy();

  // 1) Login UI (limpiar localStorage para entrar siempre fresco).
  await page.context().clearCookies();
  await page.goto(`/${slug}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${slug}`);
  await page.getByPlaceholder(/credencial de acceso/i).fill(tokenAlcaldesa);
  const accederBtn = page.getByRole("button", { name: /acceder/i });
  await expect(accederBtn).toBeEnabled({ timeout: 10_000 });
  await accederBtn.click();

  // 2) Esperar a que /auth/me devuelva 200 (auth completo).
  await page.waitForResponse(
    (res) => res.url().includes(`/emergencias/${slug}/auth/me`) && res.status() === 200,
    { timeout: 30_000 },
  );

  // 3) La modal de tareas se auto-abre en primer login.
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal.getByText(/Tareas operativas iniciales/i)).toBeVisible();

  // 4) Vista jefe: todas las áreas presentes (los headings de grupo).
  await expect(modal.getByRole("heading", { name: "Dirección" })).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Seguridad" })).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Sanitario" })).toBeVisible();

  // 5) Aceptar la primera tarea y verificar que pasa a "ACEPTADA".
  // Chakra Checkbox: el input nativo está oculto; clickamos el LABEL textual.
  const aceptarResp = page.waitForResponse(
    (res) => /\/tareas\/\d+\/aceptar$/.test(res.url()) && res.status() === 200,
  );
  await modal.locator("label", { hasText: /^Aceptar$/ }).first().click();
  await aceptarResp;
  await expect(modal.getByText("ACEPTADA").first()).toBeVisible();

  // 6) Cerrar modal.
  await modal.getByRole("button", { name: /cerrar y continuar/i }).click();
  await expect(modal).toBeHidden();
});

test("backup seguridad: pide email; master expulsa al backup", async ({ page, request }) => {
  const slug = `flujo-${ts}-b`;
  const { tokens } = await setupDemo(slug);
  const tokenSegMaster = tokens[`seg-${slug}@x.es`];
  const tokenSegBackup = tokens[`seg-sup-${slug}@x.es`];
  expect(tokenSegMaster && tokenSegBackup).toBeTruthy();

  // 1) Backup entra por UI: el campo email está siempre visible, lo rellenamos
  // junto con el token y un solo submit. Limpiar localStorage para evitar que
  // un token previo (del test anterior) interfiera con el montaje del LoginView.
  await page.context().clearCookies();
  await page.goto(`/${slug}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${slug}`);
  await page.getByPlaceholder(/credencial de acceso/i).fill(tokenSegBackup);
  await page.getByPlaceholder(/tu email/i).fill(`seg-sup-${slug}@x.es`);
  // El botón "Acceder" debe pasar a enabled tras el fill (gated por credential.trim()).
  const accederBtn = page.getByRole("button", { name: /acceder/i });
  await expect(accederBtn).toBeEnabled({ timeout: 10_000 });
  const okLogin = page.waitForResponse(
    (res) => res.url().includes(`/auth/login`) && res.status() === 200,
    { timeout: 30_000 },
  );
  await accederBtn.click();
  await okLogin;
  await page.waitForResponse(
    (res) => res.url().includes(`/auth/me`) && res.status() === 200,
    { timeout: 30_000 },
  );

  // 2) Capturar el JWT del backup ANTES de que el master lo invalide.
  const tokenBackupJwt = await page.evaluate(() => localStorage.getItem("cecovi_token"));
  expect(tokenBackupJwt).toBeTruthy();

  // 3) Master entra vía API → invalida la sesión backup.
  const loginMaster = await request.post(
    `http://localhost:8000/api/v1/emergencias/${slug}/auth/login`,
    { data: { token: tokenSegMaster } },
  );
  expect(loginMaster.status()).toBe(200);

  // 4) El JWT del backup ya NO sirve: /auth/me responde 401 sesion_terminada.
  const meTras = await request.get(
    `http://localhost:8000/api/v1/emergencias/${slug}/auth/me`,
    { headers: { Authorization: `Bearer ${tokenBackupJwt}` } },
  );
  expect(meTras.status()).toBe(401);
  const body = await meTras.json();
  expect(body.error.code).toBe("sesion_terminada");

  // 5) Tras reload, el front detecta 401 y vuelve a LoginView.
  await page.reload();
  await expect(page.getByPlaceholder(/credencial de acceso/i)).toBeVisible({ timeout: 30_000 });
});

test("finalizar + descarga PDF", async ({ page, request }) => {
  const slug = `flujo-${ts}-c`;
  const { tokens } = await setupDemo(slug);
  const tokenAlcaldesa = tokens[`alcaldesa-${slug}@x.es`];

  // 1) Login alcaldesa
  await page.context().clearCookies();
  await page.goto(`/${slug}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${slug}`);
  await page.getByPlaceholder(/credencial de acceso/i).fill(tokenAlcaldesa);
  const accederBtn3 = page.getByRole("button", { name: /acceder/i });
  await expect(accederBtn3).toBeEnabled({ timeout: 10_000 });
  await accederBtn3.click();
  await page.waitForResponse(
    (res) => res.url().includes(`/emergencias/${slug}/auth/me`) && res.status() === 200,
    { timeout: 30_000 },
  );

  // 2) Finalizar vía API (botón UI pendiente).
  const token = await page.evaluate(() => localStorage.getItem("cecovi_token"));
  const finalizar = await request.post(
    `http://localhost:8000/api/v1/emergencias/${slug}/finalizar`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(finalizar.status()).toBe(200);
  expect(await finalizar.json()).toMatchObject({ estado: "finalizada" });

  // 3) Descarga PDF (status 200 si WeasyPrint está, 404 si no).
  const pdf = await request.get(
    `http://localhost:8000/api/v1/emergencias/${slug}/informe.pdf`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect([200, 404]).toContain(pdf.status());
  if (pdf.status() === 200) {
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const buf = await pdf.body();
    expect(buf.byteLength).toBeGreaterThan(1000);
  }
});

test("transferencia: alcaldesa transfiere y la credencial origen queda revocada", async ({
  request,
}) => {
  const slug = `flujo-${ts}-d`;
  const { tokens } = await setupDemo(slug);
  const tokenAlcaldesa = tokens[`alcaldesa-${slug}@x.es`];

  // login
  const login = await request.post(
    `http://localhost:8000/api/v1/emergencias/${slug}/auth/login`,
    { data: { token: tokenAlcaldesa } },
  );
  expect(login.status()).toBe(200);
  const access = (await login.json()).access_token;

  // transferir
  const trans = await request.post(
    `http://localhost:8000/api/v1/emergencias/${slug}/auth/transferir`,
    {
      headers: { Authorization: `Bearer ${access}` },
      data: {
        nombre: "Roberto Suplente",
        email: `roberto-${slug}@x.es`,
        motivo: "voy al hospital",
      },
    },
  );
  expect(trans.status()).toBe(201);

  // re-login con token origen → 401 credential_revoked
  const reLogin = await request.post(
    `http://localhost:8000/api/v1/emergencias/${slug}/auth/login`,
    { data: { token: tokenAlcaldesa } },
  );
  expect(reLogin.status()).toBe(401);
  expect((await reLogin.json()).error.code).toBe("credential_revoked");
});
