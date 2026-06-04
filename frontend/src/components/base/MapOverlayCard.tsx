import { Box, Flex, HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import type { OperationalState } from "../../types";
import { STATE_VISUAL } from "./stateConfig";

const MotionDiv = motion.div;

interface MapOverlayCardProps {
  icon?: IconType;
  label: string;
  subLabel?: string;
  state?: OperationalState;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  width?: string | number;
  maxBodyHeight?: string | number;
  badge?: ReactNode;
}

// A collapsible card that floats on top of the tactical map. Header is always
// visible; the body expands/collapses. Designed to be stacked vertically inside
// a positioned container in a map cell.
export const MapOverlayCard = ({
  icon,
  label,
  subLabel,
  state,
  isOpen,
  onToggle,
  children,
  width = "100%",
  maxBodyHeight = "320px",
  badge,
}: MapOverlayCardProps) => {
  const cfg = state ? STATE_VISUAL[state] : null;
  const accent = cfg?.fg ?? "accent.teal";

  return (
    <Box
      w={width}
      bg="white"
      border="1px solid"
      borderColor="gray.100"
      borderLeft="3px solid"
      borderLeftColor={accent}
      borderRadius="xl"
      overflow="hidden"
    >
      <Flex
        as="button"
        type="button"
        onClick={onToggle}
        align="center"
        gap={2}
        px={3}
        py={2}
        w="100%"
        bg={isOpen ? "bg.panelRaised" : "bg.panel"}
        _hover={{ bg: "bg.panelRaised" }}
        transition="background 0.15s ease"
        cursor="pointer"
        textAlign="left"
        aria-expanded={isOpen}
      >
        {icon && <Icon as={icon} color={accent} boxSize={3.5} flexShrink={0} />}
        <Box flex="1" minW={0}>
          <Text
            fontSize="10px"
            letterSpacing="widest"
            color="text.label"
            fontWeight={900}
            textTransform="uppercase"
            noOfLines={1}
          >
            {label}
          </Text>
          {subLabel && (
            <Text fontSize="10px" color="text.muted" fontFamily="mono" fontWeight={700} noOfLines={1}>
              {subLabel}
            </Text>
          )}
        </Box>
        <HStack spacing={1} flexShrink={0}>
          {badge}
          <IconButton
            as="span"
            aria-label={isOpen ? "Colapsar" : "Expandir"}
            icon={<Icon as={isOpen ? MdExpandLess : MdExpandMore} boxSize={4} />}
            size="xs"
            variant="ghost"
            color="text.secondary"
            tabIndex={-1}
            pointerEvents="none"
          />
        </HStack>
      </Flex>
      <AnimatePresence initial={false}>
        {isOpen && (
          <MotionDiv
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <Box
              borderTop="1px solid"
              borderColor="border.subtle"
              maxH={maxBodyHeight}
              overflowY="auto"
              p={3}
            >
              {children}
            </Box>
          </MotionDiv>
        )}
      </AnimatePresence>
    </Box>
  );
};
