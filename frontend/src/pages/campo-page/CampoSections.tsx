import { useState } from "react";
import {
  Box,
  Circle,
  Divider,
  Flex,
  HStack,
  Icon,
  Image,
  Input,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  MdCheckCircle,
  MdClose,
  MdExplore,
  MdHistory,
  MdImage,
  MdLocationOn,
  MdMyLocation,
  MdNavigation,
  MdPersonPin,
  MdPlayArrow,
  MdReportProblem,
  MdSos,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  StatusBadge,
  TacticalButton,
  TacticalModal,
  TacticalPanel,
} from "../../components/base";
import {
  selectActiveTask,
  selectIncomingTasks,
  useCampoStore,
} from "../../store";
import { formatTime, timeAgo } from "../../utils";
import {
  FIELD_STATE_LABEL,
  type FieldReportKind,
  type FieldTaskPriority,
  type FieldTaskStatus,
  type FieldUnitState,
  type OperationalState,
} from "../../types";

const STATE_TONE: Record<FieldUnitState, OperationalState> = {
  available: "operational",
  busy: "alert",
  "en-route": "active",
  "support-requested": "critical",
  "off-duty": "offline",
};

const PRIORITY_TONE: Record<FieldTaskPriority, OperationalState> = {
  critical: "critical",
  high: "alert",
  medium: "pending",
  low: "active",
};

const TASK_TONE: Record<FieldTaskStatus, OperationalState> = {
  incoming: "alert",
  accepted: "active",
  "on-scene": "alert",
  completed: "operational",
  cancelled: "offline",
};

const REPORT_ICON: Record<FieldReportKind, IconType> = {
  incident: MdReportProblem,
  voice: MdHistory,
  image: MdImage,
  checkpoint: MdLocationOn,
  support: MdSos,
};

// =============================
// FIELD STATUS — large pill at top
// =============================
export const FieldStatusCard = () => {
  const unit = useCampoStore((s) => s.unit);
  const setState = useCampoStore((s) => s.setUnitState);
  const tone = STATE_TONE[unit.state];
  const states: FieldUnitState[] = ["available", "busy", "en-route", "support-requested", "off-duty"];

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="3xl"
      p={4}
      boxShadow="0 6px 20px rgba(15,22,36,0.08)"
    >
      <HStack spacing={3} mb={3}>
        <Circle size="44px" bg={`state.${tone}`} color="white" boxShadow={`0 0 0 4px var(--chakra-colors-state-${tone})22`}>
          <Icon as={MdPersonPin} boxSize={6} />
        </Circle>
        <Box flex="1" minW={0}>
          <Text fontSize="11px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase">
            Unidad de campo
          </Text>
          <Text fontSize="xl" color="text.primary" fontWeight={900} lineHeight="1.05">
            {unit.callSign}
          </Text>
          <Text fontSize="11px" color="text.secondary">{unit.operator}</Text>
        </Box>
        <StatusBadge state={tone} size="md" variant="solid" label={FIELD_STATE_LABEL[unit.state]} />
      </HStack>

      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2}>
        {states.map((st) => {
          const active = st === unit.state;
          const tn = STATE_TONE[st];
          return (
            <Box
              key={st}
              as="button"
              onClick={() => setState(st)}
              h="56px"
              bg={active ? `state.${tn}` : "bg.panelSubtle"}
              color={active ? "white" : "text.primary"}
              border="2px solid"
              borderColor={active ? `state.${tn}` : "border.subtle"}
              borderRadius="xl"
              fontWeight={900}
              fontSize="11px"
              letterSpacing="widest"
              textTransform="uppercase"
              transition="all 0.12s ease"
              _hover={{ borderColor: `state.${tn}` }}
            >
              {FIELD_STATE_LABEL[st]}
            </Box>
          );
        })}
      </SimpleGrid>

      <HStack mt={3} spacing={3} px={2}>
        <Text fontSize="10px" color="text.muted" fontFamily="mono">
          BAT {unit.battery}%
        </Text>
        <Text fontSize="10px" color="text.muted" fontFamily="mono">
          PING {timeAgo(unit.lastPing)}
        </Text>
        <Text fontSize="10px" color="text.muted" fontFamily="mono">
          {unit.location.lat.toFixed(4)}, {unit.location.lng.toFixed(4)}
        </Text>
      </HStack>
    </Box>
  );
};

// =============================
// ACTIVE TASK CARD
// =============================
export const ActiveTaskCard = () => {
  const task = useCampoStore(selectActiveTask);
  const markOnScene = useCampoStore((s) => s.markOnScene);
  const completeTask = useCampoStore((s) => s.completeTask);
  const cancelTask = useCampoStore((s) => s.cancelTask);

  if (!task) {
    return (
      <Box
        bg="white"
        border="1px dashed"
        borderColor="border.strong"
        borderRadius="3xl"
        p={5}
        textAlign="center"
      >
        <Text fontSize="11px" color="text.muted" fontWeight={800} letterSpacing="widest" textTransform="uppercase">
          Sin tarea activa
        </Text>
        <Text fontSize="13px" color="text.secondary" mt={1}>
          A la espera de asignación.
        </Text>
      </Box>
    );
  }

  const tone = PRIORITY_TONE[task.priority];
  return (
    <Box
      bg="white"
      border="1.5px solid"
      borderColor={`state.${tone}`}
      borderRadius="3xl"
      p={4}
      boxShadow={`0 8px 24px var(--chakra-colors-state-${tone})22`}
    >
      <HStack spacing={2} mb={1}>
        <Text
          fontSize="10px"
          fontFamily="mono"
          fontWeight={900}
          letterSpacing="widest"
          color={`state.${tone}`}
        >
          TAREA · {task.code}
        </Text>
        <StatusBadge state={tone} size="xs" variant="solid" label={task.priority.toUpperCase()} />
        <StatusBadge state={TASK_TONE[task.status]} size="xs" label={task.status.toUpperCase()} />
      </HStack>
      <Text fontSize="lg" fontWeight={900} color="text.primary" lineHeight="1.15" mb={2}>
        {task.title}
      </Text>
      <Text fontSize="sm" color="text.secondary" mb={3} lineHeight="short">
        {task.description}
      </Text>
      {task.destination && (
        <HStack spacing={1.5} mb={3}>
          <Icon as={MdLocationOn} color="state.active" boxSize={4} />
          <Text fontSize="11px" color="text.secondary" fontWeight={700}>
            {task.destination}
          </Text>
        </HStack>
      )}
      <HStack spacing={2}>
        {task.status === "accepted" && (
          <TacticalButton flex="1" size="lg" variant="tactical-warning" icon={MdMyLocation} onClick={() => markOnScene(task.id)}>
            Marcar en escena
          </TacticalButton>
        )}
        {(task.status === "accepted" || task.status === "on-scene") && (
          <TacticalButton flex="1" size="lg" variant="tactical-primary" icon={MdCheckCircle} onClick={() => completeTask(task.id)}>
            Completar
          </TacticalButton>
        )}
        <TacticalButton size="lg" variant="tactical-ghost" icon={MdClose} onClick={() => cancelTask(task.id)}>
          Cancelar
        </TacticalButton>
      </HStack>
    </Box>
  );
};

// =============================
// INCOMING TASKS — accept/reject
// =============================
export const IncomingTasksList = () => {
  const incoming = useCampoStore(selectIncomingTasks);
  const accept = useCampoStore((s) => s.acceptTask);
  const cancel = useCampoStore((s) => s.cancelTask);

  if (incoming.length === 0) return null;
  return (
    <TacticalPanel title="Tareas entrantes" icon={MdReportProblem} state="alert" code={`${incoming.length}`}>
      <VStack spacing={2} align="stretch">
        {incoming.map((t) => {
          const tone = PRIORITY_TONE[t.priority];
          return (
            <Box
              key={t.id}
              p={3}
              bg="bg.panelSubtle"
              border="1.5px solid"
              borderColor={`state.${tone}`}
              borderRadius="2xl"
            >
              <HStack mb={1.5}>
                <Text fontSize="10px" fontFamily="mono" fontWeight={900} color={`state.${tone}`} letterSpacing="widest">
                  {t.code}
                </Text>
                <StatusBadge state={tone} size="xs" variant="solid" label={t.priority.toUpperCase()} />
              </HStack>
              <Text fontSize="md" fontWeight={800} color="text.primary" lineHeight="short" mb={1}>
                {t.title}
              </Text>
              <Text fontSize="11px" color="text.secondary" lineHeight="short" noOfLines={2} mb={3}>
                {t.description}
              </Text>
              <HStack spacing={2}>
                <TacticalButton flex="1" size="md" variant="tactical-ghost" icon={MdClose} onClick={() => cancel(t.id)}>
                  Rechazar
                </TacticalButton>
                <TacticalButton flex="2" size="md" variant="tactical-primary" icon={MdPlayArrow} onClick={() => accept(t.id)}>
                  Aceptar tarea
                </TacticalButton>
              </HStack>
            </Box>
          );
        })}
      </VStack>
    </TacticalPanel>
  );
};

// =============================
// EMERGENCY ACTION BUTTONS — gigantes
// =============================
export const EmergencyActionButtons = () => {
  const requestSupport = useCampoStore((s) => s.requestSupport);
  const shareLocation = useCampoStore((s) => s.shareLocation);
  const [supportNotes, setSupportNotes] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
        <Box
          as="button"
          onClick={() => setSupportOpen(true)}
          bg="state.critical"
          color="white"
          h={{ base: "80px", sm: "96px" }}
          borderRadius="3xl"
          fontWeight={900}
          fontSize="md"
          letterSpacing="widest"
          textTransform="uppercase"
          boxShadow="0 8px 24px rgba(229,62,62,0.3)"
          _hover={{ transform: "translateY(-1px)", boxShadow: "0 12px 28px rgba(229,62,62,0.4)" }}
          _active={{ transform: "translateY(0)" }}
          transition="all 0.15s ease"
        >
          <VStack spacing={1}>
            <Icon as={MdSos} boxSize={8} />
            <Text>Pedir apoyo</Text>
          </VStack>
        </Box>
        <Box
          as="button"
          onClick={shareLocation}
          bg="accent.teal"
          color="white"
          h={{ base: "80px", sm: "96px" }}
          borderRadius="3xl"
          fontWeight={900}
          fontSize="md"
          letterSpacing="widest"
          textTransform="uppercase"
          boxShadow="0 8px 24px rgba(49,151,149,0.28)"
          _hover={{ transform: "translateY(-1px)", boxShadow: "0 12px 28px rgba(49,151,149,0.38)" }}
          _active={{ transform: "translateY(0)" }}
          transition="all 0.15s ease"
        >
          <VStack spacing={1}>
            <Icon as={MdMyLocation} boxSize={8} />
            <Text>Enviar ubicación</Text>
          </VStack>
        </Box>
      </SimpleGrid>

      <TacticalModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        title="Solicitar apoyo táctico"
        icon={MdSos}
        state="critical"
        size="md"
        footer={
          <HStack spacing={2}>
            <TacticalButton variant="tactical-ghost" onClick={() => setSupportOpen(false)}>Cancelar</TacticalButton>
            <TacticalButton variant="tactical-danger" icon={MdCheckCircle} onClick={() => { requestSupport(supportNotes); setSupportNotes(""); setSupportOpen(false); }}>
              Confirmar SOS
            </TacticalButton>
          </HStack>
        }
      >
        <VStack align="stretch" spacing={3}>
          <Text fontSize="sm" color="text.secondary">
            Esta acción notificará inmediatamente al puesto de mando y cambiará tu estado a APOYO SOLICITADO.
          </Text>
          <Box>
            <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" mb={1.5}>NOTAS (OPCIONAL)</Text>
            <Textarea value={supportNotes} onChange={(e) => setSupportNotes(e.target.value)} rows={3} bg="white" borderColor="border.strong" />
          </Box>
        </VStack>
      </TacticalModal>
    </>
  );
};

// =============================
// QUICK INCIDENT REPORT
// =============================
export const QuickIncidentReport = () => {
  const addReport = useCampoStore((s) => s.addReport);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const submit = () => {
    if (!title) return;
    addReport({ kind: "incident", title, body });
    setTitle(""); setBody(""); setOpen(false);
  };

  return (
    <>
      <Box
        as="button"
        onClick={() => setOpen(true)}
        bg="state.alert"
        color="white"
        h="80px"
        w="100%"
        borderRadius="3xl"
        fontWeight={900}
        fontSize="md"
        letterSpacing="widest"
        textTransform="uppercase"
        boxShadow="0 6px 20px rgba(221,107,32,0.28)"
        _hover={{ transform: "translateY(-1px)" }}
        transition="all 0.15s ease"
      >
        <HStack justify="center" spacing={3}>
          <Icon as={MdReportProblem} boxSize={7} />
          <Text>Reportar incidencia</Text>
        </HStack>
      </Box>

      <TacticalModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Reportar incidencia"
        icon={MdReportProblem}
        state="alert"
        size="md"
        footer={
          <HStack spacing={2}>
            <TacticalButton variant="tactical-ghost" onClick={() => setOpen(false)}>Cancelar</TacticalButton>
            <TacticalButton variant="tactical-warning" icon={MdCheckCircle} isDisabled={!title} onClick={submit}>
              Enviar reporte
            </TacticalButton>
          </HStack>
        }
      >
        <VStack align="stretch" spacing={3}>
          <Box>
            <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" mb={1.5}>TÍTULO</Text>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} size="md" bg="white" borderColor="border.strong" placeholder="Persona perdida, vehículo, obstáculo..." />
          </Box>
          <Box>
            <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" mb={1.5}>DETALLES</Text>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} bg="white" borderColor="border.strong" />
          </Box>
        </VStack>
      </TacticalModal>
    </>
  );
};

// =============================
// NAVIGATION PANEL
// =============================
export const NavigationPanel = () => {
  const targets = useCampoStore((s) => s.targets);
  const selectedId = useCampoStore((s) => s.selectedTargetId);
  const selectTarget = useCampoStore((s) => s.selectTarget);
  const selected = targets.find((t) => t.id === selectedId);

  return (
    <TacticalPanel title="Navegación" icon={MdExplore} state="active" code={`${targets.length}`}>
      {selected && (
        <Box
          mb={3}
          p={3}
          bg="accent.tealSoft"
          border="1px solid"
          borderColor="accent.teal"
          borderRadius="xl"
        >
          <HStack spacing={2} mb={1}>
            <Icon as={MdNavigation} color="accent.tealDeep" boxSize={4} style={{ transform: `rotate(${selected.bearing ?? 0}deg)` }} />
            <Text fontSize="10px" letterSpacing="widest" color="accent.tealDeep" fontWeight={900} textTransform="uppercase">
              Destino activo
            </Text>
          </HStack>
          <Text fontSize="md" color="text.primary" fontWeight={800}>{selected.label}</Text>
          <HStack mt={1.5} spacing={3}>
            {selected.distanceKm != null && (
              <Text fontSize="13px" fontFamily="mono" fontWeight={900} color="accent.tealDeep">
                {selected.distanceKm.toFixed(2)} km
              </Text>
            )}
            {selected.bearing != null && (
              <Text fontSize="13px" fontFamily="mono" fontWeight={900} color="accent.tealDeep">
                RUMBO {Math.round(selected.bearing)}°
              </Text>
            )}
          </HStack>
        </Box>
      )}

      <VStack spacing={1.5} align="stretch">
        {targets.map((t) => {
          const active = selectedId === t.id;
          return (
            <Flex
              key={t.id}
              as="button"
              onClick={() => selectTarget(active ? null : t.id)}
              align="center"
              gap={2}
              px={2.5}
              py={2}
              bg={active ? "accent.tealSoft" : "bg.panelSubtle"}
              border="1px solid"
              borderColor={active ? "accent.teal" : "border.subtle"}
              borderRadius="lg"
              transition="all 0.12s ease"
              _hover={{ borderColor: "accent.teal" }}
            >
              <Icon
                as={t.kind === "incident" ? MdReportProblem : t.kind === "shelter" ? MdLocationOn : t.kind === "rendezvous" ? MdMyLocation : MdLocationOn}
                color="state.active"
                boxSize={4}
              />
              <Box flex="1" minW={0} textAlign="left">
                <Text fontSize="12px" color="text.primary" fontWeight={800} noOfLines={1}>{t.label}</Text>
                <Text fontSize="10px" color="text.muted" letterSpacing="wider" textTransform="uppercase" fontWeight={700}>
                  {t.kind}
                </Text>
              </Box>
              {t.distanceKm != null && (
                <Text fontSize="11px" fontFamily="mono" fontWeight={800} color="state.active">
                  {t.distanceKm.toFixed(2)} km
                </Text>
              )}
            </Flex>
          );
        })}
      </VStack>
    </TacticalPanel>
  );
};

// =============================
// REPORTS FEED (history)
// =============================
export const FieldReportsFeed = () => {
  const reports = useCampoStore((s) => s.reports);
  return (
    <TacticalPanel title="Actividad reciente" icon={MdHistory} state="active" code={`${reports.length}`}>
      <VStack spacing={2} align="stretch">
        {reports.slice(0, 8).map((r) => {
          const tone: OperationalState =
            r.kind === "support" ? "critical" :
            r.kind === "incident" ? "alert" :
            r.kind === "voice" ? "active" :
            r.kind === "image" ? "active" : "operational";
          const Icn = REPORT_ICON[r.kind];
          return (
            <Flex
              key={r.id}
              p={2.5}
              bg="bg.panelSubtle"
              border="1px solid"
              borderColor="border.subtle"
              borderLeft="3px solid"
              borderLeftColor={`state.${tone}`}
              borderRadius="xl"
              gap={2.5}
              align="start"
            >
              <Circle size="32px" bg={`state.${tone}`} color="white" flexShrink={0}>
                <Icon as={Icn} boxSize={4} />
              </Circle>
              <Box flex="1" minW={0}>
                <Flex justify="space-between" align="baseline" gap={2}>
                  <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>
                    {r.title}
                  </Text>
                  <Text fontSize="10px" color="text.muted" fontFamily="mono">{formatTime(r.createdAt)}</Text>
                </Flex>
                <Text fontSize="11px" color="text.secondary" noOfLines={2} lineHeight="short" mt={0.5}>
                  {r.body}
                </Text>
                {r.imageUrl && (
                  <Image src={r.imageUrl} alt={r.title} mt={2} borderRadius="lg" maxH="110px" objectFit="cover" />
                )}
                <HStack mt={1} spacing={2}>
                  <Text fontSize="9px" color="text.muted" letterSpacing="wider" fontWeight={700} textTransform="uppercase">
                    {r.createdBy}
                  </Text>
                  {r.transcribed && (
                    <Text fontSize="9px" color="accent.teal" fontWeight={800} letterSpacing="wider">· VOZ TRANSCRITA</Text>
                  )}
                </HStack>
              </Box>
            </Flex>
          );
        })}
      </VStack>
      <Divider mt={2} borderColor="transparent" />
    </TacticalPanel>
  );
};
