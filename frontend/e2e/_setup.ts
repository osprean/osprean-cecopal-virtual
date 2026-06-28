// Helpers e2e: crear emergencia + capturar tokens del sink en disco.
//
// El uvicorn CECOVI corre en modo dev con EMAIL_SINK_DIR=<backend>/var/email_sink/.
// Cada send() escribe el cuerpo del email (con token) a un archivo. Los tests
// leen esos archivos para extraer la credencial.

import { request } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const BACKEND_DIR =
  process.env.CECOVI_BACKEND_DIR ||
  "/Users/luisgomez/Desktop/kraken/osprean-cecopal-virtual/backend";
const SINK_DIR = join(BACKEND_DIR, "var", "email_sink");
const API_BASE = process.env.CECOVI_API_BASE || "http://localhost:8000";
const WEBHOOK_SECRET =
  process.env.CECOVI_WEBHOOK_SECRET || "dev-webhook-secret-change-me";

const COMACON_EMERGENCY_ID_BASE = 9000;

export interface DemoData {
  slug: string;
  tokens: Record<string, string>; // email → token raw
}

export async function setupDemo(slug: string): Promise<DemoData> {
  const comaconEmergencyId = COMACON_EMERGENCY_ID_BASE + Math.floor(Math.random() * 9000);

  // 1) FK emergencias en CECOVI DB (la stub) — ejecutamos vía docker exec.
  try {
    execSync(
      `docker exec cecovi_test_pg2 psql -U app -d app -c "INSERT INTO emergencies(id) VALUES (${comaconEmergencyId}) ON CONFLICT DO NOTHING; INSERT INTO organization(id) VALUES (1) ON CONFLICT DO NOTHING;"`,
      { stdio: "pipe" },
    );
  } catch (e) {
    throw new Error(`No pude insertar FK en cecovi_test_pg2: ${(e as Error).message}`);
  }

  // 2) snapshot del sink ANTES de crear, para diff luego.
  const before = new Set(safeReaddir(SINK_DIR));

  // 3) crear emergencia vía webhook.
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_BASE}/api/v1/emergencias`, {
    headers: { "X-Webhook-Secret": WEBHOOK_SECRET },
    data: {
      organization_id: 1,
      comacon_emergency_id: comaconEmergencyId,
      slug,
      modo: "real",
      roles: [
        {
          rol: "direccion",
          titular: { nombre: "Alcaldesa", email: `alcaldesa-${slug}@x.es`, telefono: "+1", nivel: "cecopal" },
          suplentes: [],
        },
        {
          rol: "seguridad",
          titular: { nombre: "Seg", email: `seg-${slug}@x.es`, telefono: null, nivel: "cecopal" },
          suplentes: [{ nombre: "SegSup", email: `seg-sup-${slug}@x.es`, telefono: null, nivel: "cecopal" }],
        },
        {
          rol: "sanitario",
          titular: { nombre: "San", email: `san-${slug}@x.es`, telefono: null, nivel: "cecopal" },
          suplentes: [],
        },
        {
          rol: "logistica",
          titular: { nombre: "Log", email: `log-${slug}@x.es`, telefono: null, nivel: "cecopal" },
          suplentes: [],
        },
        {
          rol: "gabinete",
          titular: { nombre: "Gab", email: `gab-${slug}@x.es`, telefono: null, nivel: "cecopal" },
          suplentes: [],
        },
      ],
    },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`setupDemo: webhook respondió ${res.status()}: ${body}`);
  }

  // 4) diff sink → archivos nuevos → tokens.
  await new Promise((r) => setTimeout(r, 250)); // dejar que se vacíe el writer
  const after = safeReaddir(SINK_DIR);
  const tokens: Record<string, string> = {};
  for (const f of after) {
    if (before.has(f)) continue;
    const content = readFileSync(join(SINK_DIR, f), "utf-8");
    const m = content.match(/^To:\s*(.+)$/m);
    const t = content.match(/Tu credencial temporal:\s*(.+)$/m);
    if (m && t) {
      const email = m[1].trim();
      if (!tokens[email]) tokens[email] = t[1].trim();
    }
  }
  await ctx.dispose();
  return { slug, tokens };
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => {
      try {
        return statSync(join(dir, f)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}
