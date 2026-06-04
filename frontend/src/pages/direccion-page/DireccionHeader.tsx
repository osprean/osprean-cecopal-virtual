import { useState } from "react";
import { Box, Flex, HStack, Icon, Text, Tooltip, VStack } from "@chakra-ui/react";
import {
  MdLocalFireDepartment,
  MdWaterDrop,
  MdMedicalServices,
  MdPublic,
  MdScience,
  MdShield,
  MdHelpCenter,
  MdCarCrash,
  MdAccessTime,
  MdLocationOn,
  MdOutlineLocalActivity,
  MdTrendingUp,
  MdSend,
  MdSupportAgent,
  MdStopCircle,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  AlertBadge,
  TacticalButton,
} from "../../components/base";
import { useTacticalClock } from "../../hooks";
import {
  selectActiveEmergency,
  selectPendingCommuniqueCount,
  selectPendingMediaCount,
  useDireccionStore,
  useEmergencyStore,
} from "../../store";
import { OPERATIONAL_LEVEL_LABEL } from "../../types";
import type { EmergencyDomain, OperationalState } from "../../types";
import {
  ApproveCommuniqueModal,
  CloseEmergencyModal,
  EscalateLevelModal,
  RequestSupportModal,
} from "./EmergencyActionModals";

const DOMAIN_ICON: Record<EmergencyDomain, IconType> = {
  fire: MdLocalFireDepartment,
  flood: MdWaterDrop,
  medical: MdMedicalServices,
  seismic: MdPublic,
  chemical: MdScience,
  security: MdShield,
  "traffic-accident": MdCarCrash,
  other: MdHelpCenter,
};

const DOMAIN_LABEL: Record<EmergencyDomain, string> = {
  fire: "INCENDIO FORESTAL",
  flood: "INUNDACIÓN",
  medical: "EMERGENCIA SANITARIA",
  seismic: "SÍSMICO",
  chemical: "QUÍMICO/NRBQ",
  security: "SEGURIDAD",
  "traffic-accident": "ACCIDENTE DE TRÁFICO",
  other: "OTRO",
};

const formatElapsed = (startIso: string | null, now: Date): string => {
  if (!startIso) return "00:00:00";
  const ms = Math.max(0, now.getTime() - new Date(startIso).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const LEVEL_COLOR_TOKEN: Record<number, OperationalState> = {
  0: "standby",
  1: "active",
  2: "alert",
  3: "critical",
};

type ActiveModal = null | "escalate" | "communique" | "support" | "close";

export const DireccionHeader = () => {
  const emergency = useEmergencyStore(selectActiveEmergency);
  const level = useDireccionStore((s) => s.level);
  const activatedAt = useDireccionStore((s) => s.activatedAt);
  const closedAt = useDireccionStore((s) => s.closedAt);
  const activate = useDireccionStore((s) => s.activate);
  const pendingMedia = useDireccionStore(selectPendingMediaCount);
  const pendingComms = useDireccionStore(selectPendingCommuniqueCount);
  const now = useTacticalClock(1000);
  const [modal, setModal] = useState<ActiveModal>(null);

  if (!emergency) {
    return (
      <Box
        minH={{ base: "56px", md: "72px", lg: "96px" }}
        px={{ base: 3, md: 4 }}
        display="flex"
        alignItems="center"
        bg="bg.panel"
        borderBottom="1px solid"
        borderColor="border.strong"
      >
        <Text fontSize="sm" color="text.muted" letterSpacing="wider" textTransform="uppercase">
          No hay emergencia activa
        </Text>
      </Box>
    );
  }

  const DomainIcon = DOMAIN_ICON[emergency.domain];
  const elapsed = formatElapsed(activatedAt, now);
  const isInactive = !activatedAt || !!closedAt;
  const levelState = LEVEL_COLOR_TOKEN[level] ?? "active";

  return (
    <>
      <Box
        px={{ base: 3, md: 4, lg: 5 }}
        py={2}
        bg="bg.panel"
        borderBottom="1px solid"
        borderColor="border.strong"
        flexShrink={0}
      >
        <Flex align="center" gap={{ base: 2, md: 3, lg: 4 }} flexWrap={{ base: "wrap", xl: "nowrap" }}>
          <Tooltip
            hasArrow
            placement="bottom-start"
            bg="bg.panel"
            color="text.primary"
            border="1px solid"
            borderColor="border.strong"
            borderRadius="md"
            p={3}
            label={
              <VStack align="start" spacing={1} minW="220px">
                <HStack spacing={2}>
                  <Text fontSize="9px" fontWeight={900} letterSpacing="widest" color="state.critical" textTransform="uppercase">
                    {DOMAIN_LABEL[emergency.domain]}
                  </Text>
                  <Text fontSize="9px" color="text.muted" fontFamily="mono" letterSpacing="wider">
                    · {emergency.code}
                  </Text>
                </HStack>
                <Text fontSize="sm" fontWeight={800} color="text.primary" letterSpacing="tight" lineHeight="1.2">
                  {emergency.name}
                </Text>
                <HStack spacing={1.5} pt={0.5}>
                  <Icon as={MdLocationOn} color="text.muted" boxSize={3} />
                  <Text fontSize="11px" color="text.secondary" fontWeight={600}>
                    {emergency.responsibleAgency} · PMA {emergency.commandPost}
                  </Text>
                </HStack>
              </VStack>
            }
          >
            <Box
              w={{ base: "40px", md: "48px", lg: "52px" }}
              h={{ base: "40px", md: "48px", lg: "52px" }}
              bg="state.criticalSoft"
              border="1.5px solid"
              borderColor="state.critical"
              borderRadius={12}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
              cursor="pointer"
            >
              <Icon as={DomainIcon} color="state.critical" boxSize={{ base: 5, lg: 6 }} />
            </Box>
          </Tooltip>

          {/* Status group (nivel + tiempo activo) — entre icono y botones */}
          <HStack spacing={{ base: 2, md: 3 }} flexShrink={0} align="stretch">
            <StatBlock
              label="Nivel"
              value={String(level)}
              sub={OPERATIONAL_LEVEL_LABEL[level].split("—")[1]?.trim() ?? OPERATIONAL_LEVEL_LABEL[level]}
              state={levelState}
              mono
            />
            <StatBlock
              label="Tiempo activo"
              value={elapsed}
              icon={MdAccessTime}
              state="active"
              mono
              wide
            />
          </HStack>

          <Box flex={{ base: "1 1 100%", xl: "1" }} display={{ base: "none", xl: "block" }} />

          {/* Action buttons — al final. En móvil ocupan línea propia con wrap. */}
          <HStack
            spacing={{ base: 2, md: 2.5, lg: 3 }}
            flexShrink={0}
            flexWrap="wrap"
            justify={{ base: "flex-start", xl: "flex-end" }}
            w={{ base: "100%", xl: "auto" }}
            mt={{ base: 1, xl: 0 }}
          >
            {isInactive ? (
              <TacticalButton
                size="sm"
                variant="tactical-primary"
                icon={MdOutlineLocalActivity}
                onClick={() => activate("Director Plan")}
              >
                Activar
              </TacticalButton>
            ) : (
              <TacticalButton
                size="sm"
                variant="tactical-warning"
                icon={MdTrendingUp}
                onClick={() => setModal("escalate")}
              >
                Escalar
              </TacticalButton>
            )}
            <Box position="relative">
              <TacticalButton size="sm" variant="tactical" icon={MdSend} onClick={() => setModal("communique")}>
                Comunicado
              </TacticalButton>
              {pendingComms > 0 && (
                <Box position="absolute" top="-6px" right="-6px">
                  <AlertBadge count={pendingComms} state="pending" size="sm" />
                </Box>
              )}
            </Box>
            <Box position="relative">
              <TacticalButton size="sm" variant="tactical" icon={MdSupportAgent} onClick={() => setModal("support")}>
                Apoyo
              </TacticalButton>
              {pendingMedia > 0 && (
                <Box position="absolute" top="-6px" right="-6px">
                  <AlertBadge count={pendingMedia} state="alert" size="sm" />
                </Box>
              )}
            </Box>
            <TacticalButton
              size="sm"
              variant="tactical-danger"
              icon={MdStopCircle}
              onClick={() => setModal("close")}
              isDisabled={isInactive}
            >
              Finalizar
            </TacticalButton>
          </HStack>
        </Flex>
      </Box>

      <EscalateLevelModal isOpen={modal === "escalate"} onClose={() => setModal(null)} />
      <ApproveCommuniqueModal isOpen={modal === "communique"} onClose={() => setModal(null)} />
      <RequestSupportModal isOpen={modal === "support"} onClose={() => setModal(null)} />
      <CloseEmergencyModal isOpen={modal === "close"} onClose={() => setModal(null)} />
    </>
  );
};

const StatBlock = ({
  label,
  value,
  sub,
  icon,
  state,
  mono,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: IconType;
  state: OperationalState;
  mono?: boolean;
  wide?: boolean;
}) => (
  <Box
    h={{ base: "44px", md: "48px", lg: "52px" }}
    px={{ base: 2, md: 3 }}
    py={1}
    borderRadius="lg"
    border="1px solid"
    borderColor="border.subtle"
    bg="bg.panelSubtle"
    borderLeft="3px solid"
    borderLeftColor={`state.${state}`}
    minW={wide ? { base: "120px", lg: "150px" } : { base: "70px", lg: "90px" }}
    display="flex"
    flexDirection="column"
    justifyContent="center"
    gap={0}
  >
    <HStack spacing={1.5}>
      {icon && <Icon as={icon} boxSize={2.5} color={`state.${state}`} />}
      <Text fontSize="9px" letterSpacing="widest" color="text.label" fontWeight={900} textTransform="uppercase">
        {label}
      </Text>
    </HStack>
    <HStack spacing={2} align="baseline">
      <Text fontSize={mono ? "lg" : "md"} fontFamily={mono ? "mono" : "heading"} fontWeight={800} color={`state.${state}`} lineHeight="1.1">
        {value}
      </Text>
      {sub && (
        <Text fontSize="9px" color="text.muted" fontWeight={700} letterSpacing="wider" textTransform="uppercase" noOfLines={1}>
          {sub}
        </Text>
      )}
    </HStack>
  </Box>
);
