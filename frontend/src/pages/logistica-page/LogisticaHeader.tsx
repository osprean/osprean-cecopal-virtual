import { Box, Divider, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import {
  MdInventory2,
  MdLocalShipping,
  MdBuild,
  MdReportGmailerrorred,
  MdHomeWork,
  MdPowerSettingsNew,
} from "react-icons/md";
import { LiveIndicator } from "../../components/base";
import {
  selectCriticalSupplies,
  selectPendingLogisticsCount,
  selectServicesAffected,
  useDireccionStore,
  useLogisticaStore,
} from "../../store";

const Stat = ({
  icon: IconComp,
  label,
  value,
  tone = "active",
}: {
  icon: typeof MdInventory2;
  label: string;
  value: string | number;
  tone?: "critical" | "alert" | "operational" | "active" | "pending";
}) => (
  <HStack spacing={2}>
    <Icon as={IconComp} color={`state.${tone}`} boxSize={3.5} />
    <Box>
      <Text fontSize="9px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" lineHeight="1">
        {label}
      </Text>
      <Text fontSize="13px" fontFamily="mono" fontWeight={800} color={`state.${tone}`} lineHeight="1.1">
        {value}
      </Text>
    </Box>
  </HStack>
);

export const LogisticaHeader = () => {
  const supplies = useLogisticaStore((s) => s.supplies);
  const vehicles = useLogisticaStore((s) => s.vehicles);
  const machinery = useLogisticaStore((s) => s.machinery);
  const critical = useLogisticaStore(selectCriticalSupplies);
  const pending = useLogisticaStore(selectPendingLogisticsCount);
  const servicesAffected = useLogisticaStore(selectServicesAffected);
  const shelters = useDireccionStore((s) => s.shelters);

  const sheltersOcc = shelters.reduce((a, s) => a + s.occupancy, 0);
  const sheltersCap = shelters.reduce((a, s) => a + s.capacity, 0);

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
        <Icon as={MdInventory2} color="accent.teal" boxSize={4} />
        <Text fontSize="11px" fontWeight={900} letterSpacing="widest" color="text.primary" textTransform="uppercase" noOfLines={1}>
          <Box as="span" display={{ base: "none", md: "inline" }}>GRUPO </Box>LOGÍSTICO
        </Text>
      </HStack>
      <Divider orientation="vertical" h="28px" borderColor="border.subtle" display={{ base: "none", md: "block" }} />
      <Stat icon={MdInventory2} label="Recursos" value={supplies.length} tone="active" />
      <Stat icon={MdReportGmailerrorred} label="Críticos" value={critical.length} tone={critical.length > 0 ? "critical" : "operational"} />
      <Stat icon={MdLocalShipping} label="Vehíc." value={vehicles.length} tone="active" />
      <Stat icon={MdBuild} label="Maquin." value={machinery.length} tone="active" />
      <Stat icon={MdHomeWork} label="Alberg." value={`${sheltersOcc}/${sheltersCap}`} tone={sheltersOcc / Math.max(1, sheltersCap) > 0.8 ? "alert" : "operational"} />
      <Stat icon={MdPowerSettingsNew} label="Serv. afect." value={servicesAffected.length} tone={servicesAffected.length > 0 ? "alert" : "operational"} />
      {pending > 0 && <Stat icon={MdReportGmailerrorred} label="Pend." value={pending} tone="alert" />}
      <Box flex="1" minW={{ base: 2, lg: "auto" }} />
      <Box flexShrink={0} display={{ base: "none", md: "block" }}>
        <LiveIndicator active label="EN OPERACIÓN" pausedLabel="PAUSADO" />
      </Box>
    </Flex>
  );
};
