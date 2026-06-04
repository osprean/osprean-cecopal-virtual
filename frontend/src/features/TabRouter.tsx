import type { FC } from "react";
import { useTabsStore } from "../store";
import type { TabKey } from "../types";
import { DireccionPage } from "../pages/direccion-page";
import { SeguridadPage } from "../pages/seguridad-page";
import { SanitarioPage } from "../pages/sanitario-page";
import { LogisticaPage } from "../pages/logistica-page";
import { GabinetePage } from "../pages/gabinete-page";
import { CampoPage } from "../pages/campo-page";

const VIEWS: Record<TabKey, FC> = {
  direccion: DireccionPage,
  seguridad: SeguridadPage,
  sanitario: SanitarioPage,
  logistica: LogisticaPage,
  gabinete: GabinetePage,
  campo: CampoPage,
};

export const TabRouter: FC = () => {
  const activeTab = useTabsStore((s) => s.activeTab);
  const View = VIEWS[activeTab];
  return <View />;
};
