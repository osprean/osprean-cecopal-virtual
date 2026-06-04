import { Box, HStack, Icon, Text, VStack, Tooltip } from "@chakra-ui/react";
import {
  MdPersonAddAlt,
  MdMedicalServices,
  MdLocalShipping,
  MdLocalHospital,
  MdReportGmailerrorred,
  MdClose,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { TacticalButton } from "../../components/base";
import { useSanitarioStore } from "../../store";
import type { SanitaryDrawingMode } from "../../types";

interface ToolDef {
  mode: Exclude<SanitaryDrawingMode, "idle">;
  label: string;
  short: string;
  icon: IconType;
}

const TOOLS: ToolDef[] = [
  { mode: "victim", label: "Registrar víctima", short: "VÍCTIMA", icon: MdPersonAddAlt },
  { mode: "triage-point", label: "Punto de triaje", short: "TRIAJE", icon: MdMedicalServices },
  { mode: "first-aid", label: "Área de socorro", short: "SOCORRO", icon: MdLocalHospital },
];

interface Props {
  onOpenAmbulance: () => void;
  onOpenAlert: () => void;
}

export const SanitarioActionToolbar = ({ onOpenAmbulance, onOpenAlert }: Props) => {
  const mode = useSanitarioStore((s) => s.mode);
  const setMode = useSanitarioStore((s) => s.setMode);
  const cancel = useSanitarioStore((s) => s.cancelDrawing);

  return (
    <Box
      position="absolute"
      bottom={{ base: 3, md: 4 }}
      left={{ base: 2, md: 4 }}
      // zIndex 1000 — encima de panes de Leaflet (≤700).
      zIndex={1000}
      bg="bg.glass"
      backdropFilter="blur(10px)"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="2xl"
      boxShadow="0 12px 40px rgba(15,22,36,0.18)"
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
                onClick={() => setMode(active ? "idle" : t.mode)}
                px={{ base: 2, md: 3 }}
                py={2.5}
                bg={active ? "accent.tealSoft" : "transparent"}
                color={active ? "accent.teal" : "text.secondary"}
                borderTop={active ? "2px solid" : "2px solid transparent"}
                borderTopColor={active ? "accent.teal" : "transparent"}
                _hover={{ bg: "bg.panelSubtle", color: "text.primary" }}
                transition="all 0.12s ease"
                minW={{ base: "64px", md: "86px" }}
                flexShrink={0}
              >
                <VStack spacing={1}>
                  <Icon as={t.icon} boxSize={4} />
                  <Text fontSize="9px" fontFamily="mono" fontWeight={900} letterSpacing="widest" color="inherit">
                    {t.short}
                  </Text>
                </VStack>
              </Box>
            </Tooltip>
          );
        })}
        <Box w="1px" bg="border.subtle" />
        <Tooltip label="Solicitar ambulancia" placement="top" hasArrow>
          <Box
            as="button"
            onClick={onOpenAmbulance}
            px={{ base: 2, md: 3 }}
            py={2.5}
            color="text.secondary"
            _hover={{ bg: "bg.panelSubtle", color: "state.active" }}
            minW={{ base: "64px", md: "86px" }}
            flexShrink={0}
          >
            <VStack spacing={1}>
              <Icon as={MdLocalShipping} boxSize={4} />
              <Text fontSize="9px" fontFamily="mono" fontWeight={900} letterSpacing="widest" color="inherit">
                AMB.
              </Text>
            </VStack>
          </Box>
        </Tooltip>
        <Box w="1px" bg="border.subtle" />
        <Tooltip label="Lanzar alerta sanitaria" placement="top" hasArrow>
          <Box
            as="button"
            onClick={onOpenAlert}
            px={{ base: 2, md: 3 }}
            py={2.5}
            color="text.secondary"
            _hover={{ bg: "bg.panelSubtle", color: "state.critical" }}
            minW={{ base: "64px", md: "86px" }}
            flexShrink={0}
          >
            <VStack spacing={1}>
              <Icon as={MdReportGmailerrorred} boxSize={4} />
              <Text fontSize="9px" fontFamily="mono" fontWeight={900} letterSpacing="widest" color="inherit">
                ALERTA
              </Text>
            </VStack>
          </Box>
        </Tooltip>
      </HStack>

      {mode !== "idle" && (
        <Box px={3} py={2} bg="white" borderTop="1px solid" borderColor="border.subtle">
          <HStack spacing={3} flexWrap={{ base: "wrap", md: "nowrap" }}>
            <Box
              w="6px"
              h="6px"
              borderRadius="full"
              bg="accent.teal"
              animation="tactical-pulse 1.4s ease-in-out infinite"
              boxShadow="0 0 8px var(--chakra-colors-accent-teal)"
            />
            <Text fontSize="11px" color="text.primary" fontWeight={600} flex="1">
              Pulsa en el mapa donde quieras situar el punto.
            </Text>
            <TacticalButton size="xs" variant="tactical-ghost" icon={MdClose} onClick={cancel}>
              Cancelar
            </TacticalButton>
          </HStack>
        </Box>
      )}
    </Box>
  );
};
