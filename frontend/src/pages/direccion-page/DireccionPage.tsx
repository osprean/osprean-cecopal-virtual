import { useState } from "react";
import { Box, Flex, HStack, Icon, Text, Tooltip } from "@chakra-ui/react";
import {
  MdNotificationsActive,
  MdPlaylistAddCheck,
  MdReportProblem,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  DireccionMapLayers,
  MapDrawingLayer,
  MapDrawingToolbar,
  TacticalMap,
} from "../../modules/map";
import { CollapsibleSidePanel } from "../../components/base";
import { useFakeRealtime } from "../../hooks/useFakeRealtime";
import {
  selectPendingMediaCount,
  useAlertsStore,
  useDireccionStore,
  useIncidentsStore,
} from "../../store";
import { DireccionHeader } from "./DireccionHeader";
import { DireccionRightPanel } from "./DireccionRightPanel";
import { DireccionMapOverlay } from "./DireccionMapOverlay";

export const DireccionPage = () => {
  useFakeRealtime({ intervalMs: 5500 });
  const [sideOpen, setSideOpen] = useState(false);

  // Conteos para los badges en modo colapsado.
  const unackAlerts = useAlertsStore(
    (s) => s.alerts.filter((a) => !a.acknowledged).length,
  );
  const pendingMedia = useDireccionStore(selectPendingMediaCount);
  const openIncidents = useIncidentsStore(
    (s) => s.incidents.filter((i) => i.status === "active" || i.status === "monitoring").length,
  );

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="#F8FAFC" overflow="hidden">
      <DireccionHeader />

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
            <DireccionMapLayers />
            <MapDrawingLayer scope="direccion" />
          </TacticalMap>
          <DireccionMapOverlay />
          <MapDrawingToolbar scope="direccion" position="top-left" />
        </Box>

        <CollapsibleSidePanel
          isOpen={sideOpen}
          onToggle={() => setSideOpen((v) => !v)}
          width="400px"
          label="Operación"
          collapsedBadges={
            <>
              <CollapsedBadge
                icon={MdNotificationsActive}
                label="ALR"
                count={unackAlerts}
                tone="critical"
              />
              <CollapsedBadge
                icon={MdPlaylistAddCheck}
                label="SOL"
                count={pendingMedia}
                tone="alert"
              />
              <CollapsedBadge
                icon={MdReportProblem}
                label="INC"
                count={openIncidents}
                tone="pending"
              />
            </>
          }
        >
          <DireccionRightPanel />
        </CollapsibleSidePanel>
      </Flex>
    </Flex>
  );
};

// Badge compacto para el modo colapsado: icono + nº con dot de color.
const CollapsedBadge = ({
  icon,
  label,
  count,
  tone,
}: {
  icon: IconType;
  label: string;
  count: number;
  tone: "critical" | "alert" | "pending";
}) => {
  const hasCount = count > 0;
  return (
    <Tooltip label={`${label} · ${count}`} placement="left" hasArrow openDelay={250}>
      <HStack
        spacing={0.5}
        position="relative"
        w="28px"
        h="28px"
        borderRadius="md"
        bg={hasCount ? `state.${tone}Soft` : "bg.panelSubtle"}
        border="1px solid"
        borderColor={hasCount ? `state.${tone}` : "gray.100"}
        justify="center"
        align="center"
      >
        <Icon as={icon} boxSize={3.5} color={hasCount ? `state.${tone}` : "text.muted"} />
        {hasCount && (
          <Box
            position="absolute"
            top="-4px"
            right="-4px"
            minW="16px"
            h="16px"
            px={1}
            borderRadius="full"
            bg={`state.${tone}`}
            color="white"
            fontSize="9px"
            fontWeight={900}
            fontFamily="mono"
            display="flex"
            alignItems="center"
            justifyContent="center"
            border="2px solid white"
          >
            {count > 99 ? "99+" : count}
          </Box>
        )}
        {/* Se necesita un nodo Text invisible para que el Tooltip funcione */}
        <Text as="span" display="none">{label}</Text>
      </HStack>
    </Tooltip>
  );
};
