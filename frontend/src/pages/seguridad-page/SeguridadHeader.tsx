import { Box, Divider, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import {
  MdShield,
  MdBlock,
  MdLock,
  MdGesture,
  MdDirectionsRun,
  MdReportProblem,
} from "react-icons/md";
import {
  selectActiveClosures,
  selectActivePerimeters,
  selectClosedAccess,
  useDireccionStore,
  useSeguridadStore,
} from "../../store";
import { LiveIndicator } from "../../components/base";

const Stat = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: typeof MdShield;
  label: string;
  value: string | number;
  tone: "critical" | "alert" | "operational" | "active" | "pending";
}) => (
  <HStack spacing={2}>
    <Icon as={icon} color={`state.${tone}`} boxSize={3.5} />
    <Box>
      <Text
        fontSize="9px"
        color="text.label"
        fontWeight={900}
        letterSpacing="widest"
        textTransform="uppercase"
        lineHeight="1"
      >
        {label}
      </Text>
      <Text fontSize="13px" fontFamily="mono" fontWeight={800} color={`state.${tone}`} lineHeight="1.1">
        {value}
      </Text>
    </Box>
  </HStack>
);

export const SeguridadHeader = () => {
  const perimeters = useSeguridadStore(selectActivePerimeters);
  const closures = useSeguridadStore(selectActiveClosures);
  const closedAccess = useSeguridadStore(selectClosedAccess);
  const accessControls = useSeguridadStore((s) => s.accessControls);
  const checkpointCount = accessControls.filter((a) => a.kind === "checkpoint").length;
  const evacuations = useDireccionStore((s) => s.evacuations);
  const evacuated = evacuations.reduce((acc, e) => acc + e.evacuatedPeople, 0);

  return (
    <Flex
      minH={{ base: "44px", md: "48px" }}
      px={{ base: 3, md: 4 }}
      py={{ base: 1.5, md: 1 }}
      align="center"
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border.strong"
      flexShrink={0}
      gap={{ base: 2, md: 3, lg: 4 }}
      overflowX="auto"
      sx={{
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      <HStack spacing={2} flexShrink={0}>
        <Icon as={MdShield} color="accent.teal" boxSize={4} />
        <Text
          fontSize="11px"
          fontWeight={900}
          letterSpacing="widest"
          color="text.primary"
          textTransform="uppercase"
          noOfLines={1}
        >
          <Box as="span" display={{ base: "none", md: "inline" }}>GRUPO </Box>SEGURIDAD
        </Text>
      </HStack>
      <Divider orientation="vertical" h="28px" borderColor="border.subtle" display={{ base: "none", md: "block" }} />
      <Stat icon={MdGesture} label="Perímetros" value={perimeters.length} tone="alert" />
      <Stat icon={MdBlock} label="Cortes" value={closures.length} tone="critical" />
      <Stat icon={MdReportProblem} label="Controles" value={checkpointCount} tone="alert" />
      <Stat icon={MdLock} label="Accesos" value={closedAccess} tone="critical" />
      <Stat icon={MdDirectionsRun} label="Evacuados" value={evacuated} tone="active" />
      <Box flex="1" minW={{ base: 2, lg: "auto" }} />
      <Box flexShrink={0} display={{ base: "none", md: "block" }}>
        <LiveIndicator active label="EN OPERACIÓN" pausedLabel="PAUSADO" />
      </Box>
    </Flex>
  );
};
