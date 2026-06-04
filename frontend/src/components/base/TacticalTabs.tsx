import { Box, Flex, HStack, Icon, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import type { IconType } from "react-icons";
import type { ReactNode } from "react";

export interface TacticalTabItem<T extends string = string> {
  key: T;
  label?: string;
  shortLabel?: string;        // mono code (e.g. ALR)
  icon?: IconType;
  badge?: number | null;
  badgeColor?: string;        // token, defaults state.critical
  disabled?: boolean;
}

interface TacticalTabsProps<T extends string = string> {
  tabs: TacticalTabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
  variant?: "panel" | "bar";  // panel = inside a card; bar = full-width strip
  rightSlot?: ReactNode;
  // Si true, cada tab ocupa la misma fracción del ancho disponible.
  fullWidth?: boolean;
}

export function TacticalTabs<T extends string = string>({
  tabs,
  active,
  onChange,
  size = "md",
  variant = "bar",
  rightSlot,
  fullWidth = false,
}: TacticalTabsProps<T>) {
  const isPanel = variant === "panel";
  const height = size === "sm" ? "32px" : "40px";

  return (
    <Flex
      role="tablist"
      h={height}
      bg={isPanel ? "transparent" : "bg.panel"}
      borderBottom="1px solid"
      borderColor="border.strong"
      px={isPanel ? 0 : 3}
      align="stretch"
      flexShrink={0}
      overflowX={fullWidth ? "hidden" : "auto"}
      overflowY="hidden"
      sx={{
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Box
            key={tab.key}
            as="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.key)}
            position="relative"
            px={size === "sm" ? 3 : 4}
            display="flex"
            alignItems="center"
            justifyContent={fullWidth ? "center" : "flex-start"}
            cursor={tab.disabled ? "not-allowed" : "pointer"}
            opacity={tab.disabled ? 0.4 : 1}
            color={isActive ? "accent.teal" : "text.secondary"}
            bg={isActive ? "bg.panelRaised" : "transparent"}
            transition="color 0.15s ease, background 0.15s ease"
            _hover={{ color: "text.primary", bg: "bg.panelRaised" }}
            _focusVisible={{
              outline: "none",
              boxShadow: "inset 0 0 0 2px var(--chakra-colors-accent-teal)",
            }}
            flex={fullWidth ? "1 1 0" : undefined}
            flexShrink={fullWidth ? 1 : 0}
          >
            <HStack spacing={2}>
              {tab.icon && <Icon as={tab.icon} boxSize={3.5} />}
              {tab.shortLabel && (
                <Text
                  fontSize="10px"
                  letterSpacing="widest"
                  fontWeight={900}
                  fontFamily="mono"
                  color="inherit"
                >
                  {tab.shortLabel}
                </Text>
              )}
              {tab.label && (
                <Text
                  fontSize={size === "sm" ? "11px" : "12px"}
                  letterSpacing="wider"
                  textTransform="uppercase"
                  fontWeight={700}
                  color="inherit"
                >
                  {tab.label}
                </Text>
              )}
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <Box
                  px={1.5}
                  fontSize="10px"
                  fontFamily="mono"
                  fontWeight={900}
                  bg={tab.badgeColor ?? "state.criticalSoft"}
                  color={tab.badgeColor ? "white" : "state.critical"}
                  borderRadius="md"
                  lineHeight="16px"
                  border="1px solid"
                  borderColor={tab.badgeColor ?? "state.critical"}
                >
                  {tab.badge > 99 ? "99+" : tab.badge}
                </Box>
              )}
            </HStack>
            {isActive && (
              <Box
                as={motion.div}
                layoutId={`tactical-tabs-underline-${variant}`}
                position="absolute"
                left={0}
                right={0}
                bottom={0}
                h="2px"
                bg="accent.teal"
              />
            )}
          </Box>
        );
      })}
      {rightSlot && (
        <Flex flex="1" align="center" justify="flex-end" pl={3} gap={2}>
          {rightSlot}
        </Flex>
      )}
    </Flex>
  );
}
