// RBAC en el front (Paso 1): derivado de los roles de /auth/me. El jefe
// (dirección) ve todo; cada rol ve su área. En F3 el backend reimpone con
// require_perm; el front solo oculta/gatea (defensa en profundidad).

export const ROL_JEFE = "jefe";

// Áreas operativas = pestañas de la SPA (emergency-manager).
export const AREAS = ["direccion", "seguridad", "sanitario", "logistica", "gabinete", "campo"] as const;
export type Area = (typeof AREAS)[number];

// El jefe opera "direccion"; el resto de roles mapean 1:1 con su área.
export function visibleAreas(roles: string[]): Area[] {
  if (roles.includes(ROL_JEFE)) return [...AREAS];
  const set = new Set(roles);
  return AREAS.filter((a) => (a === "direccion" ? false : set.has(a)));
}

export function canAccessArea(roles: string[], area: Area): boolean {
  if (roles.includes(ROL_JEFE)) return true;
  return area !== "direccion" && roles.includes(area);
}

export function isJefe(roles: string[]): boolean {
  return roles.includes(ROL_JEFE);
}
