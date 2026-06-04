import { Box, Divider, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import {
  MdArticle,
  MdSend,
  MdCampaign,
  MdPodcasts,
  MdGroups,
} from "react-icons/md";
import { LiveIndicator } from "../../components/base";
import { useDireccionStore, useGabineteStore } from "../../store";

const Stat = ({
  icon: IconComp, label, value, tone = "active",
}: {
  icon: typeof MdArticle;
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

export const GabineteHeader = () => {
  const communiques = useDireccionStore((s) => s.communiques);
  const channels = useGabineteStore((s) => s.channels);
  const publications = useGabineteStore((s) => s.publications);

  const drafts = communiques.filter((c) => c.status === "draft" || c.status === "pending-approval").length;
  const sent = publications.filter((p) => p.status === "published").length;
  const channelsOnline = channels.filter((c) => c.status === "online").length;
  const totalReach = publications
    .filter((p) => p.status === "published")
    .reduce((acc, p) => acc + (p.reach ?? 0), 0);

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
        <Icon as={MdCampaign} color="accent.teal" boxSize={4} />
        <Text fontSize="11px" fontWeight={900} letterSpacing="widest" color="text.primary" textTransform="uppercase" noOfLines={1}>
          GABINETE<Box as="span" display={{ base: "none", md: "inline" }}> · DIFUSIÓN</Box>
        </Text>
      </HStack>
      <Divider orientation="vertical" h="28px" borderColor="border.subtle" display={{ base: "none", md: "block" }} />
      <Stat icon={MdArticle} label="Borrad." value={drafts} tone={drafts > 0 ? "alert" : "operational"} />
      <Stat icon={MdSend} label="Public." value={sent} tone="operational" />
      <Stat icon={MdPodcasts} label="Canales" value={`${channelsOnline}/${channels.length}`} tone={channelsOnline === channels.length ? "operational" : "alert"} />
      <Stat icon={MdGroups} label="Alcance" value={totalReach.toLocaleString("es-ES")} tone="active" />
      <Box flex="1" minW={{ base: 2, lg: "auto" }} />
      <Box flexShrink={0} display={{ base: "none", md: "block" }}>
        <LiveIndicator active label="DIFUSIÓN ACTIVA" pausedLabel="EN PAUSA" />
      </Box>
    </Flex>
  );
};
