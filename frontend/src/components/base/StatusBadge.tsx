import { Box, HStack, Icon, Text, type BoxProps } from "@chakra-ui/react";
import type { OperationalState } from "../../types";
import { OPERATIONAL_LABEL } from "../../types";
import { STATE_VISUAL } from "./stateConfig";

type StatusBadgeVariant = "subtle" | "solid" | "outline";
type StatusBadgeSize = "xs" | "sm" | "md";

interface StatusBadgeProps extends Omit<BoxProps, "children"> {
  state: OperationalState;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  label?: string;        // override default ALL CAPS label
  showIcon?: boolean;
  showDot?: boolean;     // small dot to the left
}

const SIZE_CONFIG: Record<StatusBadgeSize, { fontSize: string; px: number; py: number; iconSize: number; dotSize: string }> = {
  xs: { fontSize: "9px", px: 1.5, py: 0.5, iconSize: 2.5, dotSize: "5px" },
  sm: { fontSize: "10px", px: 2, py: 1, iconSize: 3, dotSize: "6px" },
  md: { fontSize: "11px", px: 2.5, py: 1, iconSize: 3.5, dotSize: "8px" },
};

export const StatusBadge = ({
  state,
  variant = "subtle",
  size = "sm",
  label,
  showIcon = true,
  showDot = false,
  ...rest
}: StatusBadgeProps) => {
  const cfg = STATE_VISUAL[state];
  const sizeCfg = SIZE_CONFIG[size];
  const text = label ?? OPERATIONAL_LABEL[state];

  const variantStyles: BoxProps =
    variant === "solid"
      ? { bg: cfg.solid, color: "white", border: "1px solid", borderColor: cfg.solid }
      : variant === "outline"
        ? { bg: "transparent", color: cfg.fg, border: "1px solid", borderColor: cfg.fg }
        : { bg: cfg.bg, color: cfg.fg, border: "1px solid", borderColor: "transparent" };

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      borderRadius="md"
      px={sizeCfg.px}
      py={sizeCfg.py}
      lineHeight="1"
      {...variantStyles}
      {...rest}
    >
      <HStack spacing={1.5}>
        {showDot && (
          <Box
            w={sizeCfg.dotSize}
            h={sizeCfg.dotSize}
            borderRadius="full"
            bg="currentColor"
            animation={cfg.pulse ? "tactical-pulse 1.6s ease-in-out infinite" : undefined}
            boxShadow={cfg.pulse ? "0 0 6px currentColor" : undefined}
          />
        )}
        {showIcon && !showDot && (
          <Icon as={cfg.icon} boxSize={sizeCfg.iconSize} />
        )}
        <Text
          fontSize={sizeCfg.fontSize}
          fontWeight={900}
          letterSpacing="widest"
          textTransform="uppercase"
          color="inherit"
        >
          {text}
        </Text>
      </HStack>
    </Box>
  );
};
