import { create } from "zustand";
import type { TabKey, TacticalTab } from "../types";

const DEFAULT_TABS: TacticalTab[] = [
  { key: "direccion", label: "Dirección", shortLabel: "DIR" },
  { key: "seguridad", label: "Seguridad", shortLabel: "SEG" },
  { key: "sanitario", label: "Sanitario", shortLabel: "SAN" },
  { key: "logistica", label: "Logística", shortLabel: "LOG" },
  { key: "gabinete", label: "Gabinete", shortLabel: "GAB" },
  { key: "campo", label: "Campo", shortLabel: "CMP" },
];

interface TabsState {
  tabs: TacticalTab[];
  activeTab: TabKey;
  setActiveTab: (key: TabKey) => void;
  setTabBadge: (key: TabKey, badge: number | null) => void;
  // RBAC: limita las pestañas a las áreas permitidas por los roles (/auth/me).
  setVisibleAreas: (areas: TabKey[]) => void;
}

export const useTabsStore = create<TabsState>((set) => ({
  tabs: DEFAULT_TABS,
  activeTab: "direccion",
  setActiveTab: (key) => set({ activeTab: key }),
  setTabBadge: (key, badge) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.key === key ? { ...t, badge } : t)),
    })),
  setVisibleAreas: (areas) =>
    set((state) => {
      const allowed = new Set(areas);
      const tabs = DEFAULT_TABS.filter((t) => allowed.has(t.key));
      const activeTab = allowed.has(state.activeTab)
        ? state.activeTab
        : (tabs[0]?.key ?? state.activeTab);
      return { tabs, activeTab };
    }),
}));
