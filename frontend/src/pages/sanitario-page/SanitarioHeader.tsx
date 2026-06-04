import { Box, Divider, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import {
  MdMedicalServices,
  MdLocalHospital,
  MdLocalShipping,
  MdReportGmailerrorred,
  MdOutlineGroup,
} from "react-icons/md";
import { LiveIndicator } from "../../components/base";
import {
  selectActiveAmbulances,
  selectUnackSanitaryAlerts,
  useSanitarioStore,
} from "../../store";
import type { TriageColor } from "../../types";

const TRIAGE_TONE: Record<TriageColor, string> = {
  red: "state.critical",
  yellow: "state.pending",
  green: "state.operational",
  black: "text.primary",
  unset: "text.muted",
};

const TriageStat = ({ color, count }: { color: TriageColor; count: number }) => (
  <HStack
    spacing={1.5}
    px={2}
    py={1}
    borderRadius="md"
    border="1px solid"
    borderColor="border.subtle"
  >
    <Box w="10px" h="10px" borderRadius="2px" bg={TRIAGE_TONE[color]} />
    <Text fontSize="13px" fontFamily="mono" fontWeight={800} color={TRIAGE_TONE[color]}>
      {count}
    </Text>
  </HStack>
);

const Stat = ({
  icon: IconComp,
  label,
  value,
  tone = "active",
}: {
  icon: typeof MdMedicalServices;
  label: string;
  value: string | number;
  tone?: "critical" | "alert" | "operational" | "active" | "pending";
}) => (
  <HStack spacing={2}>
    <Icon as={IconComp} color={`state.${tone}`} boxSize={3.5} />
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

export const SanitarioHeader = () => {
  const victims = useSanitarioStore((s) => s.victims);
  const ambulances = useSanitarioStore(selectActiveAmbulances);
  const hospitals = useSanitarioStore((s) => s.hospitals);
  const unack = useSanitarioStore(selectUnackSanitaryAlerts);

  const counts: Record<TriageColor, number> = {
    red: 0, yellow: 0, green: 0, black: 0, unset: 0,
  };
  victims.forEach((v) => { counts[v.triage]++; });

  const totalSatRatio = hospitals.length > 0
    ? hospitals.reduce((acc, h) => acc + (h.beds.total - h.beds.available), 0) /
      hospitals.reduce((acc, h) => acc + h.beds.total, 0)
    : 0;

  return (
    <Flex
      minH={{ base: "44px", md: "48px" }}
      px={{ base: 3, md: 4 }}
      py={{ base: 1.5, md: 1 }}
      align="center"
      bg="white"
      borderBottom="1px solid"
      borderColor="border.subtle"
      gap={{ base: 2, md: 3, lg: 4 }}
      flexShrink={0}
      overflowX="auto"
      sx={{
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      <HStack spacing={2} flexShrink={0}>
        <Icon as={MdMedicalServices} color="state.critical" boxSize={4} />
        <Text fontSize="11px" fontWeight={900} letterSpacing="widest" color="text.primary" textTransform="uppercase" noOfLines={1}>
          <Box as="span" display={{ base: "none", md: "inline" }}>GRUPO </Box>SANITARIO
        </Text>
      </HStack>
      <Divider orientation="vertical" h="28px" borderColor="border.subtle" display={{ base: "none", md: "block" }} />

      <HStack spacing={1.5} flexShrink={0}>
        <Text fontSize="9px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mr={1} display={{ base: "none", md: "inline" }}>
          Triaje
        </Text>
        <TriageStat color="red" count={counts.red} />
        <TriageStat color="yellow" count={counts.yellow} />
        <TriageStat color="green" count={counts.green} />
        <TriageStat color="black" count={counts.black} />
      </HStack>

      <Divider orientation="vertical" h="28px" borderColor="border.subtle" display={{ base: "none", md: "block" }} />

      <Stat icon={MdLocalShipping} label="Ambul." value={ambulances.length} tone="active" />
      <Stat icon={MdLocalHospital} label="Saturación" value={`${Math.round(totalSatRatio * 100)}%`} tone={totalSatRatio > 0.85 ? "critical" : totalSatRatio > 0.7 ? "alert" : "operational"} />
      <Stat icon={MdOutlineGroup} label="Víctimas" value={victims.length} tone="alert" />
      {unack > 0 && <Stat icon={MdReportGmailerrorred} label="Pend." value={unack} tone="critical" />}

      <Box flex="1" minW={{ base: 2, lg: "auto" }} />
      <Box flexShrink={0} display={{ base: "none", md: "block" }}>
        <LiveIndicator active label="EN OPERACIÓN" pausedLabel="PAUSADO" />
      </Box>
    </Flex>
  );
};
