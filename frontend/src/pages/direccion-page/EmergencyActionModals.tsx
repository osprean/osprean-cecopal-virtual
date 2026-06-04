import { useState } from "react";
import {
  Box,
  HStack,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  MdCheckCircle,
  MdClose,
  MdSend,
  MdTrendingUp,
} from "react-icons/md";
import {
  StatusBadge,
  TacticalButton,
  TacticalCard,
  TacticalModal,
} from "../../components/base";
import { useDireccionStore } from "../../store";
import type { OperationalLevel, Severity } from "../../types";
import { OPERATIONAL_LEVEL_LABEL } from "../../types";

// ESCALATE LEVEL
export const EscalateLevelModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const currentLevel = useDireccionStore((s) => s.level);
  const setLevel = useDireccionStore((s) => s.setLevel);
  const [target, setTarget] = useState<OperationalLevel>(currentLevel);
  const [notes, setNotes] = useState("");

  const submit = () => {
    setLevel(target, "Director Plan", notes || undefined);
    setNotes("");
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambiar nivel operativo"
      subtitle="Recalcula recursos y notifica a CECOPAL / Subdelegación."
      icon={MdTrendingUp}
      state="alert"
      size="lg"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-primary"
            onClick={submit}
            isDisabled={target === currentLevel}
            icon={MdCheckCircle}
          >
            Confirmar nivel {target}
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={4}>
        <Box>
          <Text fontSize="11px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={2}>
            Nivel actual
          </Text>
          <StatusBadge state="active" size="md" variant="solid" label={OPERATIONAL_LEVEL_LABEL[currentLevel]} />
        </Box>
        <Box>
          <Text fontSize="11px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={2}>
            Nuevo nivel
          </Text>
          <RadioGroup value={String(target)} onChange={(v) => setTarget(Number(v) as OperationalLevel)}>
            <Stack spacing={2}>
              {([0, 1, 2, 3] as OperationalLevel[]).map((lv) => (
                <Radio key={lv} value={String(lv)} colorScheme="teal">
                  <Text fontSize="sm" color="text.primary" fontWeight={600}>
                    {OPERATIONAL_LEVEL_LABEL[lv]}
                  </Text>
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        </Box>
        <Box>
          <Text fontSize="11px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={2}>
            Justificación
          </Text>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo del cambio de nivel — quedará en el log."
            rows={3}
            bg="white"
            borderColor="border.strong"
            color="text.primary"
            fontSize="sm"
            _placeholder={{ color: "text.muted" }}
            _focus={{ borderColor: "accent.teal", boxShadow: "0 0 0 1px var(--chakra-colors-accent-teal)" }}
          />
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// APPROVE COMMUNIQUE
export const ApproveCommuniqueModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const communiques = useDireccionStore((s) =>
    s.communiques.filter((c) => c.status === "pending-approval" || c.status === "draft"),
  );
  const setStatus = useDireccionStore((s) => s.setCommuniqueStatus);

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Comunicados pendientes"
      subtitle="Revisa, aprueba o rechaza para envío."
      icon={MdSend}
      state="pending"
      size="xl"
    >
      <VStack align="stretch" spacing={3}>
        {communiques.length === 0 && (
          <Text fontSize="sm" color="text.muted" textAlign="center" py={6}>
            No hay comunicados pendientes.
          </Text>
        )}
        {communiques.map((c) => (
          <TacticalCard
            key={c.id}
            state="pending"
            title={c.title}
            meta={c.audience.toUpperCase()}
            subtitle={c.body}
            unread={c.status === "pending-approval"}
            footer={
              <>
                <Text fontSize="10px" color="text.muted" letterSpacing="wider" fontWeight={700} textTransform="uppercase">
                  Por: {c.createdBy}
                </Text>
                <HStack spacing={2}>
                  <TacticalButton size="xs" variant="tactical-danger" icon={MdClose} onClick={() => setStatus(c.id, "draft")}>
                    Rechazar
                  </TacticalButton>
                  <TacticalButton size="xs" variant="tactical-primary" icon={MdCheckCircle} onClick={() => setStatus(c.id, "approved")}>
                    Aprobar
                  </TacticalButton>
                  <TacticalButton size="xs" variant="tactical" icon={MdSend} onClick={() => setStatus(c.id, "sent")}>
                    Enviar
                  </TacticalButton>
                </HStack>
              </>
            }
          />
        ))}
      </VStack>
    </TacticalModal>
  );
};

// REQUEST SUPPORT
export const RequestSupportModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [resourceType, setResourceType] = useState("helicopter");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<Severity>("high");
  const pushAction = useDireccionStore((s) => s.pushAction);

  const submit = () => {
    pushAction({
      id: `act-${Math.random().toString(36).slice(2, 8)}`,
      emergencyId: "emg-001",
      type: "support-requested",
      performedBy: "Director Plan",
      timestamp: new Date().toISOString(),
      payload: { resourceType, quantity, priority },
      notes: reason,
    });
    setReason("");
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Solicitar apoyo externo"
      subtitle="Solicita medios o personal a Subdelegación / UME."
      state="alert"
      size="lg"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>
            Cancelar
          </TacticalButton>
          <TacticalButton variant="tactical-warning" icon={MdSend} onClick={submit} isDisabled={!reason}>
            Enviar solicitud
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={4}>
        <HStack spacing={3}>
          <Box flex="2">
            <Label>Tipo de recurso</Label>
            <Select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              bg="white"
              borderColor="border.strong"
              color="text.primary"
              size="sm"
            >
              <option value="helicopter">Helicóptero</option>
              <option value="fire-truck">Autobomba</option>
              <option value="ambulance">Ambulancia</option>
              <option value="team">Equipo (BRIF/UME)</option>
              <option value="personnel">Personal</option>
              <option value="supplies">Suministros</option>
              <option value="transport">Transporte</option>
            </Select>
          </Box>
          <Box flex="1">
            <Label>Cantidad</Label>
            <Select
              value={String(quantity)}
              onChange={(e) => setQuantity(Number(e.target.value))}
              bg="white"
              borderColor="border.strong"
              color="text.primary"
              size="sm"
            >
              {[1, 2, 3, 4, 5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </Box>
          <Box flex="1">
            <Label>Prioridad</Label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Severity)}
              bg="white"
              borderColor="border.strong"
              color="text.primary"
              size="sm"
            >
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </Box>
        </HStack>
        <Box>
          <Label>Justificación operativa</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe necesidad táctica, ETA esperada, ubicación..."
            rows={3}
            bg="white"
            borderColor="border.strong"
            color="text.primary"
            fontSize="sm"
            _placeholder={{ color: "text.muted" }}
            _focus={{ borderColor: "accent.teal", boxShadow: "0 0 0 1px var(--chakra-colors-accent-teal)" }}
          />
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// CLOSE EMERGENCY
export const CloseEmergencyModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const close = useDireccionStore((s) => s.close);
  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Finalizar emergencia"
      subtitle="Confirma el cierre. Se generará informe automático."
      state="critical"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-danger"
            icon={MdCheckCircle}
            onClick={() => {
              close();
              onClose();
            }}
          >
            Confirmar cierre
          </TacticalButton>
        </HStack>
      }
    >
      <Text fontSize="sm" color="text.secondary" lineHeight="tall">
        Esta acción detiene la coordinación operativa, libera grupos y deja la emergencia en estado{" "}
        <Text as="span" color="state.operational" fontWeight={800}>CERRADA</Text>. La acción quedará registrada en el log con timestamp y operador.
      </Text>
    </TacticalModal>
  );
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={1.5}>
    {children}
  </Text>
);
