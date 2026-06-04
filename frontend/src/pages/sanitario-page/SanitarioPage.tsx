import { useState } from "react";
import { Box, Flex } from "@chakra-ui/react";
import {
  MapDrawingLayer,
  MapDrawingToolbar,
  SanitarioMapLayers,
  TacticalMap,
} from "../../modules/map";
import { CollapsibleSidePanel } from "../../components/base";
import { useFakeRealtime } from "../../hooks/useFakeRealtime";
import { SanitarioHeader } from "./SanitarioHeader";
import { SanitarioActionToolbar } from "./SanitarioActionToolbar";
import { SanitarioRightPanel } from "./SanitarioRightPanel";
import {
  RegisterVictimModal,
  RequestAmbulanceModal,
  SanitaryAlertModal,
  SanitaryZoneModal,
  VictimDetailModal,
} from "./SanitarioModals";

export const SanitarioPage = () => {
  useFakeRealtime({ intervalMs: 7000 });
  const [ambOpen, setAmbOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="#F8FAFC" overflow="hidden">
      <SanitarioHeader />

      {/* Mapa y side panel como dos cards independientes — estilo Comacon */}
      <Flex
        flex="1"
        minH={0}
        overflow="hidden"
        gap={{ base: 0, lg: 3 }}
        p={{ base: 0, lg: 3 }}
        position="relative"
      >
        <Box
          position="relative"
          flex="1 1 auto"
          minW={0}
          bg="white"
          borderRadius={{ base: 0, lg: "2xl" }}
          boxShadow={{ base: "none", lg: "0 2px 4px rgba(15,22,36,0.06), 0 8px 24px rgba(15,22,36,0.08)" }}
          overflow="hidden"
        >
          <TacticalMap>
            <SanitarioMapLayers />
            <MapDrawingLayer scope="sanitario" />
          </TacticalMap>
          <SanitarioActionToolbar
            onOpenAmbulance={() => setAmbOpen(true)}
            onOpenAlert={() => setAlertOpen(true)}
          />
          <MapDrawingToolbar scope="sanitario" position="top-left" />
        </Box>
        <CollapsibleSidePanel
          isOpen={sideOpen}
          onToggle={() => setSideOpen((v) => !v)}
          width="380px"
          label="Sanitario"
        >
          <SanitarioRightPanel />
        </CollapsibleSidePanel>
      </Flex>

      <RegisterVictimModal />
      <SanitaryZoneModal />
      <VictimDetailModal />
      <RequestAmbulanceModal isOpen={ambOpen} onClose={() => setAmbOpen(false)} />
      <SanitaryAlertModal isOpen={alertOpen} onClose={() => setAlertOpen(false)} />
    </Flex>
  );
};
