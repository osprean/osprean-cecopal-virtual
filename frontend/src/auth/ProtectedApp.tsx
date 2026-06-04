import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Center, Spinner } from "@chakra-ui/react";
import { useAuthStore } from "./authStore";
import { visibleAreas } from "./permissions";
import { LoginView } from "../pages/cecovi/LoginView";
import { RoleSelectionView } from "../pages/cecovi/RoleSelectionView";
import { TacticalLayout } from "../layouts";
import { TabRouter } from "../features/TabRouter";
import { useTabsStore } from "../store";
import type { TabKey } from "../types";

// Máquina de estados de acceso a una emergencia /{idEmergencia}:
//   sin token            → login por credencial
//   token, cargando /me  → spinner
//   roles sin confirmar  → selección de roles (I4)
//   ok                   → app operativa (layout + tabs)
export function ProtectedApp() {
  const { idEmergencia = "" } = useParams();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.me);
  const slug = useAuthStore((s) => s.slug);
  const loading = useAuthStore((s) => s.loading);
  const loadMe = useAuthStore((s) => s.loadMe);
  const setVisibleAreas = useTabsStore((s) => s.setVisibleAreas);

  useEffect(() => {
    if (token && idEmergencia && (!me || slug !== idEmergencia)) {
      void loadMe(idEmergencia);
    }
  }, [token, idEmergencia, me, slug, loadMe]);

  // RBAC: al confirmar roles, limita las pestañas visibles a las áreas del rol.
  useEffect(() => {
    if (me?.roles_confirmados) {
      setVisibleAreas(visibleAreas(me.roles) as TabKey[]);
    }
  }, [me, setVisibleAreas]);

  if (!token) return <LoginView slug={idEmergencia} />;
  if (loading || !me || slug !== idEmergencia) {
    return (
      <Center minH="100vh" bg="gray.900">
        <Spinner color="pink.400" size="xl" />
      </Center>
    );
  }
  if (!me.roles_confirmados) return <RoleSelectionView slug={idEmergencia} />;
  return (
    <TacticalLayout>
      <TabRouter />
    </TacticalLayout>
  );
}
