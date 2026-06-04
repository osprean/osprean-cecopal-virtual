import { useState } from "react";
import { Box, Flex } from "@chakra-ui/react";
import {
  MapDrawingLayer,
  MapDrawingToolbar,
  SeguridadMapLayers,
  TacticalMap,
} from "../../modules/map";
import { CollapsibleSidePanel } from "../../components/base";
import { SeguridadHeader } from "./SeguridadHeader";
import { SeguridadRightPanel } from "./SeguridadRightPanel";
import {
  PerimeterFinalizeFloating,
  SeguridadActionToolbar,
} from "./SeguridadActionToolbar";
import {
  AccessControlModal,
  CloseStreetModal,
  EvacuationModal,
  FinalizePerimeterModal,
  IncidentModal,
} from "./SeguridadActionModals";

export const SeguridadPage = () => {
  const [evacOpen, setEvacOpen] = useState(false);
  const [perimeterFinalizeOpen, setPerimeterFinalizeOpen] = useState(false);
  // Lateral colapsado por defecto — el mapa ocupa todo el ancho al iniciar.
  const [sideOpen, setSideOpen] = useState(false);

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="#F8FAFC" overflow="hidden">
      <SeguridadHeader />

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
            <SeguridadMapLayers />
            <MapDrawingLayer scope="seguridad" />
          </TacticalMap>

          <SeguridadActionToolbar onOpenEvacuation={() => setEvacOpen(true)} />
          <PerimeterFinalizeFloating onFinalize={() => setPerimeterFinalizeOpen(true)} />
          <MapDrawingToolbar scope="seguridad" position="top-left" />
        </Box>

        <CollapsibleSidePanel
          isOpen={sideOpen}
          onToggle={() => setSideOpen((v) => !v)}
          width="340px"
          label="Operación"
        >
          <SeguridadRightPanel />
        </CollapsibleSidePanel>
      </Flex>

      <CloseStreetModal />
      <AccessControlModal />
      <IncidentModal />
      <FinalizePerimeterModal
        isOpen={perimeterFinalizeOpen}
        onClose={() => setPerimeterFinalizeOpen(false)}
      />
      <EvacuationModal isOpen={evacOpen} onClose={() => setEvacOpen(false)} />
    </Flex>
  );
};
