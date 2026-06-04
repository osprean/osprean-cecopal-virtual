import { Box, HStack, Icon, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import type { OperationalState } from "../../types";
import { STATE_VISUAL } from "./stateConfig";

const MotionDiv = motion.div;

interface AlertBadgeProps {
  count: number;
  state?: OperationalState;
  label?: string;        // optional prefix label
  size?: "sm" | "md";
}

// Pulsing badge for unack counts. COMACON uses a small red dot for unread
// notifications (top-right corner of bell icon). This expands on that pattern.
export const AlertBadge = ({
  count,
  state = "critical",
  label,
  size = "sm",
}: AlertBadgeProps) => {
  if (count <= 0) return null;
  const cfg = STATE_VISUAL[state];
  const dim = size === "md" ? "22px" : "18px";
  const fontSize = size === "md" ? "11px" : "10px";

  return (
    <HStack spacing={1.5}>
      {label && (
        <Text
          fontSize="10px"
          fontWeight={800}
          color="text.label"
          letterSpacing="widest"
          textTransform="uppercase"
        >
          {label}
        </Text>
      )}
      <Box position="relative" minW={dim} h={dim}>
        {cfg.pulse && (
          <MotionDiv
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background: `var(--chakra-colors-state-${state})`,
            }}
            animate={{ scale: [1, 1.6], opacity: [0.55, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <Box
          position="relative"
          minW={dim}
          h={dim}
          px={count > 9 ? 1.5 : 0}
          borderRadius="full"
          bg={cfg.solid}
          color="white"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          boxShadow={`0 0 0 2px var(--chakra-colors-bg-base)`}
        >
          <HStack spacing={0.5}>
            <Icon as={cfg.icon} boxSize="9px" />
            <Text fontSize={fontSize} fontWeight={900} fontFamily="mono">
              {count > 99 ? "99+" : count}
            </Text>
          </HStack>
        </Box>
      </Box>
    </HStack>
  );
};
