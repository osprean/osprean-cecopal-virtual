import { Avatar, Box, Flex, HStack, Text, type BoxProps } from "@chakra-ui/react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { OperationalState } from "../../types";
import { STATE_VISUAL } from "./stateConfig";

const MotionDiv = motion.div;

interface TacticalCardProps extends Omit<BoxProps, "title"> {
  state?: OperationalState;
  selected?: boolean;
  unread?: boolean;          // COMACON pattern: borderLeft 4px when unread
  onSelect?: () => void;
  // Header
  title?: string;
  meta?: string;             // mono right-aligned (timestamp / code)
  subtitle?: string;
  // Avatar (COMACON shows avatars in notification cards)
  avatarSrc?: string;
  avatarName?: string;
  avatarColor?: string;
  // Right-side badges
  rightBadge?: ReactNode;
  // Footer slot (badges + timestamp etc.)
  footer?: ReactNode;
  children?: ReactNode;
  dense?: boolean;
}

export const TacticalCard = ({
  state,
  selected = false,
  unread = false,
  onSelect,
  title,
  meta,
  subtitle,
  avatarSrc,
  avatarName,
  avatarColor,
  rightBadge,
  footer,
  children,
  dense = false,
  ...rest
}: TacticalCardProps) => {
  const cfg = state ? STATE_VISUAL[state] : null;
  const showAvatar = Boolean(avatarSrc || avatarName);
  const accentColor = cfg?.fg ?? "accent.teal";

  return (
    <Box
      as={MotionDiv}
      whileTap={onSelect ? { scale: 0.995 } : undefined}
      onClick={onSelect}
      cursor={onSelect ? "pointer" : "default"}
      bg={selected ? "bg.panelRaised" : unread ? "bg.panelSubtle" : "bg.panel"}
      border="1px solid"
      borderColor={selected ? "accent.teal" : "border.subtle"}
      borderLeft={unread || cfg ? "4px solid" : "1px solid"}
      borderLeftColor={
        selected ? "accent.teal" : unread ? accentColor : cfg ? accentColor : "border.subtle"
      }
      borderRadius="xl"
      p={dense ? 3 : 4}
      transition="background 0.15s ease, border-color 0.15s ease"
      _hover={
        onSelect
          ? { bg: "bg.panelRaised", borderColor: "border.accent" }
          : undefined
      }
      _focusVisible={{
        outline: "none",
        boxShadow: "0 0 0 2px rgba(20, 184, 166, 0.6)",
      }}
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? "button" : undefined}
      {...rest}
    >
      <HStack spacing={3} align="start">
        {showAvatar && (
          <Avatar
            size={dense ? "xs" : "sm"}
            src={avatarSrc}
            name={avatarName}
            bg={avatarColor ?? accentColor}
            color="white"
            border="1px solid"
            borderColor="border.subtle"
            flexShrink={0}
          />
        )}
        <Box flex="1" minW={0}>
          {(title || meta || rightBadge) && (
            <Flex justify="space-between" align="baseline" mb={subtitle || children ? 1 : 0} gap={2}>
              {title && (
                <Text
                  fontSize="sm"
                  fontWeight={800}
                  color="text.primary"
                  noOfLines={1}
                  letterSpacing="tight"
                >
                  {title}
                </Text>
              )}
              <HStack spacing={2} flexShrink={0}>
                {rightBadge}
                {meta && (
                  <Text fontSize="10px" color="text.muted" fontFamily="mono" fontWeight={700}>
                    {meta}
                  </Text>
                )}
              </HStack>
            </Flex>
          )}
          {subtitle && (
            <Text fontSize="xs" color="text.secondary" noOfLines={2} lineHeight="short" mb={children ? 2 : 0}>
              {subtitle}
            </Text>
          )}
          {children}
          {footer && (
            <Flex justify="space-between" align="center" mt={3} gap={2}>
              {footer}
            </Flex>
          )}
        </Box>
      </HStack>
    </Box>
  );
};
