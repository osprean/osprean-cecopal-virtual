import { useEffect, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  MdCheckCircle,
  MdLocalHospital,
  MdLocalShipping,
  MdMedicalServices,
  MdPersonAddAlt,
  MdReportGmailerrorred,
} from "react-icons/md";
import { TacticalButton, TacticalModal } from "../../components/base";
import {
  selectAvailableAmbulances,
  useSanitarioStore,
} from "../../store";
import type { TriageColor } from "../../types";
import { TRIAGE_LABEL } from "../../types";

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text
    fontSize="10px"
    color="text.label"
    fontWeight={900}
    letterSpacing="widest"
    textTransform="uppercase"
    mb={1.5}
  >
    {children}
  </Text>
);

// REGISTER VICTIM — opens when pendingPoint is set in mode=victim
export const RegisterVictimModal = () => {
  const mode = useSanitarioStore((s) => s.mode);
  const pendingPoint = useSanitarioStore((s) => s.pendingPoint);
  const cancel = useSanitarioStore((s) => s.cancelDrawing);
  const register = useSanitarioStore((s) => s.registerVictim);

  const isOpen = mode === "victim" && !!pendingPoint;
  const [triage, setTriage] = useState<TriageColor>("yellow");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "X" | "">("");
  const [injuries, setInjuries] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTriage("yellow");
      setAge("");
      setGender("");
      setInjuries("");
      setNotes("");
    }
  }, [isOpen]);

  const submit = () => {
    register({
      triage,
      age: age ? Number(age) : undefined,
      gender: gender || undefined,
      injuries: injuries || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={cancel}
      title="Registrar víctima"
      subtitle={
        pendingPoint
          ? `Lat ${pendingPoint.lat.toFixed(5)}, Lng ${pendingPoint.lng.toFixed(5)}`
          : undefined
      }
      icon={MdPersonAddAlt}
      state="critical"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={cancel}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-danger"
            icon={MdCheckCircle}
            onClick={submit}
          >
            Registrar
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <Box>
          <Label>Triaje START</Label>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
            {(["red", "yellow", "green", "black"] as TriageColor[]).map((c) => {
              const active = triage === c;
              const colorMap = {
                red: "state.critical",
                yellow: "state.pending",
                green: "state.operational",
                black: "text.primary",
                unset: "text.muted",
              } as const;
              return (
                <Button
                  key={c}
                  onClick={() => setTriage(c)}
                  h="56px"
                  bg={active ? colorMap[c] : "bg.panelSubtle"}
                  color={active ? "white" : "text.primary"}
                  border="2px solid"
                  borderColor={active ? colorMap[c] : "border.subtle"}
                  _hover={{ bg: active ? colorMap[c] : "bg.panelSubtle", borderColor: colorMap[c] }}
                  borderRadius="lg"
                  fontWeight={900}
                  fontSize="11px"
                  letterSpacing="widest"
                  flexDirection="column"
                  gap={0}
                >
                  <Text fontSize="11px">{TRIAGE_LABEL[c].split(" · ")[0]}</Text>
                  <Text fontSize="9px" opacity={0.85}>
                    {TRIAGE_LABEL[c].split(" · ")[1]}
                  </Text>
                </Button>
              );
            })}
          </SimpleGrid>
        </Box>
        <HStack spacing={3}>
          <Box flex="1">
            <Label>Edad</Label>
            <Input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="--"
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            />
          </Box>
          <Box flex="2">
            <Label>Sexo</Label>
            <RadioGroup value={gender} onChange={(v) => setGender(v as "M" | "F" | "X" | "")}>
              <Stack direction="row" spacing={4}>
                <Radio value="M" colorScheme="teal"><Text fontSize="sm">M</Text></Radio>
                <Radio value="F" colorScheme="teal"><Text fontSize="sm">F</Text></Radio>
                <Radio value="X" colorScheme="teal"><Text fontSize="sm">X</Text></Radio>
              </Stack>
            </RadioGroup>
          </Box>
        </HStack>
        <Box>
          <Label>Lesiones / motivo</Label>
          <Input
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            placeholder="Inhalación humo, fractura, quemadura..."
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          />
        </Box>
        <Box>
          <Label>Notas</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            bg="white"
            borderColor="border.strong"
            color="text.primary"
            fontSize="sm"
          />
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// VICTIM DETAIL — opens when selectedVictimId is set
export const VictimDetailModal = () => {
  const selectedId = useSanitarioStore((s) => s.selectedVictimId);
  const select = useSanitarioStore((s) => s.selectVictim);
  const victim = useSanitarioStore((s) =>
    s.victims.find((v) => v.id === s.selectedVictimId),
  );
  const ambulances = useSanitarioStore(selectAvailableAmbulances);
  const hospitals = useSanitarioStore((s) => s.hospitals);
  const updateTriage = useSanitarioStore((s) => s.updateTriage);
  const assignAmbulance = useSanitarioStore((s) => s.assignAmbulance);
  const deriveToHospital = useSanitarioStore((s) => s.deriveToHospital);
  const markEvacuated = useSanitarioStore((s) => s.markEvacuated);

  const [chosenAmb, setChosenAmb] = useState("");
  const [chosenHsp, setChosenHsp] = useState("");

  useEffect(() => {
    setChosenAmb("");
    setChosenHsp("");
  }, [selectedId]);

  if (!victim) return null;

  return (
    <TacticalModal
      isOpen={!!selectedId}
      onClose={() => select(null)}
      title={`Víctima ${victim.code}`}
      subtitle={
        victim.injuries
          ? `${victim.injuries} · registrada ${new Date(victim.registeredAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
          : undefined
      }
      icon={MdPersonAddAlt}
      state={victim.triage === "red" ? "critical" : victim.triage === "yellow" ? "pending" : "operational"}
      size="lg"
    >
      <VStack align="stretch" spacing={4}>
        {/* Triage selector */}
        <Box>
          <Label>Reclasificar triaje</Label>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
            {(["red", "yellow", "green", "black"] as TriageColor[]).map((c) => {
              const active = victim.triage === c;
              const colorMap = {
                red: "state.critical",
                yellow: "state.pending",
                green: "state.operational",
                black: "text.primary",
                unset: "text.muted",
              } as const;
              return (
                <Button
                  key={c}
                  onClick={() => updateTriage(victim.id, c)}
                  h="48px"
                  bg={active ? colorMap[c] : "bg.panelSubtle"}
                  color={active ? "white" : "text.primary"}
                  border="2px solid"
                  borderColor={active ? colorMap[c] : "border.subtle"}
                  _hover={{ borderColor: colorMap[c] }}
                  borderRadius="lg"
                  fontWeight={900}
                  fontSize="10px"
                  letterSpacing="widest"
                >
                  {TRIAGE_LABEL[c].split(" · ")[0]}
                </Button>
              );
            })}
          </SimpleGrid>
        </Box>

        {/* Asignar ambulancia */}
        <HStack spacing={3} align="end">
          <Box flex="1">
            <Label>Asignar ambulancia</Label>
            <Select
              value={chosenAmb}
              onChange={(e) => setChosenAmb(e.target.value)}
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            >
              <option value="">— Seleccionar —</option>
              {ambulances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.callSign} · {a.kind} · {a.crew}
                </option>
              ))}
            </Select>
          </Box>
          <TacticalButton
            size="sm"
            variant="tactical-primary"
            icon={MdLocalShipping}
            isDisabled={!chosenAmb}
            onClick={() => {
              assignAmbulance(victim.id, chosenAmb);
              setChosenAmb("");
            }}
          >
            Asignar
          </TacticalButton>
        </HStack>

        {/* Derivar hospital */}
        <HStack spacing={3} align="end">
          <Box flex="1">
            <Label>Derivar a hospital</Label>
            <Select
              value={chosenHsp}
              onChange={(e) => setChosenHsp(e.target.value)}
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            >
              <option value="">— Seleccionar —</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} · {Math.round((1 - h.beds.available / h.beds.total) * 100)}%
                </option>
              ))}
            </Select>
          </Box>
          <TacticalButton
            size="sm"
            variant="tactical-warning"
            icon={MdLocalHospital}
            isDisabled={!chosenHsp}
            onClick={() => {
              deriveToHospital(victim.id, chosenHsp);
              setChosenHsp("");
            }}
          >
            Derivar
          </TacticalButton>
        </HStack>

        {victim.status === "evacuating" && (
          <TacticalButton
            variant="tactical-primary"
            icon={MdCheckCircle}
            onClick={() => markEvacuated(victim.id)}
          >
            Marcar entregada en hospital
          </TacticalButton>
        )}

        {victim.notes && (
          <Box bg="bg.panelSubtle" p={3} borderRadius="lg" border="1px solid" borderColor="border.subtle">
            <Label>Notas</Label>
            <Text fontSize="sm" color="text.secondary">{victim.notes}</Text>
          </Box>
        )}
      </VStack>
    </TacticalModal>
  );
};

// REQUEST AMBULANCE
export const RequestAmbulanceModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const ambulances = useSanitarioStore(selectAvailableAmbulances);
  const setAmbState = useSanitarioStore((s) => s.setAmbulanceState);
  const pushActivity = useSanitarioStore((s) => s.pushActivity);
  const [chosen, setChosen] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) { setChosen(""); setReason(""); }
  }, [isOpen]);

  const submit = () => {
    if (!chosen) return;
    setAmbState(chosen, "dispatched");
    pushActivity("ambulance-dispatched", `Solicitud manual: ${reason || "sin motivo"}`, chosen);
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Solicitar ambulancia"
      icon={MdLocalShipping}
      state="active"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>Cancelar</TacticalButton>
          <TacticalButton variant="tactical-primary" icon={MdCheckCircle} isDisabled={!chosen} onClick={submit}>
            Despachar
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <Box>
          <Label>Recurso disponible</Label>
          <Select value={chosen} onChange={(e) => setChosen(e.target.value)} size="sm" bg="white" borderColor="border.strong">
            <option value="">— Elegir —</option>
            {ambulances.map((a) => (
              <option key={a.id} value={a.id}>{a.callSign} · {a.kind}</option>
            ))}
          </Select>
        </Box>
        <Box>
          <Label>Motivo</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            bg="white"
            borderColor="border.strong"
            color="text.primary"
            fontSize="sm"
          />
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// SANITARY ALERT
export const SanitaryAlertModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const pushAlert = useSanitarioStore((s) => s.pushAlert);
  const [source, setSource] = useState("Coord. Sanitario · SUMMA");
  const [severity, setSeverity] = useState<"critical" | "high" | "medium" | "low">("high");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) { setMessage(""); }
  }, [isOpen]);

  const submit = () => {
    if (!message) return;
    pushAlert({ emergencyId: "emg-001", source, severity, message });
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Lanzar alerta sanitaria"
      icon={MdReportGmailerrorred}
      state="critical"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>Cancelar</TacticalButton>
          <TacticalButton variant="tactical-danger" icon={MdCheckCircle} isDisabled={!message} onClick={submit}>
            Lanzar
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <HStack spacing={3}>
          <Box flex="2">
            <Label>Fuente</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} size="sm" bg="white" borderColor="border.strong" />
          </Box>
          <Box flex="1">
            <Label>Severidad</Label>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} size="sm" bg="white" borderColor="border.strong">
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </Box>
        </HStack>
        <Box>
          <Label>Mensaje</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} bg="white" borderColor="border.strong" fontSize="sm" />
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// SANITARY ZONE — abre cuando el usuario marca un punto en modos triage-point
// o first-aid. Pide etiqueta + aforo y crea la zona en el mapa.
export const SanitaryZoneModal = () => {
  const mode = useSanitarioStore((s) => s.mode);
  const pendingPoint = useSanitarioStore((s) => s.pendingPoint);
  const cancel = useSanitarioStore((s) => s.cancelDrawing);
  const addZone = useSanitarioStore((s) => s.addZone);

  const isZoneMode = mode === "triage-point" || mode === "first-aid";
  const isOpen = isZoneMode && !!pendingPoint;
  const kind = (mode === "triage-point" ? "triage-point" : "first-aid") as
    | "triage-point"
    | "first-aid";

  const defaultLabel = kind === "triage-point" ? "Punto de triaje" : "Área de socorro";
  const [label, setLabel] = useState(defaultLabel);
  const [capacity, setCapacity] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setLabel(defaultLabel);
      setCapacity("");
    } else {
      setLabel(defaultLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, kind]);

  const submit = () => {
    if (!label.trim()) return;
    addZone({ kind, label: label.trim(), capacity: capacity ? Number(capacity) : undefined });
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={cancel}
      title={kind === "triage-point" ? "Punto de triaje" : "Área de socorro"}
      subtitle={
        pendingPoint
          ? `Lat ${pendingPoint.lat.toFixed(5)}, Lng ${pendingPoint.lng.toFixed(5)}`
          : undefined
      }
      icon={kind === "triage-point" ? MdMedicalServices : MdLocalHospital}
      state="alert"
      size="sm"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={cancel}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-primary"
            icon={MdCheckCircle}
            onClick={submit}
            isDisabled={!label.trim()}
          >
            Desplegar
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <Box>
          <Label>Etiqueta</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={defaultLabel}
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          />
        </Box>
        <Box>
          <Label>Aforo estimado</Label>
          <Input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="—"
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          />
        </Box>
      </VStack>
    </TacticalModal>
  );
};
