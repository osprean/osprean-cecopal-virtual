// COMACON-aligned LIGHT palette.
// Surfaces map to white / gray.50 / gray.100; accents follow Chakra colorSchemes
// (red/orange/yellow/teal/blue/purple/green) so badges and dots feel native to
// the COMACON aesthetic.
export const tacticalColors = {
  bg: {
    abyss: "#F4F6F9",         // page bg (subtle off-white)
    base: "#F7F9FC",          // main app bg
    panel: "#FFFFFF",         // cards / panels
    panelRaised: "#FFFFFF",
    panelSubtle: "#F7F9FC",   // inset / subtle backgrounds
    overlay: "rgba(15, 22, 36, 0.45)",
    glass: "rgba(255, 255, 255, 0.85)",
  },
  border: {
    subtle: "#EDF0F4",        // gray.100
    strong: "#E2E8F0",        // gray.200
    accent: "#CBD5E0",        // gray.300
  },
  text: {
    primary: "#1A202C",       // gray.800
    secondary: "#4A5568",     // gray.600
    muted: "#A0AEC0",         // gray.400
    label: "#718096",         // gray.500
    inverted: "#FFFFFF",
  },
  accent: {
    teal: "#319795",          // teal.500
    tealDeep: "#2C7A7B",      // teal.600
    tealSoft: "rgba(49, 151, 149, 0.10)",
  },
  // Operational states (Chakra colorScheme aligned)
  state: {
    critical: "#E53E3E",
    criticalSoft: "rgba(229, 62, 62, 0.10)",
    alert: "#DD6B20",
    alertSoft: "rgba(221, 107, 32, 0.10)",
    pending: "#D69E2E",
    pendingSoft: "rgba(214, 158, 46, 0.12)",
    operational: "#38A169",
    operationalSoft: "rgba(56, 161, 105, 0.10)",
    active: "#3182CE",
    activeSoft: "rgba(49, 130, 206, 0.10)",
    standby: "#805AD5",
    standbySoft: "rgba(128, 90, 213, 0.10)",
    offline: "#A0AEC0",
    offlineSoft: "rgba(160, 174, 192, 0.18)",
  },
  domain: {
    fire: "#DD6B20",
    flood: "#3182CE",
    medical: "#D53F8C",
    seismic: "#805AD5",
    chemical: "#65A30D",
    security: "#D69E2E",
    "traffic-accident": "#E53E3E",
  },
} as const;

export type TacticalColors = typeof tacticalColors;
