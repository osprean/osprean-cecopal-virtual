import { Box, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import type { OperationalState } from "../../types";
import { STATE_VISUAL } from "./stateConfig";

interface MetricBlockProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  state?: OperationalState;
  icon?: IconType;
  trend?: "up" | "down" | "flat";
}

const TREND_GLYPH: Record<NonNullable<MetricBlockProps["trend"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "▬",
};

export const MetricBlock = ({
  label,
  value,
  unit,
  hint,
  state,
  icon,
  trend,
}: MetricBlockProps) => {
  const cfg = state ? STATE_VISUAL[state] : null;
  const valueColor = cfg?.fg ?? "text.primary";

  return (
    <Box
      p={4}
      bg="bg.panelSubtle"
      border="1px solid"
      borderColor="border.subtle"
      borderLeft={cfg ? "3px solid" : "1px solid"}
      borderLeftColor={cfg?.fg ?? "border.subtle"}
      borderRadius="xl"
      minW={0}
    >
      <HStack spacing={1.5} mb={2}>
        {icon && <Icon as={icon} color={valueColor} boxSize={3} />}
        <Text
          fontSize="10px"
          letterSpacing="widest"
          textTransform="uppercase"
          color="text.label"
          fontWeight={900}
        >
          {label}
        </Text>
      </HStack>
      <Flex align="baseline" gap={1.5}>
        <Text
          fontSize="2xl"
          fontFamily="mono"
          fontWeight={800}
          color={valueColor}
          lineHeight="1"
        >
          {value}
        </Text>
        {unit && (
          <Text fontSize="xs" color="text.secondary" fontFamily="mono" fontWeight={700}>
            {unit}
          </Text>
        )}
        {trend && (
          <Text
            fontSize="11px"
            color={trend === "up" ? "state.operational" : trend === "down" ? "state.critical" : "text.muted"}
            fontFamily="mono"
            fontWeight={800}
            ml="auto"
          >
            {TREND_GLYPH[trend]}
          </Text>
        )}
      </Flex>
      {hint && (
        <Text fontSize="11px" color="text.muted" mt={1.5} lineHeight="short">
          {hint}
        </Text>
      )}
    </Box>
  );
};
