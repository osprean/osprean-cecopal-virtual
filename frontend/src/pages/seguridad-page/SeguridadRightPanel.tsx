import {
  Box,
  Divider,
  Flex,
  HStack,
  Icon,
  Progress,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  MdDirectionsRun,
  MdLockOpen,
  MdLock,
  MdShield,
  MdReportProblem,
} from "react-icons/md";
import {
  StatusBadge,
  TacticalButton,
  TacticalPanel,
} from "../../components/base";
import {
  selectActivePerimeters,
  useDireccionStore,
  useSeguridadStore,
} from "../../store";
import type {
  AccessControlState,
  OperationalState,
  PerimeterKind,
} from "../../types";
import { PERIMETER_LABEL } from "../../types";

const ACCESS_STATE_TO_OP: Record<AccessControlState, OperationalState> = {
  open: "operational",
  restricted: "alert",
  closed: "critical",
};

const PERIMETER_KIND_STATE: Record<PerimeterKind, OperationalState> = {
  exclusion: "critical",
  evacuation: "alert",
  safety: "pending",
  buffer: "active",
};

export const SeguridadRightPanel = () => {
  const evacuations = useDireccionStore((s) => s.evacuations);
  const shelters = useDireccionStore((s) => s.shelters);
  const accessControls = useSeguridadStore((s) => s.accessControls);
  const setAccessState = useSeguridadStore((s) => s.setAccessState);
  const perimeters = useSeguridadStore(selectActivePerimeters);
  const liftPerimeter = useSeguridadStore((s) => s.liftPerimeter);

  const totalEvacuated = evacuations.reduce((acc, e) => acc + e.evacuatedPeople, 0);
  const totalEstimated = evacuations.reduce((acc, e) => acc + e.estimatedPeople, 0);
  const sheltersOcc = shelters.reduce((acc, s) => acc + s.occupancy, 0);
  const sheltersCap = shelters.reduce((acc, s) => acc + s.capacity, 0);

  return (
    <Flex direction="column" h="100%" w="100%" bg="white" minH={0}>
      <Box flex="1" minH={0} overflowY="auto" p={{ base: 3, md: 4, lg: 5 }}>
        <VStack spacing={3} align="stretch">
          {/* EVACUADOS */}
          <TacticalPanel title="Evacuados" icon={MdDirectionsRun} state="alert" code={`${totalEvacuated}/${totalEstimated}`}>
            <VStack spacing={3} align="stretch">
              <Box>
                <HStack justify="space-between" mb={1}>
                  <Text fontSize="11px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase">
                    Avance evacuación
                  </Text>
                  <Text fontSize="13px" fontFamily="mono" fontWeight={800} color="state.alert">
                    {totalEstimated > 0 ? Math.round((totalEvacuated / totalEstimated) * 100) : 0}%
                  </Text>
                </HStack>
                <Progress
                  value={totalEstimated > 0 ? (totalEvacuated / totalEstimated) * 100 : 0}
                  size="sm"
                  bg="white"
                  colorScheme="orange"
                  hasStripe
                  isAnimated
                  borderRadius="full"
                />
              </Box>

              {evacuations.map((ev) => (
                <Box
                  key={ev.id}
                  p={2.5}
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderLeft="3px solid"
                  borderLeftColor="state.alert"
                  borderRadius="lg"
                >
                  <Text fontSize="11px" color="text.primary" fontWeight={700} noOfLines={1}>
                    {ev.name}
                  </Text>
                  <HStack mt={1} justify="space-between">
                    <Text fontSize="10px" color="text.muted" fontFamily="mono" fontWeight={700}>
                      {ev.evacuatedPeople}/{ev.estimatedPeople}
                    </Text>
                    <StatusBadge
                      state={
                        ev.status === "in-progress"
                          ? "alert"
                          : ev.status === "completed"
                            ? "operational"
                            : "standby"
                      }
                      size="xs"
                      label={ev.status.toUpperCase()}
                    />
                  </HStack>
                </Box>
              ))}

              <Divider borderColor="border.subtle" />

              <Box>
                <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={1}>
                  Albergues activos
                </Text>
                {shelters.map((s) => {
                  const ratio = s.capacity ? s.occupancy / s.capacity : 0;
                  const state: OperationalState =
                    ratio > 0.85 ? "critical" : ratio > 0.5 ? "alert" : "operational";
                  return (
                    <Flex key={s.id} align="center" gap={2} py={1}>
                      <Box w="6px" h="6px" borderRadius="full" bg={`state.${state}`} />
                      <Text fontSize="11px" color="text.primary" fontWeight={600} flex="1" noOfLines={1}>
                        {s.name}
                      </Text>
                      <Text fontSize="10px" fontFamily="mono" color={`state.${state}`} fontWeight={800}>
                        {s.occupancy}/{s.capacity}
                      </Text>
                    </Flex>
                  );
                })}
                <Text fontSize="10px" color="text.muted" mt={2} fontFamily="mono">
                  TOTAL · {sheltersOcc}/{sheltersCap}
                </Text>
              </Box>
            </VStack>
          </TacticalPanel>

          {/* PERÍMETROS */}
          <TacticalPanel title="Perímetros" icon={MdShield} state="alert" code={`${perimeters.length}`}>
            <VStack spacing={2} align="stretch">
              {perimeters.length === 0 && (
                <Text fontSize="11px" color="text.muted" textAlign="center" py={2}>
                  Sin perímetros activos.
                </Text>
              )}
              {perimeters.map((p) => (
                <Flex
                  key={p.id}
                  p={2.5}
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderLeft="3px solid"
                  borderLeftColor={`state.${PERIMETER_KIND_STATE[p.kind]}`}
                  borderRadius="lg"
                  align="center"
                  gap={2}
                >
                  <Box flex="1" minW={0}>
                    <HStack spacing={2} mb={0.5}>
                      <Text
                        fontSize="9px"
                        fontFamily="mono"
                        fontWeight={900}
                        letterSpacing="widest"
                        color={`state.${PERIMETER_KIND_STATE[p.kind]}`}
                      >
                        {PERIMETER_LABEL[p.kind]} · NV{p.level}
                      </Text>
                    </HStack>
                    <Text fontSize="11px" color="text.primary" fontWeight={700} noOfLines={1}>
                      {p.label}
                    </Text>
                  </Box>
                  <TacticalButton
                    size="xs"
                    variant="tactical-ghost"
                    onClick={() => liftPerimeter(p.id)}
                  >
                    Levantar
                  </TacticalButton>
                </Flex>
              ))}
            </VStack>
          </TacticalPanel>

          {/* ACCESOS / CONTROLES */}
          <TacticalPanel title="Accesos / Controles" icon={MdLockOpen} state="active" code={`${accessControls.length}`}>
            <VStack spacing={1.5} align="stretch">
              {accessControls.map((ac) => (
                <Flex
                  key={ac.id}
                  align="center"
                  gap={2}
                  px={2}
                  py={1.5}
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderLeft="3px solid"
                  borderLeftColor={`state.${ACCESS_STATE_TO_OP[ac.state]}`}
                  borderRadius="md"
                >
                  <Icon
                    as={ac.kind === "checkpoint" ? MdReportProblem : ac.state === "open" ? MdLockOpen : MdLock}
                    color={`state.${ACCESS_STATE_TO_OP[ac.state]}`}
                    boxSize={3.5}
                    flexShrink={0}
                  />
                  <Box flex="1" minW={0}>
                    <Text fontSize="11px" color="text.primary" fontWeight={700} noOfLines={1}>
                      {ac.label}
                    </Text>
                    {ac.units != null && (
                      <Text fontSize="9px" color="text.muted" fontFamily="mono" letterSpacing="wider">
                        {ac.units} efect.
                      </Text>
                    )}
                  </Box>
                  <Box>
                    <Cycle3 currentState={ac.state} onChange={(next) => setAccessState(ac.id, next)} />
                  </Box>
                </Flex>
              ))}
            </VStack>
          </TacticalPanel>

          {/* Actividad reciente eliminada: vive en el Historial global del header */}
        </VStack>
      </Box>
    </Flex>
  );
};

// Tiny inline cycler for access state — taps through open → restricted → closed
const Cycle3 = ({
  currentState,
  onChange,
}: {
  currentState: AccessControlState;
  onChange: (next: AccessControlState) => void;
}) => {
  const order: AccessControlState[] = ["open", "restricted", "closed"];
  const next = order[(order.indexOf(currentState) + 1) % order.length];
  return (
    <TacticalButton size="xs" variant="tactical-ghost" onClick={() => onChange(next)}>
      <StatusBadge state={ACCESS_STATE_TO_OP[currentState]} size="xs" label={currentState.slice(0, 3).toUpperCase()} />
    </TacticalButton>
  );
};
