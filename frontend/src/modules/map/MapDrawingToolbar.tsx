import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Switch,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import {
  MdAutoFixHigh,
  MdBrush,
  MdClose,
  MdDeleteSweep,
  MdEdit,
  MdSend,
  MdUndo,
  MdVisibility,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { useDrawingStore, useMapLayerStore } from "../../store";
import { TacticalButton } from "../../components/base";
import { SendMapModal } from "./SendMapModal";

interface MapDrawingToolbarProps {
  // Identificador de la página actual para limitar trazos visibles.
  scope?: string;
  // Posición de la toolbar dentro del mapa.
  position?: "bottom-right" | "top-left" | "bottom-left";
}

const COLORS = ["#E53E3E", "#1F2937", "#1D4ED8", "#059669", "#F59E0B"];
const SIZES = [3, 5, 8];

export const MapDrawingToolbar = ({
  scope: _scope,
  position = "bottom-right",
}: MapDrawingToolbarProps) => {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);
  const undo = useDrawingStore((s) => s.undo);
  const clear = useDrawingStore((s) => s.clear);
  const strokes = useDrawingStore((s) => s.strokes);
  const color = useDrawingStore((s) => s.color);
  const setColor = useDrawingStore((s) => s.setColor);
  const width = useDrawingStore((s) => s.width);
  const setWidth = useDrawingStore((s) => s.setWidth);

  const hideWhileDrawing = useMapLayerStore((s) => s.hideWhileDrawing);
  const setHideWhileDrawing = useMapLayerStore((s) => s.setHideWhileDrawing);
  const setDrawingActive = useMapLayerStore((s) => s.setDrawingActive);

  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    setDrawingActive(tool !== "idle");
    return () => setDrawingActive(false);
  }, [tool, setDrawingActive]);

  // Leaflet sitúa su control de capas a top:10 / right:10. Replicamos la
  // misma cota vertical para que la toolbar quede alineada visualmente con el
  // botón de capas pero en el lado izquierdo.
  const positionStyle =
    position === "bottom-right"
      ? { bottom: 16, right: 16 }
      : position === "top-left"
        ? { top: 2, left: 2  }
        : { bottom: 16, left: 16 };

  const isActive = tool !== "idle";
  const hasStrokes = strokes.length > 0;
  const _suppress = _scope;

  return (
    <>
      <Box
        position="absolute"
        {...positionStyle}
        zIndex={1000}
        bg="bg.panel"
        border="1px solid"
        borderColor="border.strong"
        borderRadius="lg"
        boxShadow="0 4px 16px rgba(15,23,42,0.18)"
        p={isActive ? 1.5 : 0.5}
        pointerEvents="auto"
        maxW={{ base: "calc(100vw - 16px)", md: "none" }}
      >
        {!isActive ? (
          // Estado colapsado: solo un botón de lápiz. Hover → "Modo edición
          // mapa". Click → activa el modo dibujo y la toolbar se expande.
          <Tooltip label="Modo edición mapa" hasArrow placement="right">
            <IconButton
              size="sm"
              aria-label="Modo edición mapa"
              icon={<Icon as={MdEdit} boxSize={4} />}
              variant="ghost"
              color="text.secondary"
              _hover={{ bg: "bg.panelSubtle", color: "text.primary" }}
              onClick={() => setTool("draw")}
            />
          </Tooltip>
        ) : (
          <>
            <HStack spacing={1} flexWrap="wrap" rowGap={1}>
              <ToolButton
                label="Dibujar"
                icon={MdEdit}
                active={tool === "draw"}
                onClick={() => setTool(tool === "draw" ? "idle" : "draw")}
              />
              <ToolButton
                label="Goma (clic en trazo)"
                icon={MdAutoFixHigh}
                active={tool === "erase"}
                onClick={() => setTool(tool === "erase" ? "idle" : "erase")}
              />
              <ToolButton
                label="Deshacer último"
                icon={MdUndo}
                onClick={undo}
                disabled={!hasStrokes}
              />
              <ToolButton
                label="Borrar todo"
                icon={MdDeleteSweep}
                onClick={clear}
                disabled={!hasStrokes}
                tone="danger"
              />
              <Divider />
              <HStack spacing={1}>
                {COLORS.map((c) => (
                  <Box
                    key={c}
                    as="button"
                    type="button"
                    onClick={() => setColor(c)}
                    w="20px"
                    h="20px"
                    borderRadius="full"
                    bg={c}
                    border="2px solid"
                    borderColor={color === c ? "white" : "transparent"}
                    boxShadow={color === c ? `0 0 0 2px ${c}` : "0 0 0 1px rgba(0,0,0,0.15)"}
                    cursor="pointer"
                    aria-label={`Color ${c}`}
                  />
                ))}
              </HStack>
              <Divider />
              <HStack spacing={1}>
                {SIZES.map((s) => (
                  <Box
                    key={s}
                    as="button"
                    type="button"
                    onClick={() => setWidth(s)}
                    w="22px"
                    h="22px"
                    borderRadius="md"
                    bg={width === s ? "bg.panelRaised" : "transparent"}
                    border="1px solid"
                    borderColor={width === s ? "accent.teal" : "border.subtle"}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor="pointer"
                  >
                    <Box w={`${s + 3}px`} h={`${s + 3}px`} borderRadius="full" bg={color} />
                  </Box>
                ))}
              </HStack>
              <Divider />
              <TacticalButton
                size="xs"
                variant="tactical-primary"
                icon={MdSend}
                onClick={() => setSendOpen(true)}
              >
                Enviar
              </TacticalButton>
              <Tooltip label="Salir del modo dibujo (borra los trazos)" hasArrow>
                <IconButton
                  size="sm"
                  aria-label="Salir"
                  icon={<Icon as={MdClose} boxSize={4} />}
                  variant="ghost"
                  color="text.secondary"
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.strong"
                  _hover={{ bg: "state.criticalSoft", color: "state.critical", borderColor: "state.critical" }}
                  onClick={() => {
                    clear();
                    setTool("idle");
                  }}
                />
              </Tooltip>
            </HStack>
            {/* Pista contextual + toggle de visibilidad en una sola fila */}
            <Flex
              mt={1.5}
              px={2}
              py={1}
              bg="bg.panelSubtle"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="md"
              align={{ base: "stretch", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap={2}
            >
              <Icon as={tool === "erase" ? MdAutoFixHigh : MdBrush} boxSize={3} color="accent.teal" />
              <VStack spacing={0} align="start" lineHeight="1.2" flex="1" minW={0}>
                <Box
                  as="span"
                  fontSize="10px"
                  fontWeight={900}
                  letterSpacing="widest"
                  color="text.label"
                  textTransform="uppercase"
                >
                  {tool === "erase" ? "Modo goma" : "Modo lápiz"}
                </Box>
                <Box as="span" fontSize="10px" color="text.muted" noOfLines={1}>
                  {tool === "erase"
                    ? "Pasa sobre un trazo para borrarlo."
                    : "Arrastra para dibujar."}
                </Box>
              </VStack>

              <HStack
                spacing={1.5}
                align="center"
                px={2}
                py={1}
                bg="bg.panel"
                border="1px solid"
                borderColor="border.strong"
                borderRadius="md"
              >
                <Icon as={MdVisibility} boxSize={3.5} color="text.secondary" />
                <Text
                  fontSize="10px"
                  fontWeight={800}
                  color="text.secondary"
                  letterSpacing="wider"
                  textTransform="uppercase"
                  whiteSpace="nowrap"
                >
                  <Box as="span" display={{ base: "none", md: "inline" }}>Ver elementos en </Box>mapa
                </Text>
                <Switch
                  size="sm"
                  isChecked={!hideWhileDrawing}
                  onChange={(e) => setHideWhileDrawing(!e.target.checked)}
                  colorScheme="teal"
                  sx={{
                    ".chakra-switch__track": {
                      bg: "gray.400",
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                    },
                    ".chakra-switch__track[data-checked]": {
                      bg: "accent.teal",
                    },
                    ".chakra-switch__thumb": {
                      bg: "white",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    },
                  }}
                />
              </HStack>
            </Flex>
          </>
        )}
      </Box>

      <SendMapModal isOpen={sendOpen} onClose={() => setSendOpen(false)} />
      {/* prevent unused-var warnings */}
      <span style={{ display: "none" }} aria-hidden>{_suppress ?? ""}</span>
    </>
  );
};

const ToolButton = ({
  label,
  icon,
  active,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  icon: IconType;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) => (
  <Tooltip label={label} hasArrow openDelay={300}>
    <IconButton
      size="sm"
      aria-label={label}
      icon={<Icon as={icon} boxSize={4} />}
      variant={active ? "solid" : "ghost"}
      bg={active ? "accent.teal" : undefined}
      color={active ? "white" : tone === "danger" ? "state.critical" : "text.secondary"}
      _hover={
        active
          ? { bg: "accent.teal" }
          : { bg: "bg.panelSubtle", color: tone === "danger" ? "state.critical" : "text.primary" }
      }
      onClick={onClick}
      isDisabled={disabled}
    />
  </Tooltip>
);

const Divider = () => (
  <Box w="1px" h="22px" mx={0.5} bg="border.subtle" />
);
