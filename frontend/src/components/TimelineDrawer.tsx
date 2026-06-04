import {
  Box,
  Circle,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MdChevronRight,
  MdClose,
  MdHistory,
  MdGavel,
  MdShield,
  MdMedicalServices,
  MdInventory2,
  MdNotificationsActive,
  MdViewList,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  useDireccionStore,
  useLogisticaStore,
  useRealtimeStore,
  useSanitarioStore,
  useSeguridadStore,
} from "../store";
import { formatDateTime, timeAgo } from "../utils";
import type { OperationalState } from "../types";
import { StatusBadge } from "./base";
import { useTimelineStore, type TimelineSource } from "./timelineStore";

interface TimelineRow {
  id: string;
  source: Exclude<TimelineSource, "general">;
  title: string;
  message: string;
  performedBy?: string;
  timestamp: string;
  state: OperationalState;
}

const SOURCE_LABEL: Record<Exclude<TimelineSource, "general">, string> = {
  direccion: "DIRECCIÓN",
  seguridad: "SEGURIDAD",
  sanitario: "SANITARIO",
  logistica: "LOGÍSTICA",
  realtime: "REALTIME",
};

const SOURCE_ICON: Record<TimelineSource, IconType> = {
  general: MdViewList,
  direccion: MdGavel,
  seguridad: MdShield,
  sanitario: MdMedicalServices,
  logistica: MdInventory2,
  realtime: MdNotificationsActive,
};

const SOURCE_TONE: Record<Exclude<TimelineSource, "general">, OperationalState> = {
  direccion: "active",
  seguridad: "alert",
  sanitario: "critical",
  logistica: "active",
  realtime: "operational",
};

const TABS: { key: TimelineSource; label: string }[] = [
  { key: "general", label: "General" },
  { key: "direccion", label: "Dirección" },
  { key: "seguridad", label: "Seguridad" },
  { key: "sanitario", label: "Sanitario" },
  { key: "logistica", label: "Logística" },
  { key: "realtime", label: "Realtime" },
];

export const TimelineDrawer = () => {
  const open = useTimelineStore((s) => s.open);
  const setOpen = useTimelineStore((s) => s.setOpen);
  const activeSource = useTimelineStore((s) => s.activeSource);
  const setActiveSource = useTimelineStore((s) => s.setActiveSource);
  // En móvil/tablet portrait el drawer ocupa toda la pantalla (overlay).
  // A partir de lg (tablet landscape / laptop) vuelve a su modo lateral.
  const isCompact = useBreakpointValue(
    { base: true, lg: false },
    { fallback: "lg" },
  );

  const direccionActions = useDireccionStore((s) => s.actions);
  const segActivities = useSeguridadStore((s) => s.activities);
  const sanActivities = useSanitarioStore((s) => s.activities);
  const logActivities = useLogisticaStore((s) => s.activities);
  const realtimeEvents = useRealtimeStore((s) => s.events);

  const allRows: TimelineRow[] = [
    ...direccionActions.map<TimelineRow>((a) => ({
      id: `dir-${a.id}`,
      source: "direccion",
      title: a.type.replace(/-/g, " ").toUpperCase(),
      message: a.notes ?? a.performedBy,
      performedBy: a.performedBy,
      timestamp: a.timestamp,
      state:
        a.type === "level-escalated"
          ? "alert"
          : a.type === "closed"
            ? "operational"
            : a.type === "support-requested"
              ? "pending"
              : "active",
    })),
    ...segActivities.map<TimelineRow>((a) => ({
      id: `seg-${a.id}`,
      source: "seguridad",
      title: a.type.replace(/-/g, " ").toUpperCase(),
      message: a.message,
      performedBy: a.performedBy,
      timestamp: a.timestamp,
      state:
        a.type === "street-closed" || a.type === "perimeter-created"
          ? "alert"
          : a.type === "perimeter-lifted" || a.type === "street-opened"
            ? "operational"
            : "active",
    })),
    ...sanActivities.map<TimelineRow>((a) => ({
      id: `san-${a.id}`,
      source: "sanitario",
      title: a.type.replace(/-/g, " ").toUpperCase(),
      message: a.message,
      performedBy: a.performedBy,
      timestamp: a.timestamp,
      state:
        a.type === "alert-raised" || a.type === "hospital-saturation"
          ? "critical"
          : a.type === "victim-evacuated"
            ? "operational"
            : "active",
    })),
    ...logActivities.map<TimelineRow>((a) => ({
      id: `log-${a.id}`,
      source: "logistica",
      title: a.type.replace(/-/g, " ").toUpperCase(),
      message: a.message,
      performedBy: a.performedBy,
      timestamp: a.timestamp,
      state:
        a.type === "request-denied"
          ? "critical"
          : a.type === "request-delivered"
            ? "operational"
            : a.type === "request-created"
              ? "alert"
              : "active",
    })),
    ...realtimeEvents.map<TimelineRow>((e) => ({
      id: `rt-${e.id}`,
      source: "realtime",
      title: e.type.toUpperCase(),
      message: e.message,
      timestamp: e.timestamp,
      state:
        e.level === "critical"
          ? "critical"
          : e.level === "high"
            ? "alert"
            : e.level === "medium"
              ? "pending"
              : "active",
    })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const rows =
    activeSource === "general"
      ? allRows
      : allRows.filter((r) => r.source === activeSource);

  const counts = TABS.reduce<Record<TimelineSource, number>>(
    (acc, t) => {
      acc[t.key] =
        t.key === "general"
          ? allRows.length
          : allRows.filter((r) => r.source === t.key).length;
      return acc;
    },
    {} as Record<TimelineSource, number>,
  );

  return (
    <AnimatePresence initial={false}>
      {open && (
        <MotionPanelShell key="timeline-panel" isCompact={Boolean(isCompact)}>
          {/* Header */}
          <Flex
            align="center"
            h={{ base: "52px", md: "48px" }}
            px={{ base: 3, md: 4 }}
            borderBottom="1px solid"
            borderColor="border.subtle"
            bg="white"
            flexShrink={0}
            gap={2}
          >
            <Icon as={MdHistory} color="accent.teal" boxSize={4} />
            <Text
              fontSize="11px"
              fontWeight={900}
              letterSpacing="widest"
              textTransform="uppercase"
              color="text.primary"
            >
              Historial
            </Text>
            <Text fontSize="9px" fontFamily="mono" color="text.muted" letterSpacing="wider" noOfLines={1}>
              · {rows.length} ev.
            </Text>
            <Box flex="1" />
            <Tooltip label="Cerrar panel" placement="bottom" hasArrow openDelay={250}>
              <IconButton
                aria-label="Cerrar Historial"
                size={isCompact ? "sm" : "xs"}
                variant="ghost"
                color="text.primary"
                icon={<Icon as={isCompact ? MdClose : MdChevronRight} boxSize={isCompact ? 5 : 4} />}
                onClick={() => setOpen(false)}
                _hover={{ bg: "bg.panelSubtle", color: "accent.teal" }}
              />
            </Tooltip>
          </Flex>

          {/* Pestañas de filtro */}
          <Box
            px={3}
            py={2}
            borderBottom="1px solid"
            borderColor="border.subtle"
            bg="white"
            flexShrink={0}
            overflowX="auto"
            sx={{
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            <HStack spacing={1.5}>
              {TABS.map((tab) => {
                const active = tab.key === activeSource;
                const TabIcon = SOURCE_ICON[tab.key];
                return (
                  <Box
                    key={tab.key}
                    as="button"
                    onClick={() => setActiveSource(tab.key)}
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                    px={2.5}
                    py={1.5}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={active ? "accent.teal" : "border.subtle"}
                    bg={active ? "white" : "transparent"}
                    color={active ? "accent.tealDeep" : "text.muted"}
                    transition="all 0.12s ease"
                    flexShrink={0}
                    _hover={
                      active
                        ? {}
                        : {
                            bg: "white",
                            color: "text.primary",
                            borderColor: "border.subtle",
                          }
                    }
                  >
                    <Icon as={TabIcon} boxSize={3.5} />
                    <Text
                      fontSize="10px"
                      fontWeight={800}
                      letterSpacing="wider"
                      textTransform="uppercase"
                    >
                      {tab.label}
                    </Text>
                    <Text
                      fontSize="9px"
                      fontFamily="mono"
                      color={active ? "accent.teal" : "text.muted"}
                      fontWeight={700}
                    >
                      {counts[tab.key]}
                    </Text>
                  </Box>
                );
              })}
            </HStack>
          </Box>

          {/* Cuerpo */}
          <Box flex="1" overflowY="auto" p={3} bg="white">
            {rows.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                h="100%"
                px={6}
                py={10}
                gap={2}
              >
                <Icon as={MdHistory} boxSize={8} color="text.muted" opacity={0.5} />
                <Text fontSize="12px" color="text.muted" textAlign="center">
                  Sin eventos en esta vista.
                </Text>
              </Flex>
            ) : (
              <Box position="relative" pl={1}>
                <Box position="absolute" left="11px" top={2} bottom={2} w="2px" bg="border.subtle" />
                <VStack spacing={0} align="stretch">
                  {rows.map((r) => (
                    <HStack key={r.id} align="start" spacing={3} py={2} position="relative">
                      <Circle
                        size="22px"
                        bg={`state.${r.state}`}
                        border="2px solid"
                        borderColor="white"
                        flexShrink={0}
                        boxShadow={`0 0 0 1px var(--chakra-colors-state-${r.state})`}
                      >
                        <Icon as={SOURCE_ICON[r.source]} color="white" boxSize="11px" />
                      </Circle>
                      <Box flex="1" minW={0}>
                        <Flex justify="space-between" align="baseline" gap={2}>
                          <HStack spacing={1.5} minW={0}>
                            <StatusBadge
                              state={SOURCE_TONE[r.source]}
                              size="xs"
                              variant="subtle"
                              label={SOURCE_LABEL[r.source]}
                            />
                            <Text
                              fontSize="10px"
                              color="text.muted"
                              fontFamily="mono"
                              letterSpacing="wider"
                              noOfLines={1}
                            >
                              {r.title}
                            </Text>
                          </HStack>
                          <Text fontSize="10px" color="text.muted" fontFamily="mono" flexShrink={0}>
                            {timeAgo(r.timestamp)}
                          </Text>
                        </Flex>
                        <Text
                          fontSize="11px"
                          color="text.primary"
                          fontWeight={600}
                          mt={0.5}
                          lineHeight="short"
                        >
                          {r.message}
                        </Text>
                        <HStack spacing={2} mt={0.5}>
                          {r.performedBy && (
                            <Text
                              fontSize="9px"
                              color="text.muted"
                              letterSpacing="wider"
                              textTransform="uppercase"
                              fontWeight={700}
                            >
                              {r.performedBy}
                            </Text>
                          )}
                          <Text fontSize="9px" color="text.muted" fontFamily="mono">
                            {formatDateTime(r.timestamp)}
                          </Text>
                        </HStack>
                      </Box>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}
          </Box>
        </MotionPanelShell>
      )}
    </AnimatePresence>
  );
};

const MotionBox = motion(Box);

interface MotionPanelShellProps {
  children: React.ReactNode;
  isCompact: boolean;
}

const MotionPanelShell = ({ children, isCompact }: MotionPanelShellProps) => {
  if (isCompact) {
    // Overlay full-screen para móvil/tablet portrait: anclado a la derecha del
    // contenido principal, ocupa todo el alto y todo el ancho disponibles.
    return (
      <MotionBox
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        // zIndex 1200 para superar los controles de Leaflet (≤1000) y el
        // backdrop (1100).
        zIndex={1200}
        bg="white"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        {children}
      </MotionBox>
    );
  }
  return (
    <MotionBox
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 432, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      h="100%"
      py={3}
      px={3}
      flexShrink={0}
      position="relative"
      overflow="hidden"
    >
      <Flex
        direction="column"
        w={{ md: "360px", lg: "408px" }}
        h="100%"
        bg="white"
        borderRadius="2xl"
        border="1px solid"
        borderColor="gray.100"
        boxShadow="xl"
        overflow="hidden"
        position="relative"
      >
        {children}
      </Flex>
    </MotionBox>
  );
};
