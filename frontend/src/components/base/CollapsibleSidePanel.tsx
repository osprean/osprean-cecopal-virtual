import { Box, Flex, Icon, IconButton, Text, Tooltip, useBreakpointValue } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { MdChevronLeft, MdChevronRight, MdClose, MdMenu } from "react-icons/md";
import type { ReactNode } from "react";

const MotionBox = motion(Box);

interface CollapsibleSidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  width?: string | number;
  collapsedWidth?: string | number;
  label?: string;
  // Contenido extra que se muestra en el modo colapsado (p.ej. badges de
  // notificaciones por tab). Va entre el botón circular y la etiqueta vertical.
  collapsedBadges?: ReactNode;
  children: ReactNode;
}

// Side panel con dos modos según breakpoint:
//  - Desktop (lg+): pestaña lateral colapsable con badges verticales.
//  - Móvil/tablet portrait: botón flotante (FAB con badges) + sheet bottom
//    a pantalla completa cuando se abre. Adecuado para PMA en campo.
export const CollapsibleSidePanel = ({
  isOpen,
  onToggle,
  width = "340px",
  collapsedWidth = "44px",
  label = "Panel",
  collapsedBadges,
  children,
}: CollapsibleSidePanelProps) => {
  const isCompact = useBreakpointValue(
    { base: true, lg: false },
    { fallback: "lg" },
  );

  if (isCompact) {
    return (
      <>
        {/* FAB compacto de apertura. Posición fija a media altura del lado
            derecho del mapa — fuera de la zona inferior donde viven action
            toolbars y overlay cards. Pensado para el pulgar. */}
        {!isOpen && (
          <Tooltip label={`Abrir ${label}`} placement="left" hasArrow openDelay={250}>
            <Box
              as="button"
              type="button"
              onClick={onToggle}
              aria-label={`Abrir ${label}`}
              aria-expanded={false}
              position="absolute"
              right={3}
              bottom={3}
              // zIndex 1100 — por encima de los controles de Leaflet (≤1000).
              zIndex={1100}
              w="56px"
              h="56px"
              borderRadius="full"
              bg="accent.teal"
              color="white"
              boxShadow="0 12px 28px -8px rgba(49,151,149,0.6), 0 4px 10px -4px rgba(15,22,36,0.2)"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap="2px"
              cursor="pointer"
              transition="transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease"
              _hover={{ bg: "accent.tealDeep" }}
              _active={{ transform: "scale(0.94)" }}
            >
              <Icon as={MdMenu} boxSize={5} />
              <Text
                fontSize="8px"
                fontWeight={900}
                letterSpacing="0.12em"
                textTransform="uppercase"
                lineHeight="1"
                noOfLines={1}
              >
                {label.length > 6 ? label.slice(0, 6) : label}
              </Text>
              {/* Punto/contador resumido de los badges colapsados. Si hay
                  collapsedBadges asumimos que pueden tener cuenta — mostramos
                  un dot crítico discreto en la esquina. */}
              {collapsedBadges && (
                <Box
                  position="absolute"
                  top="-2px"
                  right="-2px"
                  w="14px"
                  h="14px"
                  borderRadius="full"
                  bg="state.critical"
                  border="2px solid white"
                  boxShadow="0 2px 6px rgba(15,22,36,0.25)"
                />
              )}
            </Box>
          </Tooltip>
        )}

        <AnimatePresence initial={false}>
          {isOpen && (
            <MotionBox
              key="mobile-sheet"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              position="absolute"
              top={0}
              right={0}
              bottom={0}
              left={0}
              // zIndex 1150 — encima de Leaflet (≤1000) y FAB (1100), por
              // debajo de los drawers globales (1200).
              zIndex={1150}
              bg="white"
              display="flex"
              flexDirection="column"
              overflow="hidden"
              borderTopRadius="2xl"
              boxShadow="0 -10px 30px -10px rgba(15,22,36,0.25)"
            >
              {/* Header del sheet con drag handle y cierre */}
              <Box position="relative" flexShrink={0}>
                <Box
                  w="40px"
                  h="4px"
                  borderRadius="full"
                  bg="border.subtle"
                  position="absolute"
                  top="6px"
                  left="50%"
                  transform="translateX(-50%)"
                  pointerEvents="none"
                />
                <Flex
                  align="center"
                  px={4}
                  pt={4}
                  pb={2.5}
                  borderBottom="1px solid"
                  borderColor="border.subtle"
                >
                  <Text
                    fontSize="12px"
                    fontWeight={900}
                    letterSpacing="widest"
                    textTransform="uppercase"
                    color="text.primary"
                  >
                    {label}
                  </Text>
                  <Box flex="1" />
                  <IconButton
                    aria-label="Cerrar"
                    size="sm"
                    variant="ghost"
                    icon={<Icon as={MdClose} boxSize={5} />}
                    onClick={onToggle}
                  />
                </Flex>
              </Box>
              <Box flex="1" minH={0} overflow="hidden">
                {children}
              </Box>
            </MotionBox>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Modo desktop (lg+): comportamiento original.
  return (
    <Box
      h="100%"
      w={isOpen ? width : collapsedWidth}
      flexShrink={0}
      position="relative"
      transition="width 0.22s ease"
    >
      {isOpen && (
        <Tooltip label="Colapsar panel" placement="left" hasArrow openDelay={250}>
          <Box
            as="button"
            type="button"
            onClick={onToggle}
            aria-label="Colapsar panel"
            aria-expanded={true}
            position="absolute"
            top="16px"
            left="-14px"
            zIndex={10}
            w="28px"
            h="28px"
            borderRadius="full"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            boxShadow="md"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            color="text.secondary"
            transition="all 0.15s ease"
            _hover={{
              bg: "accent.teal",
              color: "white",
              borderColor: "accent.teal",
              transform: "scale(1.08)",
            }}
          >
            <Icon as={MdChevronRight} boxSize={4} />
          </Box>
        </Tooltip>
      )}

      <Flex
        h="100%"
        w="100%"
        bg="white"
        borderRadius="2xl"
        border="1px solid"
        borderColor="gray.100"
        boxShadow="xl"
        overflow="hidden"
      >
        {!isOpen ? (
          <Box
            as="button"
            type="button"
            onClick={onToggle}
            aria-label={`Expandir ${label}`}
            aria-expanded={false}
            w="100%"
            h="100%"
            bg="white"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            color="text.secondary"
            transition="all 0.18s ease"
            _hover={{ bg: "bg.panelSubtle", color: "accent.teal" }}
            role="button"
          >
            <Box
              w="28px"
              h="28px"
              borderRadius="full"
              bg="accent.teal"
              color="white"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="md"
              mb={3}
            >
              <Icon as={MdChevronLeft} boxSize={4} />
            </Box>
            {collapsedBadges && (
              <Box mb={3} display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                {collapsedBadges}
              </Box>
            )}
            <Text
              fontSize="11px"
              fontWeight={900}
              letterSpacing="widest"
              color="inherit"
              textTransform="uppercase"
              sx={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {label}
            </Text>
          </Box>
        ) : (
          <AnimatePresence initial={false}>
            <MotionBox
              key="panel-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              flex="1"
              minW={0}
              h="100%"
              overflow="hidden"
            >
              {children}
            </MotionBox>
          </AnimatePresence>
        )}
      </Flex>
    </Box>
  );
};
