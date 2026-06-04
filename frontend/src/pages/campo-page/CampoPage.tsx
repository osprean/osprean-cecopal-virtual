import {
  Box,
  Circle,
  Divider,
  Flex,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { MdSignalCellularAlt, MdBatteryFull, MdMyLocation } from "react-icons/md";
import { useFakeRealtime } from "../../hooks";
import { LiveIndicator } from "../../components/base";
import { useCampoStore } from "../../store";
import { VoiceReportButton } from "./VoiceReportButton";
import {
  ActiveTaskCard,
  EmergencyActionButtons,
  FieldReportsFeed,
  FieldStatusCard,
  IncomingTasksList,
  NavigationPanel,
  QuickIncidentReport,
} from "./CampoSections";

// Mobile/tablet-first layout. Single column, large tap targets, minimal chrome.
// On desktop the same layout simply caps width to 720px and centers — feels
// like a deployed terminal regardless of viewport.
export const CampoPage = () => {
  useFakeRealtime({ intervalMs: 12000 });
  const unit = useCampoStore((s) => s.unit);

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="bg.base" overflow="hidden">
      {/* Compact field header */}
      <Flex
        h="44px"
        px={3}
        align="center"
        bg="white"
        borderBottom="1px solid"
        borderColor="border.subtle"
        flexShrink={0}
        gap={3}
      >
        <Circle size="22px" bg="state.active" color="white">
          <Icon as={MdMyLocation} boxSize={3} />
        </Circle>
        <Text fontSize="11px" fontWeight={900} letterSpacing="widest" color="text.primary" textTransform="uppercase">
          CAMPO · {unit.callSign}
        </Text>
        <Box flex="1" />
        <HStack spacing={2}>
          <HStack spacing={1}>
            <Icon as={MdSignalCellularAlt} color="state.operational" boxSize={3} />
            <Text fontSize="10px" fontFamily="mono" fontWeight={800} color="text.secondary">
              4G
            </Text>
          </HStack>
          <Divider orientation="vertical" h="20px" borderColor="border.subtle" />
          <HStack spacing={1}>
            <Icon as={MdBatteryFull} color={unit.battery > 30 ? "state.operational" : "state.alert"} boxSize={3} />
            <Text fontSize="10px" fontFamily="mono" fontWeight={800} color="text.secondary">
              {unit.battery}%
            </Text>
          </HStack>
          <Divider orientation="vertical" h="20px" borderColor="border.subtle" />
          <LiveIndicator active size="xs" label="EN LÍNEA" pausedLabel="OFFLINE" />
        </HStack>
      </Flex>

      <Box flex="1" minH={0} overflowY="auto" bg="bg.base">
        <Box maxW={{ base: "100%", md: "720px", lg: "960px" }} mx="auto" px={{ base: 2, md: 3 }} py={{ base: 2, md: 3 }}>
          <VStack spacing={{ base: 2, md: 3 }} align="stretch">
            <FieldStatusCard />
            <ActiveTaskCard />
            <IncomingTasksList />
            <VoiceReportButton />
            <EmergencyActionButtons />
            <QuickIncidentReport />
            <NavigationPanel />
            <FieldReportsFeed />
          </VStack>
        </Box>
      </Box>
    </Flex>
  );
};
