import {
  Avatar,
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  type BoxProps,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { MdClose } from "react-icons/md";
import type { OperationalState } from "../../types";
import { STATE_VISUAL } from "./stateConfig";
import { StatusBadge } from "./StatusBadge";

const MotionDiv = motion.div;

interface RealtimeNotificationProps extends Omit<BoxProps, "title" | "onClick"> {
  state: OperationalState;
  title: string;
  message: string;
  source?: string;             // e.g. "AEMET", "Sensor TJ-12"
  timestamp?: string;          // pre-formatted (e.g. "12:43:08")
  category?: string;           // e.g. "FIRE SIM", "CHAT" (subtle badge)
  avatarName?: string;
  avatarSrc?: string;
  unread?: boolean;
  onOpen?: () => void;
  onDismiss?: () => void;
  actions?: ReactNode;
}

// Toast-like notification matching COMACON's notifications-menu MenuItem rhythm:
// avatar + title + category badge + message + status badge + timestamp.
// Animated entry from the right; supports unread borderLeft accent.
export const RealtimeNotification = ({
  state,
  title,
  message,
  source,
  timestamp,
  category,
  avatarName,
  avatarSrc,
  unread = false,
  onOpen,
  onDismiss,
  actions,
  ...rest
}: RealtimeNotificationProps) => {
  const cfg = STATE_VISUAL[state];

  return (
    <MotionDiv
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ minWidth: 320, maxWidth: 420 }}
    >
    <Box
      bg={unread ? "bg.panelSubtle" : "bg.panel"}
      border="1px solid"
      borderColor="border.subtle"
      borderLeft="4px solid"
      borderLeftColor={cfg.fg}
      borderRadius="xl"
      p={4}
      cursor={onOpen ? "pointer" : "default"}
      onClick={onOpen}
      _hover={onOpen ? { bg: "bg.panelRaised" } : undefined}
      transition="background 0.15s ease"
      boxShadow="0 6px 20px rgba(0,0,0,0.45)"
      {...rest}
    >
      <HStack spacing={3} align="start">
        <Avatar
          size="sm"
          src={avatarSrc}
          name={avatarName ?? source ?? title}
          bg={cfg.solid}
          color="white"
          icon={<Icon as={cfg.icon} boxSize="14px" />}
          border="1px solid"
          borderColor="border.subtle"
          flexShrink={0}
        />
        <Box flex="1" minW={0}>
          <Flex justify="space-between" align="center" gap={2} mb={0.5}>
            <Text
              fontSize="sm"
              fontWeight={800}
              color="text.primary"
              noOfLines={1}
              letterSpacing="tight"
            >
              {title}
            </Text>
            <HStack spacing={1} flexShrink={0}>
              {category && (
                <Box
                  px={1.5}
                  py={0.5}
                  fontSize="9px"
                  fontWeight={900}
                  letterSpacing="widest"
                  borderRadius="md"
                  bg={cfg.bg}
                  color={cfg.fg}
                >
                  {category}
                </Box>
              )}
              {onDismiss && (
                <IconButton
                  aria-label="Descartar notificación"
                  icon={<Icon as={MdClose} boxSize="12px" />}
                  size="xs"
                  variant="ghost"
                  color="text.muted"
                  _hover={{ color: "state.critical", bg: "transparent" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                />
              )}
            </HStack>
          </Flex>
          <Text
            fontSize="xs"
            color="text.secondary"
            noOfLines={3}
            lineHeight="short"
            mb={2}
          >
            {message}
          </Text>
          <Flex justify="space-between" align="center" gap={2}>
            <HStack spacing={2}>
              <StatusBadge state={state} size="xs" variant="subtle" />
              {source && (
                <Text fontSize="10px" color="text.muted" fontWeight={700} letterSpacing="wide">
                  {source}
                </Text>
              )}
            </HStack>
            <HStack spacing={2}>
              {actions}
              {timestamp && (
                <Text fontSize="10px" color="text.muted" fontFamily="mono" fontWeight={700}>
                  {timestamp}
                </Text>
              )}
            </HStack>
          </Flex>
        </Box>
      </HStack>
    </Box>
    </MotionDiv>
  );
};
