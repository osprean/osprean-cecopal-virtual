import { Box, HStack, Icon, Text } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import {
  MdGavel,
  MdShield,
  MdMedicalServices,
  MdInventory2,
  MdCampaign,
  MdPersonPin,
} from "react-icons/md";
import { useTabsStore } from "../store";
import type { TabKey } from "../types";

const TAB_ICONS: Record<TabKey, IconType> = {
  direccion: MdGavel,
  seguridad: MdShield,
  sanitario: MdMedicalServices,
  logistica: MdInventory2,
  gabinete: MdCampaign,
  campo: MdPersonPin,
};

const TAB_SHORT: Record<TabKey, string> = {
  direccion: "DIR",
  seguridad: "SEG",
  sanitario: "SAN",
  logistica: "LOG",
  gabinete: "GAB",
  campo: "CAM",
};

// Barra inferior tipo app nativa para móvil: 6 pestañas con icono + etiqueta
// abreviada. Está pensada para uso en campo (pulgar). Solo se renderiza en
// breakpoints `base`/`sm` desde TacticalLayout.
export const MobileBottomNav = () => {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTab = useTabsStore((s) => s.activeTab);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);

  return (
    <Box
      as="nav"
      bg="white"
      borderTop="1px solid"
      borderColor="border.subtle"
      flexShrink={0}
      px={1}
      py={1}
      boxShadow="0 -2px 12px -4px rgba(15,22,36,0.08)"
      // Respeta safe-area iOS (notch / barra inferior).
      pb="calc(env(safe-area-inset-bottom, 0px) + 4px)"
    >
      <HStack spacing={0} align="stretch" justify="space-between">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const IconComp = TAB_ICONS[tab.key];
          return (
            <Box
              key={tab.key}
              as="button"
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              flex="1"
              minW={0}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={0.5}
              px={1}
              py={1.5}
              borderRadius="lg"
              color={isActive ? "accent.tealDeep" : "text.muted"}
              bg={isActive ? "accent.tealSoft" : "transparent"}
              transition="background 0.15s ease, color 0.15s ease"
              _active={{ transform: "scale(0.96)" }}
              position="relative"
            >
              {isActive && (
                <Box
                  position="absolute"
                  top="2px"
                  left="50%"
                  transform="translateX(-50%)"
                  w="24px"
                  h="2px"
                  borderRadius="full"
                  bg="accent.teal"
                />
              )}
              <Icon as={IconComp} boxSize={5} opacity={isActive ? 1 : 0.7} />
              <Text
                fontSize="9px"
                fontWeight={isActive ? 900 : 700}
                letterSpacing="0.12em"
                textTransform="uppercase"
                lineHeight="1"
                noOfLines={1}
              >
                {TAB_SHORT[tab.key]}
              </Text>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
};
