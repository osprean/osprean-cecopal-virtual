import { Box, HStack, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";

const MotionDiv = motion.div;

interface LiveIndicatorProps {
  active?: boolean;
  label?: string;        // defaults LIVE / PAUSED
  pausedLabel?: string;
  size?: "xs" | "sm";
}

export const LiveIndicator = ({
  active = true,
  label = "LIVE",
  pausedLabel = "PAUSED",
  size = "sm",
}: LiveIndicatorProps) => {
  const dot = size === "sm" ? "8px" : "6px";
  const fontSize = size === "sm" ? "10px" : "9px";

  return (
    <HStack
      spacing={1.5}
      px={2}
      py={1}
      borderRadius="md"
      bg={active ? "state.criticalSoft" : "state.offlineSoft"}
      border="1px solid"
      borderColor={active ? "state.critical" : "state.offline"}
    >
      <Box position="relative" w={dot} h={dot}>
        {active && (
          <MotionDiv
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background: "var(--chakra-colors-state-critical)",
            }}
            animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <Box
          position="relative"
          w={dot}
          h={dot}
          borderRadius="full"
          bg={active ? "state.critical" : "state.offline"}
          boxShadow={active ? "0 0 6px var(--chakra-colors-state-critical)" : undefined}
        />
      </Box>
      <Text
        fontSize={fontSize}
        fontWeight={900}
        letterSpacing="widest"
        color={active ? "state.critical" : "state.offline"}
        fontFamily="mono"
      >
        {active ? label : pausedLabel}
      </Text>
    </HStack>
  );
};
