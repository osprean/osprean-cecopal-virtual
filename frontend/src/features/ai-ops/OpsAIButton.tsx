import { Box, Icon, Text, Tooltip, useBreakpointValue } from "@chakra-ui/react";
import { MdAutoAwesome } from "react-icons/md";
import { useAiOpsStore } from "./aiOpsStore";

export const OpsAIButton = () => {
  const open = useAiOpsStore((s) => s.open);
  const setOpen = useAiOpsStore((s) => s.setOpen);
  const busy = useAiOpsStore((s) => s.busy);
  const showLabel = useBreakpointValue(
    { base: false, md: true },
    { fallback: "md" },
  );

  return (
    <Tooltip label={open ? "Cerrar Centro Operativo IA" : "Centro Operativo IA"} placement="bottom" hasArrow>
      <Box
        as="button"
        onClick={() => setOpen(!open)}
        alignSelf="center"
        px={{ base: 2, md: 3 }}
        py={1.5}
        borderRadius="lg"
        border="1px solid"
        borderColor="accent.teal"
        bg="white"
        color="accent.tealDeep"
        display="flex"
        alignItems="center"
        gap={2}
        transition="all 0.12s ease"
        boxShadow="0 0 0 0 rgba(49,151,149,0.4)"
        animation={busy ? "ops-pulse 1.4s ease-out infinite" : undefined}
        _hover={{ bg: "accent.teal", color: "white" }}
        _focusVisible={{ outline: "none", boxShadow: "0 0 0 3px rgba(49,151,149,0.35)" }}
        sx={{
          "@keyframes ops-pulse": {
            "0%": { boxShadow: "0 0 0 0 rgba(49,151,149,0.6)" },
            "70%": { boxShadow: "0 0 0 8px rgba(49,151,149,0)" },
            "100%": { boxShadow: "0 0 0 0 rgba(49,151,149,0)" },
          },
        }}
        aria-label="Centro Operativo IA"
      >
        <Icon as={MdAutoAwesome} boxSize={{ base: 5, md: 4 }} />
        {showLabel && (
          <Text fontSize="11px" fontWeight={800} letterSpacing="widest" textTransform="uppercase">
            Centro IA
          </Text>
        )}
      </Box>
    </Tooltip>
  );
};
