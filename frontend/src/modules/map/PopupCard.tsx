// Mini-card consistente usada dentro de <Popup> de leaflet. Mantiene el estilo
// tactical (kicker en mayúsculas + título + filas key/value compactas).
import { Box, Button, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { MdDeleteOutline } from "react-icons/md";

export interface PopupCardProps {
  kicker: string;
  title: string;
  rows?: Array<[string, string]>;
  footer?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}

export const PopupCard = ({
  kicker,
  title,
  rows = [],
  footer,
  onDelete,
  deleteLabel = "Borrar",
}: PopupCardProps) => (
  <Box minW="180px" maxW="260px" py={1}>
    <Text
      fontSize="9px"
      fontWeight={900}
      letterSpacing="widest"
      color="accent.teal"
      textTransform="uppercase"
      mb={0.5}
    >
      {kicker}
    </Text>
    <Text
      fontSize="13px"
      fontWeight={800}
      color="text.primary"
      lineHeight="1.2"
      mb={rows.length ? 2 : 0}
    >
      {title}
    </Text>
    {rows.length > 0 && (
      <VStack spacing={0.5} align="stretch">
        {rows.map(([k, v]) => (
          <HStack key={k} justify="space-between" spacing={3}>
            <Text fontSize="10px" color="text.label" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
              {k}
            </Text>
            <Text fontSize="11px" color="text.primary" fontWeight={700} textAlign="right" noOfLines={2}>
              {v}
            </Text>
          </HStack>
        ))}
      </VStack>
    )}
    {footer && (
      <Text mt={2} fontSize="10px" color="text.muted" fontFamily="mono" lineHeight="1.3">
        {footer}
      </Text>
    )}
    {onDelete && (
      <Button
        size="xs"
        mt={2.5}
        w="full"
        variant="outline"
        colorScheme="red"
        leftIcon={<Icon as={MdDeleteOutline} boxSize={3.5} />}
        fontSize="10px"
        fontWeight={800}
        letterSpacing="wider"
        textTransform="uppercase"
        onClick={onDelete}
      >
        {deleteLabel}
      </Button>
    )}
  </Box>
);
