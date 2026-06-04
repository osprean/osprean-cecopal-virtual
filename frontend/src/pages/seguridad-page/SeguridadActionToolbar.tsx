import { Box, HStack, Icon, Text, VStack, Tooltip } from "@chakra-ui/react";
import {
  MdBlock,
  MdLockOpen,
  MdGesture,
  MdReportProblem,
  MdDirectionsRun,
  MdClose,
  MdCheckCircle,
  MdRadioButtonUnchecked,
  MdTimeline,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { TacticalButton } from "../../components/base";
import { useSeguridadStore } from "../../store";
import type { DrawingMode } from "../../types";

const formatMeters = (m: number) => {
  if (!Number.isFinite(m) || m <= 0) return "0 m";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
};

interface ToolDef {
  mode: Exclude<DrawingMode, "idle">;
  label: string;
  short: string;
  icon: IconType;
  variant: "tactical-danger" | "tactical-warning" | "tactical-primary" | "tactical";
}

const TOOLS: ToolDef[] = [
  { mode: "closure", label: "Cerrar calle", short: "CIERRE", icon: MdBlock, variant: "tactical-danger" },
  { mode: "access", label: "Abrir acceso", short: "ACCESO", icon: MdLockOpen, variant: "tactical-primary" },
  { mode: "checkpoint", label: "Crear control", short: "CONTROL", icon: MdReportProblem, variant: "tactical-warning" },
  { mode: "perimeter", label: "Crear perímetro", short: "PERÍMETRO", icon: MdGesture, variant: "tactical" },
  { mode: "evacuation", label: "Registrar evacuación", short: "EVAC.", icon: MdDirectionsRun, variant: "tactical-warning" },
  { mode: "incident", label: "Añadir incidencia", short: "INCID.", icon: MdReportProblem, variant: "tactical" },
];

const MODE_INSTRUCTIONS: Record<DrawingMode, string> = {
  idle: "",
  closure: "Pulsa el punto A y luego el punto B para cerrar el tramo.",
  access: "Pulsa en el mapa donde colocar el acceso.",
  checkpoint: "Pulsa en el mapa donde desplegar el control.",
  perimeter: "Pulsa en el mapa para añadir vértices. Mínimo 3 puntos.",
  incident: "Pulsa en el mapa donde reportar la incidencia.",
  evacuation: "Rellena el formulario flotante para registrar la evacuación.",
};

interface Props {
  onOpenEvacuation: () => void;
}

// Floating tactical toolbar — bottom-left of the map.
export const SeguridadActionToolbar = ({ onOpenEvacuation }: Props) => {
  const mode = useSeguridadStore((s) => s.mode);
  const setMode = useSeguridadStore((s) => s.setMode);
  const cancel = useSeguridadStore((s) => s.cancelDrawing);
  const drawingPoints = useSeguridadStore((s) => s.drawingPoints);
  const perimeterShape = useSeguridadStore((s) => s.perimeterShape);
  const setPerimeterShape = useSeguridadStore((s) => s.setPerimeterShape);
  const circleCenter = useSeguridadStore((s) => s.circleCenter);
  const circleRadius = useSeguridadStore((s) => s.circleRadius);
  const previewRadius = useSeguridadStore((s) => s.circlePreviewRadius);

  const handleSelect = (m: DrawingMode) => {
    if (m === "evacuation") {
      onOpenEvacuation();
      setMode("idle");
      return;
    }
    setMode(mode === m ? "idle" : m);
  };

  return (
    <Box
      position="absolute"
      bottom={{ base: 3, md: 4 }}
      left={{ base: 2, md: 4 }}
      // zIndex 1000 — encima de panes de Leaflet (≤700) y de la mayoría de
      // controls. Se mantiene por debajo del FAB del panel (1100) y drawers.
      zIndex={1000}
      bg="bg.glass"
      backdropFilter="blur(8px)"
      border="1px solid"
      borderColor="border.strong"
      borderRadius="xl"
      boxShadow="0 12px 40px rgba(0,0,0,0.6)"
      overflow="hidden"
      // En móvil deja sitio a la derecha para el FAB del panel lateral.
      maxW={{ base: "calc(100vw - 88px)", md: "none" }}
    >
      <HStack
        spacing={0}
        align="stretch"
        divider={<Box w="1px" bg="border.subtle" />}
        overflowX="auto"
        sx={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {TOOLS.map((t) => {
          const active = mode === t.mode;
          return (
            <Tooltip key={t.mode} label={t.label} placement="top" hasArrow>
              <Box
                as="button"
                onClick={() => handleSelect(t.mode)}
                px={{ base: 2, md: 3 }}
                py={2.5}
                bg={active ? "accent.tealSoft" : "transparent"}
                color={active ? "accent.teal" : "text.secondary"}
                borderTop={active ? "2px solid" : "2px solid transparent"}
                borderTopColor={active ? "accent.teal" : "transparent"}
                _hover={{ bg: "bg.panelRaised", color: "text.primary" }}
                transition="all 0.12s ease"
                minW={{ base: "60px", md: "78px" }}
                flexShrink={0}
              >
                <VStack spacing={1}>
                  <Icon as={t.icon} boxSize={4} />
                  <Text
                    fontSize="9px"
                    fontFamily="mono"
                    fontWeight={900}
                    letterSpacing="widest"
                    color="inherit"
                  >
                    {t.short}
                  </Text>
                </VStack>
              </Box>
            </Tooltip>
          );
        })}
      </HStack>

      {mode !== "idle" && (
        <Box
          px={3}
          py={2}
          bg="bg.panel"
          borderTop="1px solid"
          borderColor="border.subtle"
        >
          {/* Selector de forma — sólo cuando el modo es perímetro */}
          {mode === "perimeter" && (
            <HStack spacing={1} mb={2}>
              <Text
                fontSize="9px"
                fontWeight={900}
                letterSpacing="widest"
                color="text.label"
                textTransform="uppercase"
                mr={1}
              >
                Forma
              </Text>
              <ShapeToggleButton
                active={perimeterShape === "polygon"}
                icon={MdTimeline}
                label="Polígono"
                onClick={() => setPerimeterShape("polygon")}
              />
              <ShapeToggleButton
                active={perimeterShape === "circle"}
                icon={MdRadioButtonUnchecked}
                label="Círculo"
                onClick={() => setPerimeterShape("circle")}
              />
            </HStack>
          )}
          <HStack spacing={3} flexWrap={{ base: "wrap", md: "nowrap" }}>
            <Box
              w="6px"
              h="6px"
              borderRadius="full"
              bg="accent.teal"
              animation="tactical-pulse 1.4s ease-in-out infinite"
              boxShadow="0 0 8px var(--chakra-colors-accent-teal)"
              flexShrink={0}
            />
            <Text fontSize="11px" color="text.primary" fontWeight={600} flex="1" minW={{ base: "180px", md: 0 }}>
              {mode === "closure"
                ? drawingPoints.length === 0
                  ? "Pulsa el PUNTO A donde empieza el corte."
                  : drawingPoints.length === 1
                    ? "Pulsa el PUNTO B donde termina el corte."
                    : "Tramo definido. Confirmando..."
                : mode === "perimeter" && perimeterShape === "circle"
                  ? !circleCenter
                    ? "Pulsa en el mapa para fijar el CENTRO del círculo."
                    : circleRadius === 0
                      ? "Mueve el ratón para ajustar el RADIO. Pulsa para confirmar."
                      : "Círculo definido. Pulsa Finalizar para activarlo."
                  : MODE_INSTRUCTIONS[mode]}
            </Text>
            {mode === "perimeter" && perimeterShape === "polygon" && (
              <Text fontSize="10px" fontFamily="mono" color="accent.teal" fontWeight={800}>
                {drawingPoints.length} pt
              </Text>
            )}
            {mode === "perimeter" && perimeterShape === "circle" && circleCenter && (
              <Text fontSize="10px" fontFamily="mono" color="accent.teal" fontWeight={800}>
                Radio: {formatMeters(circleRadius > 0 ? circleRadius : previewRadius)}
              </Text>
            )}
            {mode === "closure" && (
              <Text fontSize="10px" fontFamily="mono" color="state.critical" fontWeight={800}>
                {drawingPoints.length}/2
              </Text>
            )}
            <TacticalButton size="xs" variant="tactical-ghost" icon={MdClose} onClick={cancel}>
              Cancelar
            </TacticalButton>
          </HStack>
        </Box>
      )}
    </Box>
  );
};

// Botón compacto para alternar entre polígono y círculo dentro de la toolbar.
const ShapeToggleButton = ({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: IconType;
  label: string;
  onClick: () => void;
}) => (
  <Tooltip label={label} placement="top" hasArrow>
    <Box
      as="button"
      onClick={onClick}
      px={2}
      py={1}
      borderRadius="md"
      bg={active ? "accent.tealSoft" : "transparent"}
      color={active ? "accent.teal" : "text.secondary"}
      border="1px solid"
      borderColor={active ? "accent.teal" : "border.subtle"}
      _hover={{ bg: "bg.panelRaised", color: "text.primary" }}
      transition="all 0.12s ease"
    >
      <HStack spacing={1}>
        <Icon as={icon} boxSize={3.5} />
        <Text fontSize="9px" fontFamily="mono" fontWeight={900} letterSpacing="widest">
          {label.toUpperCase()}
        </Text>
      </HStack>
    </Box>
  </Tooltip>
);

// Separate finalize button used inside the perimeter modal trigger.
export const PerimeterFinalizeFloating = ({ onFinalize }: { onFinalize: () => void }) => {
  const mode = useSeguridadStore((s) => s.mode);
  const points = useSeguridadStore((s) => s.drawingPoints);
  const shape = useSeguridadStore((s) => s.perimeterShape);
  const circleCenter = useSeguridadStore((s) => s.circleCenter);
  const circleRadius = useSeguridadStore((s) => s.circleRadius);

  if (mode !== "perimeter") return null;

  const polygonReady = shape === "polygon" && points.length >= 3;
  const circleReady = shape === "circle" && !!circleCenter && circleRadius > 0;
  if (!polygonReady && !circleReady) return null;

  const label = circleReady
    ? `Finalizar perímetro (radio ${formatMeters(circleRadius)})`
    : `Finalizar perímetro (${points.length} pt)`;

  return (
    <Box
      position="absolute"
      top={{ base: 2, md: "auto" }}
      bottom={{ md: 4 }}
      right={{ base: 2, md: 4 }}
      zIndex={1000}
      maxW={{ base: "calc(100vw - 16px)", md: "none" }}
    >
      <TacticalButton
        size="sm"
        variant="tactical-primary"
        icon={MdCheckCircle}
        onClick={onFinalize}
      >
        {label}
      </TacticalButton>
    </Box>
  );
};
