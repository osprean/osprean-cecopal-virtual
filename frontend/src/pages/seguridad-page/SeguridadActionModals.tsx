import { useEffect, useState } from "react";
import {
  Box,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  MdBlock,
  MdCheckCircle,
  MdDirectionsRun,
  MdGesture,
  MdLockOpen,
  MdReportProblem,
} from "react-icons/md";
import {
  TacticalButton,
  TacticalModal,
} from "../../components/base";
import { useDireccionStore, useSeguridadStore } from "../../store";
import type {
  AccessControlState,
  PerimeterKind,
} from "../../types";
import { PERIMETER_LABEL, PERIMETER_PALETTE } from "../../types";

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

// CLOSE STREET — opens when 2 points (A→B) have been clicked in closure mode.
// The first click triggers a Nominatim reverse-geocode in the background so by
// the time both endpoints are placed, the road name is pre-filled.
export const CloseStreetModal = () => {
  const mode = useSeguridadStore((s) => s.mode);
  const drawingPoints = useSeguridadStore((s) => s.drawingPoints);
  const geocode = useSeguridadStore((s) => s.closureGeocode);
  const cancel = useSeguridadStore((s) => s.cancelDrawing);
  const create = useSeguridadStore((s) => s.createClosure);
  const isOpen = mode === "closure" && drawingPoints.length === 2;

  const [road, setRoad] = useState("");
  const [km, setKm] = useState("");
  const [reason, setReason] = useState("");
  const [didPrefill, setDidPrefill] = useState(false);

  // Reset when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setRoad("");
      setKm("");
      setReason("");
      setDidPrefill(false);
    }
  }, [isOpen]);

  // Auto-fill once geocoding resolves (and only if user hasn't typed anything)
  useEffect(() => {
    if (!isOpen) return;
    if (didPrefill) return;
    if (geocode.loading) return;
    if (geocode.road && road === "") {
      setRoad(geocode.road);
      setDidPrefill(true);
    }
  }, [isOpen, geocode.loading, geocode.road, road, didPrefill]);

  const submit = () => {
    if (!road || !reason) return;
    create({ road, km: km || undefined, reason });
  };

  const segment = drawingPoints.length === 2
    ? `A ${drawingPoints[0].lat.toFixed(5)},${drawingPoints[0].lng.toFixed(5)}  →  B ${drawingPoints[1].lat.toFixed(5)},${drawingPoints[1].lng.toFixed(5)}`
    : undefined;

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={cancel}
      title="Cerrar tramo de vía"
      subtitle={segment}
      icon={MdBlock}
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
            isDisabled={!road || !reason}
            onClick={submit}
          >
            Cerrar tramo
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <HStack spacing={3}>
          <Box flex="2">
            <Label>
              Vía
              {geocode.loading && (
                <Text as="span" ml={2} fontSize="9px" color="accent.teal" fontWeight={700} letterSpacing="wider">
                  · Detectando…
                </Text>
              )}
              {!geocode.loading && geocode.road && (
                <Text as="span" ml={2} fontSize="9px" color="state.operational" fontWeight={700} letterSpacing="wider">
                  · Auto-detectado
                </Text>
              )}
              {!geocode.loading && !geocode.road && drawingPoints.length === 2 && (
                <Text as="span" ml={2} fontSize="9px" color="state.alert" fontWeight={700} letterSpacing="wider">
                  · Sin datos OSM
                </Text>
              )}
            </Label>
            <Input
              value={road}
              onChange={(e) => setRoad(e.target.value)}
              placeholder="M-622, A-2, Calle Mayor..."
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            />
            {geocode.locality && (
              <Text fontSize="10px" color="text.muted" mt={1} fontFamily="mono">
                {geocode.locality}
              </Text>
            )}
          </Box>
          <Box flex="1">
            <Label>PK</Label>
            <Input
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="12+400"
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            />
          </Box>
        </HStack>
        <Box>
          <Label>Motivo</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Humo en calzada, accidente, paso de bomberos..."
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

// ACCESS / CHECKPOINT
type AccessFormProps = { kind: "access" | "checkpoint" };

const AccessOrCheckpointForm = ({ kind }: AccessFormProps) => {
  const cancel = useSeguridadStore((s) => s.cancelDrawing);
  const create = useSeguridadStore((s) => s.createAccessControl);
  const [label, setLabel] = useState("");
  const [state, setState] = useState<AccessControlState>(
    kind === "access" ? "open" : "restricted",
  );
  const [units, setUnits] = useState(kind === "checkpoint" ? 2 : 0);
  const [reason, setReason] = useState("");

  return (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Label>Etiqueta</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === "checkpoint" ? "CP-NORTE Robledo" : "Acceso forestal A"}
          size="sm"
          bg="white"
          borderColor="border.strong"
          color="text.primary"
        />
      </Box>
      <Box>
        <Label>Estado</Label>
        <RadioGroup value={state} onChange={(v) => setState(v as AccessControlState)}>
          <Stack direction="row" spacing={4}>
            <Radio value="open" colorScheme="teal">
              <Text fontSize="sm" color="text.primary">Abierto</Text>
            </Radio>
            <Radio value="restricted" colorScheme="orange">
              <Text fontSize="sm" color="text.primary">Restringido</Text>
            </Radio>
            <Radio value="closed" colorScheme="red">
              <Text fontSize="sm" color="text.primary">Cerrado</Text>
            </Radio>
          </Stack>
        </RadioGroup>
      </Box>
      {kind === "checkpoint" && (
        <Box>
          <Label>Efectivos</Label>
          <Select
            value={String(units)}
            onChange={(e) => setUnits(Number(e.target.value))}
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          >
            {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Box>
      )}
      <Box>
        <Label>Notas</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reservado a residentes, paso de emergencias, control documental..."
          rows={2}
          bg="white"
          borderColor="border.strong"
          color="text.primary"
          fontSize="sm"
        />
      </Box>
      <HStack justify="flex-end" spacing={2} pt={2}>
        <TacticalButton variant="tactical-ghost" onClick={cancel}>
          Cancelar
        </TacticalButton>
        <TacticalButton
          variant={kind === "access" ? "tactical-primary" : "tactical-warning"}
          icon={kind === "access" ? MdLockOpen : MdReportProblem}
          isDisabled={!label}
          onClick={() => create({ kind, label, state, units, reason })}
        >
          {kind === "access" ? "Crear acceso" : "Desplegar control"}
        </TacticalButton>
      </HStack>
    </VStack>
  );
};

export const AccessControlModal = () => {
  const mode = useSeguridadStore((s) => s.mode);
  const pendingPoint = useSeguridadStore((s) => s.pendingPoint);
  const cancel = useSeguridadStore((s) => s.cancelDrawing);
  const isOpen = (mode === "access" || mode === "checkpoint") && !!pendingPoint;
  if (!isOpen) return null;
  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={cancel}
      title={mode === "access" ? "Nuevo acceso" : "Nuevo control policial"}
      subtitle={pendingPoint ? `Lat ${pendingPoint.lat.toFixed(5)}, Lng ${pendingPoint.lng.toFixed(5)}` : undefined}
      icon={mode === "access" ? MdLockOpen : MdReportProblem}
      state={mode === "access" ? "operational" : "alert"}
      size="md"
    >
      <AccessOrCheckpointForm kind={mode === "access" ? "access" : "checkpoint"} />
    </TacticalModal>
  );
};

const formatPerimeterMeters = (m: number) => {
  if (!Number.isFinite(m) || m <= 0) return "0 m";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
};

// PERIMETER FINALIZE
export const FinalizePerimeterModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const create = useSeguridadStore((s) => s.createPerimeter);
  const shape = useSeguridadStore((s) => s.perimeterShape);
  const circleRadius = useSeguridadStore((s) => s.circleRadius);
  const polygonPoints = useSeguridadStore((s) => s.drawingPoints);
  const [kind, setKind] = useState<PerimeterKind>("exclusion");
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  // null = usar el color por defecto del tipo; string = hex personalizado.
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLabel("");
      setKind("exclusion");
      setLevel(2);
      setColor(null);
    }
  }, [isOpen]);

  const submit = () => {
    if (!label) return;
    create({ kind, label, level, color: color ?? undefined });
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Finalizar perímetro"
      subtitle={
        shape === "circle"
          ? `Círculo · radio ${formatPerimeterMeters(circleRadius)}`
          : `Polígono · ${polygonPoints.length} vértices`
      }
      icon={MdGesture}
      state="alert"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-primary"
            icon={MdCheckCircle}
            isDisabled={!label}
            onClick={submit}
          >
            Activar perímetro
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
            placeholder="Exclusión Sierra Norte"
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          />
        </Box>
        <Box>
          <Label>Tipo</Label>
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as PerimeterKind)}
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          >
            <option value="exclusion">{PERIMETER_LABEL.exclusion}</option>
            <option value="evacuation">{PERIMETER_LABEL.evacuation}</option>
            <option value="safety">{PERIMETER_LABEL.safety}</option>
            <option value="buffer">{PERIMETER_LABEL.buffer}</option>
          </Select>
        </Box>
        <Box>
          <Label>Nivel</Label>
          <RadioGroup value={String(level)} onChange={(v) => setLevel(Number(v) as 1 | 2 | 3)}>
            <Stack direction="row" spacing={4}>
              <Radio value="1" colorScheme="yellow"><Text fontSize="sm" color="text.primary">1</Text></Radio>
              <Radio value="2" colorScheme="orange"><Text fontSize="sm" color="text.primary">2</Text></Radio>
              <Radio value="3" colorScheme="red"><Text fontSize="sm" color="text.primary">3</Text></Radio>
            </Stack>
          </RadioGroup>
        </Box>
        <Box>
          <Label>Color</Label>
          <HStack spacing={1.5} wrap="wrap">
            <Swatch
              hex={null}
              selected={color === null}
              onClick={() => setColor(null)}
              title="Color por defecto del tipo"
            />
            {PERIMETER_PALETTE.map((p) => (
              <Swatch
                key={p.name}
                hex={p.hex}
                selected={color === p.hex}
                onClick={() => setColor(p.hex)}
                title={p.label}
              />
            ))}
          </HStack>
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// Cuadrado de color clicable usado en el picker. Si `hex` es null, representa
// "color por defecto" (un cuadrado a rayas que muestra la ausencia de override).
const Swatch = ({
  hex,
  selected,
  onClick,
  title,
}: {
  hex: string | null;
  selected: boolean;
  onClick: () => void;
  title: string;
}) => (
  <Box
    as="button"
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    width="22px"
    height="22px"
    borderRadius="4px"
    border="2px solid"
    borderColor={selected ? "accent.teal" : "border.strong"}
    bg={hex ?? "white"}
    backgroundImage={
      hex
        ? undefined
        : "repeating-linear-gradient(45deg, #E2E8F0 0 4px, #FFFFFF 4px 8px)"
    }
    cursor="pointer"
    transition="transform 0.1s ease, border-color 0.1s ease"
    _hover={{ transform: "scale(1.1)" }}
    boxShadow={selected ? "0 0 0 1px var(--chakra-colors-accent-teal)" : undefined}
  />
);

// EVACUATION
export const EvacuationModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const register = useSeguridadStore((s) => s.registerEvacuation);
  const shelters = useDireccionStore((s) => s.shelters);
  const [count, setCount] = useState(10);
  const [from, setFrom] = useState("");
  const [toShelter, setToShelter] = useState(shelters[0]?.name ?? "");

  useEffect(() => {
    if (!isOpen) {
      setCount(10);
      setFrom("");
      setToShelter(shelters[0]?.name ?? "");
    }
  }, [isOpen, shelters]);

  const submit = () => {
    if (!from || !toShelter || count <= 0) return;
    register({ count, from, toShelter });
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar evacuación"
      icon={MdDirectionsRun}
      state="alert"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-warning"
            icon={MdCheckCircle}
            isDisabled={!from || count <= 0}
            onClick={submit}
          >
            Registrar
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <HStack spacing={3}>
          <Box flex="1">
            <Label>Personas</Label>
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            />
          </Box>
          <Box flex="2">
            <Label>Origen</Label>
            <Input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Núcleo Robledo, Calle X..."
              size="sm"
              bg="white"
              borderColor="border.strong"
              color="text.primary"
            />
          </Box>
        </HStack>
        <Box>
          <Label>Albergue destino</Label>
          <Select
            value={toShelter}
            onChange={(e) => setToShelter(e.target.value)}
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          >
            {shelters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} · {s.occupancy}/{s.capacity}
              </option>
            ))}
          </Select>
        </Box>
      </VStack>
    </TacticalModal>
  );
};

// INCIDENT
export const IncidentModal = () => {
  const mode = useSeguridadStore((s) => s.mode);
  const pendingPoint = useSeguridadStore((s) => s.pendingPoint);
  const cancel = useSeguridadStore((s) => s.cancelDrawing);
  const register = useSeguridadStore((s) => s.registerIncident);
  const isOpen = mode === "incident" && !!pendingPoint;
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setNotes("");
    }
  }, [isOpen]);

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={cancel}
      title="Reportar incidencia"
      subtitle={pendingPoint ? `Lat ${pendingPoint.lat.toFixed(5)}, Lng ${pendingPoint.lng.toFixed(5)}` : undefined}
      icon={MdReportProblem}
      state="alert"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={cancel}>
            Cancelar
          </TacticalButton>
          <TacticalButton
            variant="tactical-warning"
            icon={MdCheckCircle}
            isDisabled={!title}
            onClick={() => register({ title, notes })}
          >
            Registrar incidencia
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <Box>
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Persona perdida, vehículo abandonado..."
            size="sm"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
          />
        </Box>
        <Box>
          <Label>Detalles</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
