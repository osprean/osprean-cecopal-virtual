import {
  Box,
  Flex,
  HStack,
  Progress,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AnimatePresence } from "framer-motion";
import {
  MdLocalHospital,
  MdLocalShipping,
  MdMedicalServices,
  MdPersonAddAlt,
  MdReportGmailerrorred,
} from "react-icons/md";
import {
  RealtimeNotification,
  StatusBadge,
  TacticalCard,
  TacticalPanel,
} from "../../components/base";
import { useSanitarioStore } from "../../store";
import { formatTime } from "../../utils";
import type {
  AmbulanceState,
  OperationalState,
  TriageColor,
} from "../../types";
import { TRIAGE_LABEL } from "../../types";

const TRIAGE_TONE: Record<TriageColor, OperationalState> = {
  red: "critical",
  yellow: "pending",
  green: "operational",
  black: "offline",
  unset: "offline",
};

const AMB_STATE_TO_OP: Record<AmbulanceState, OperationalState> = {
  available: "operational",
  dispatched: "alert",
  "on-scene": "critical",
  transporting: "active",
  "at-hospital": "standby",
  returning: "active",
  "out-of-service": "offline",
};

export const SanitarioRightPanel = () => {
  const victims = useSanitarioStore((s) => s.victims);
  const ambulances = useSanitarioStore((s) => s.ambulances);
  const hospitals = useSanitarioStore((s) => s.hospitals);
  const alerts = useSanitarioStore((s) => s.alerts);
  const select = useSanitarioStore((s) => s.selectVictim);
  const ackAlert = useSanitarioStore((s) => s.acknowledgeAlert);

  const triageCounts: Record<TriageColor, number> = {
    red: 0, yellow: 0, green: 0, black: 0, unset: 0,
  };
  victims.forEach((v) => { triageCounts[v.triage]++; });

  return (
    <Flex direction="column" h="100%" w="100%" bg="white" minH={0}>
      <Box flex="1" minH={0} overflowY="auto" p={{ base: 3, md: 4, lg: 5 }}>
        <VStack spacing={3} align="stretch">
          {/* TRIAGE SUMMARY */}
          <TacticalPanel title="Triaje en escena" icon={MdMedicalServices} state="critical" code={`${victims.length}`}>
            <VStack spacing={2} align="stretch">
              {(["red", "yellow", "green", "black"] as TriageColor[]).map((c) => (
                <Flex
                  key={c}
                  align="center"
                  gap={2}
                  px={2.5}
                  py={2}
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderLeft="3px solid"
                  borderLeftColor={`state.${TRIAGE_TONE[c]}`}
                  borderRadius="lg"
                >
                  <Box w="14px" h="14px" borderRadius="3px" bg={`state.${TRIAGE_TONE[c]}`} flexShrink={0} />
                  <Text fontSize="11px" color="text.primary" fontWeight={800} flex="1">
                    {TRIAGE_LABEL[c]}
                  </Text>
                  <Text fontSize="14px" fontFamily="mono" fontWeight={900} color={`state.${TRIAGE_TONE[c]}`}>
                    {triageCounts[c]}
                  </Text>
                </Flex>
              ))}
            </VStack>
          </TacticalPanel>

          {/* HOSPITAL STATUS */}
          <TacticalPanel title="Hospitales" icon={MdLocalHospital} state="active" code={`${hospitals.length}`}>
            <VStack spacing={3} align="stretch">
              {hospitals.map((h) => {
                const usedRatio = 1 - h.beds.available / h.beds.total;
                const tone: OperationalState =
                  usedRatio >= 0.9 ? "critical" : usedRatio >= 0.7 ? "alert" : "operational";
                return (
                  <Box
                    key={h.id}
                    p={2.5}
                    bg="bg.panelSubtle"
                    border="1px solid"
                    borderColor="border.subtle"
                    borderLeft="3px solid"
                    borderLeftColor={`state.${tone}`}
                    borderRadius="lg"
                  >
                    <Flex justify="space-between" align="baseline" mb={1}>
                      <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>
                        {h.name}
                      </Text>
                      <StatusBadge state={tone} size="xs" label={`${Math.round(usedRatio * 100)}%`} />
                    </Flex>
                    <Progress
                      value={usedRatio * 100}
                      size="xs"
                      colorScheme={usedRatio >= 0.9 ? "red" : usedRatio >= 0.7 ? "orange" : "green"}
                      borderRadius="full"
                      bg="white"
                    />
                    <HStack spacing={3} mt={1.5}>
                      <Text fontSize="10px" fontFamily="mono" color="text.muted">
                        UCI {h.red.current}/{h.red.capacity}
                      </Text>
                      <Text fontSize="10px" fontFamily="mono" color="text.muted">
                        AMB {h.yellow.current}/{h.yellow.capacity}
                      </Text>
                      <Text fontSize="10px" fontFamily="mono" color="text.muted">
                        QUIRÓF {h.surgeryRooms.available}/{h.surgeryRooms.total}
                      </Text>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          </TacticalPanel>

          {/* AMBULANCES */}
          <TacticalPanel title="Ambulancias" icon={MdLocalShipping} state="active" code={`${ambulances.length}`}>
            <VStack spacing={1.5} align="stretch">
              {ambulances.map((a) => (
                <Flex
                  key={a.id}
                  align="center"
                  gap={2}
                  px={2}
                  py={1.5}
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderLeft="3px solid"
                  borderLeftColor={`state.${AMB_STATE_TO_OP[a.state]}`}
                  borderRadius="md"
                >
                  <Text fontSize="11px" fontFamily="mono" fontWeight={800} color="text.primary" minW="80px" noOfLines={1}>
                    {a.callSign}
                  </Text>
                  <Text fontSize="10px" color="text.muted" letterSpacing="wider" minW="36px" fontWeight={700}>
                    {a.kind}
                  </Text>
                  <Text fontSize="10px" color="text.secondary" flex="1" noOfLines={1}>
                    {a.assignedVictimId ? `→ ${victims.find((v) => v.id === a.assignedVictimId)?.code ?? "—"}` : "—"}
                  </Text>
                  {a.etaMinutes != null && (
                    <Text fontSize="10px" fontFamily="mono" color="state.active" fontWeight={800}>
                      ETA {a.etaMinutes}'
                    </Text>
                  )}
                  <StatusBadge state={AMB_STATE_TO_OP[a.state]} size="xs" label={a.state.replace("-", " ").toUpperCase()} />
                </Flex>
              ))}
            </VStack>
          </TacticalPanel>

          {/* VICTIMS LIST (clickable) */}
          <TacticalPanel title="Víctimas registradas" icon={MdPersonAddAlt} state="alert" code={`${victims.length}`}>
            <VStack spacing={1.5} align="stretch">
              {victims.map((v) => (
                <TacticalCard
                  key={v.id}
                  state={TRIAGE_TONE[v.triage]}
                  title={`${v.code} · ${v.injuries ?? "—"}`}
                  meta={formatTime(v.updatedAt)}
                  onSelect={() => select(v.id)}
                  rightBadge={
                    <StatusBadge state={TRIAGE_TONE[v.triage]} size="xs" label={v.triage.toUpperCase()} />
                  }
                  dense
                  footer={
                    <Text fontSize="10px" color="text.muted" letterSpacing="wider" fontWeight={700} textTransform="uppercase">
                      {v.status.replace("-", " ")}
                      {v.assignedAmbulanceId && ` · ${ambulances.find((a) => a.id === v.assignedAmbulanceId)?.callSign}`}
                    </Text>
                  }
                />
              ))}
            </VStack>
          </TacticalPanel>

          {/* SANITARY ALERTS */}
          <TacticalPanel title="Alertas sanitarias" icon={MdReportGmailerrorred} state="critical">
            <VStack spacing={2} align="stretch">
              <AnimatePresence>
                {alerts.map((a) => (
                  <RealtimeNotification
                    key={a.id}
                    state={a.severity === "critical" ? "critical" : a.severity === "high" ? "alert" : a.severity === "medium" ? "pending" : "active"}
                    title={a.source}
                    message={a.message}
                    timestamp={formatTime(a.createdAt)}
                    category={a.severity.toUpperCase()}
                    unread={!a.acknowledged}
                    onOpen={() => ackAlert(a.id)}
                  />
                ))}
              </AnimatePresence>
            </VStack>
          </TacticalPanel>

          {/* Actividad reciente eliminado: ahora vive en el Historial global del header */}
        </VStack>
      </Box>
    </Flex>
  );
};
