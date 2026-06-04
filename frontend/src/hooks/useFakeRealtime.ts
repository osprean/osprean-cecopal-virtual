import { useEffect, useRef } from "react";
import { useRealtimeStore } from "../store";
import type { RealtimeEvent, Severity } from "../types";

const SAMPLE_EVENTS: Array<Omit<RealtimeEvent, "id" | "timestamp">> = [
  { type: "comm", level: "info", message: "[INT] Frente NE estabilizado en 60%." },
  { type: "resource-move", level: "info", message: "BRIF-2 reubicado en cota 1240." },
  { type: "alert", level: "high", message: "[METEO] Racha 42 km/h prevista en próximos 20 min." },
  { type: "status-change", level: "medium", message: "Recurso AMB-09 marcado como disponible." },
  { type: "comm", level: "info", message: "[CECOPAL] Confirma recepción de víveres en albergue." },
  { type: "alert", level: "critical", message: "[NORTE-3] Pavesa detectada en sector D-2." },
  { type: "system", level: "info", message: "Backup de log diario completado." },
  { type: "comm", level: "low", message: "[PSI] Atención psicosocial activa en pabellón." },
];

const randomFrom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

interface Options {
  intervalMs?: number;
  enabled?: boolean;
}

// Pushes a synthetic realtime event to the store at a steady cadence
// so the timeline / live feed never feels static during demos.
export const useFakeRealtime = ({ intervalMs = 6000, enabled = true }: Options = {}) => {
  const pushEvent = useRealtimeStore((s) => s.pushEvent);
  const streaming = useRealtimeStore((s) => s.streaming);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!enabled || !streaming) return;
    const id = window.setInterval(() => {
      const sample = randomFrom(SAMPLE_EVENTS);
      counterRef.current += 1;
      pushEvent({
        id: `evt-fake-${Date.now()}-${counterRef.current}`,
        timestamp: new Date().toISOString(),
        type: sample.type,
        level: sample.level as Severity,
        message: sample.message,
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [pushEvent, intervalMs, enabled, streaming]);
};
