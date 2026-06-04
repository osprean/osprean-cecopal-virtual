import {
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import type { OperationalState } from "../../types";
import { STATE_VISUAL } from "./stateConfig";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

interface TacticalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  code?: string;
  state?: OperationalState;
  icon?: IconType;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  closeOnOverlayClick?: boolean;
}

export const TacticalModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  code,
  state,
  icon,
  size = "md",
  footer,
  children,
  closeOnOverlayClick = true,
}: TacticalModalProps) => {
  const cfg = state ? STATE_VISUAL[state] : null;
  const HeaderIcon = icon ?? cfg?.icon;
  // En móvil cualquier modal se vuelve full-screen para garantizar legibilidad
  // y permitir formularios largos sin saltos. A partir de md respetamos el size.
  const resolvedSize = useBreakpointValue<ModalSize>(
    { base: "full", md: size },
    { fallback: "md" },
  ) ?? size;
  const isFull = resolvedSize === "full";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={resolvedSize}
      isCentered={!isFull}
      motionPreset={isFull ? "slideInBottom" : "scale"}
      closeOnOverlayClick={closeOnOverlayClick}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent
        m={isFull ? 0 : undefined}
        borderRadius={isFull ? 0 : undefined}
        maxH={isFull ? "100dvh" : undefined}
      >
        <ModalHeader>
          <HStack spacing={3} align="center">
            {HeaderIcon && (
              <Icon as={HeaderIcon} color={cfg?.fg ?? "accent.teal"} boxSize={4} />
            )}
            <Text
              as="span"
              fontSize="sm"
              fontWeight={900}
              letterSpacing="widest"
              textTransform="uppercase"
              color="text.primary"
            >
              {title}
            </Text>
            {code && (
              <Text
                as="span"
                fontSize="11px"
                fontFamily="mono"
                color="text.muted"
                letterSpacing="wide"
              >
                · {code}
              </Text>
            )}
          </HStack>
          {subtitle && (
            <Text
              fontSize="xs"
              color="text.secondary"
              fontWeight={500}
              mt={1}
              textTransform="none"
              letterSpacing="normal"
            >
              {subtitle}
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </Modal>
  );
};
