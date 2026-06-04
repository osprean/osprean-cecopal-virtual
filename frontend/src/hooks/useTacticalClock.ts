import { useEffect, useState } from "react";

export const useTacticalClock = (intervalMs = 1000): Date => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
};
