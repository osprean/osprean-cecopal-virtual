import { useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  MdCall,
  MdContacts,
  MdGroups,
  MdLocalShipping,
  MdShield,
  MdMedicalServices,
  MdInventory2,
  MdCampaign,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  MapOverlayCard,
  StatusBadge,
} from "../../components/base";
import { useDireccionStore, useResourcesStore } from "../../store";
import type { OperationalState } from "../../types";

// 4 módulos visibles en la nueva tarjeta de grupos (sin command/intervention/
// technical/psychosocial). "gabinete" no existe como OperationalGroup, así que
// lo añadimos como entrada estática con su responsable de comunicación.
interface ModuleDef {
  key: "security" | "medical" | "logistics" | "gabinete";
  label: string;
  short: string;
  icon: IconType;
  phone: string;
}

const MODULES: ModuleDef[] = [
  { key: "security", label: "SEGURIDAD", short: "SEG", icon: MdShield, phone: "+34 911 02 03 04" },
  { key: "medical", label: "SANITARIO", short: "SAN", icon: MdMedicalServices, phone: "+34 911 02 03 05" },
  { key: "logistics", label: "LOGÍSTICA", short: "LOG", icon: MdInventory2, phone: "+34 911 02 03 06" },
  { key: "gabinete", label: "GABINETE", short: "GAB", icon: MdCampaign, phone: "+34 911 02 03 07" },
];

const GABINETE_FALLBACK: { leader: string; state: OperationalState } = {
  leader: "Resp. Gabinete · A. Soler",
  state: "active",
};

// Directorio telefónico básico — puede convertirse en un store si crece.
interface PhoneContact {
  name: string;
  role: string;
  phone: string;
  group: string;
}

const PHONE_DIRECTORY: PhoneContact[] = [
  { name: "J. Torres", role: "Director del Plan", phone: "+34 911 02 03 00", group: "MANDO" },
  { name: "Tte. Lara Méndez", role: "Jefe Intervención · PMA-Norte", phone: "+34 911 02 03 01", group: "INT" },
  { name: "Sgto. Núñez", role: "Jefe Seguridad", phone: "+34 911 02 03 04", group: "SEG" },
  { name: "Dra. Pereira", role: "Coord. Sanitario", phone: "+34 911 02 03 05", group: "SAN" },
  { name: "Coord. Romero", role: "Jefe Logística", phone: "+34 911 02 03 06", group: "LOG" },
  { name: "A. Soler", role: "Gabinete Comunicación", phone: "+34 911 02 03 07", group: "GAB" },
  { name: "112 Emergencias", role: "Sala 112", phone: "112", group: "EXT" },
  { name: "Guardia Civil", role: "COS Provincial", phone: "+34 062", group: "EXT" },
  { name: "CCAA · Protección Civil", role: "Centro Coordinador", phone: "+34 900 11 22 33", group: "EXT" },
];

export const DireccionMapOverlay = () => {
  const groups = useDireccionStore((s) => s.groups);
  const resources = useResourcesStore((s) => s.resources);

  // All collapsed on init.
  const [open, setOpen] = useState({
    groups: false,
    resources: false,
    directory: false,
  });

  const toggle = (k: keyof typeof open) =>
    setOpen((s) => ({ ...s, [k]: !s[k] }));

  const totalDeployed = resources.filter((r) => r.status === "deployed").length;

  // Layout horizontal en la esquina inferior derecha. Cada card se colapsa
  // de forma independiente; al estar todas colapsadas solo se ve la fila de
  // cabeceras.
  return (
    <Box
      position="absolute"
      bottom={3}
      right={{ base: "auto", md: 3 }}
      left={{ base: 2, md: "auto" }}
      // En móvil reserva espacio a la derecha para el FAB del panel.
      maxW={{ base: "calc(100vw - 88px)", md: "calc(100% - 24px)" }}
      // zIndex 1000 — encima de panes Leaflet (≤700).
      zIndex={1000}
      pointerEvents="none"
    >
      <HStack
        spacing={2}
        align="flex-end"
        justify={{ base: "flex-start", md: "flex-end" }}
        overflowX="auto"
        pb={1}
        sx={{
          "& > *": { pointerEvents: "auto", flexShrink: 0 },
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { height: "4px" },
        }}
      >
        <Box w={{ base: "240px", md: "280px" }}><MapOverlayCard
          icon={MdGroups}
          label="Estado de grupos"
          subLabel={`${MODULES.length} módulos operativos`}
          state="active"
          isOpen={open.groups}
          onToggle={() => toggle("groups")}
        >
          <VStack spacing={2} align="stretch">
            {MODULES.map((m) => {
              const g = groups.find(
                (x) => (x.type as string) === (m.key as string),
              );
              const stateToken: OperationalState =
                g?.state ?? (m.key === "gabinete" ? GABINETE_FALLBACK.state : "standby");
              const leader = g?.leader ?? (m.key === "gabinete" ? GABINETE_FALLBACK.leader : "—");
              return (
                <Box
                  key={m.key}
                  p={2}
                  bg="bg.panelSubtle"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderLeft="3px solid"
                  borderLeftColor={`state.${stateToken}`}
                  borderRadius="md"
                >
                  <HStack justify="space-between" mb={1}>
                    <HStack spacing={1.5}>
                      <Icon as={m.icon} color={`state.${stateToken}`} boxSize={3.5} />
                      <Text
                        fontSize="10px"
                        fontWeight={900}
                        letterSpacing="widest"
                        color="text.label"
                      >
                        {m.short}
                      </Text>
                      <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>
                        {m.label}
                      </Text>
                    </HStack>
                    <StatusBadge state={stateToken} size="xs" variant="subtle" />
                  </HStack>
                  <Text fontSize="11px" color="text.secondary" noOfLines={1}>
                    {leader}
                  </Text>
                  <HStack spacing={1.5} mt={1} justify="space-between">
                    <Text
                      fontSize="10px"
                      color="text.muted"
                      fontFamily="mono"
                      fontWeight={700}
                    >
                      {m.phone}
                    </Text>
                    <IconButton
                      as="a"
                      href={`tel:${m.phone.replace(/\s+/g, "")}`}
                      aria-label={`Llamar a ${m.label}`}
                      icon={<Icon as={MdCall} boxSize={3.5} />}
                      size="xs"
                      variant="ghost"
                      color="state.active"
                    />
                  </HStack>
                </Box>
              );
            })}
          </VStack>
        </MapOverlayCard></Box>

        <Box w={{ base: "260px", md: "300px" }}><MapOverlayCard
          icon={MdLocalShipping}
          label="Recursos desplegados"
          subLabel={`${totalDeployed} / ${resources.length}`}
          state="alert"
          isOpen={open.resources}
          onToggle={() => toggle("resources")}
        >
          <VStack spacing={1.5} align="stretch">
            {resources.slice(0, 8).map((r) => (
              <Flex
                key={r.id}
                align="center"
                gap={2}
                px={2}
                py={1.5}
                bg="bg.panelSubtle"
                borderRadius="md"
                border="1px solid"
                borderColor="border.subtle"
              >
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg={
                    r.status === "deployed"
                      ? "state.alert"
                      : r.status === "available"
                        ? "state.operational"
                        : r.status === "returning"
                          ? "state.active"
                          : "state.offline"
                  }
                  flexShrink={0}
                />
                <Text
                  fontSize="11px"
                  fontFamily="mono"
                  fontWeight={800}
                  color="text.primary"
                  minW="80px"
                  noOfLines={1}
                >
                  {r.callSign}
                </Text>
                <Text fontSize="10px" color="text.muted" letterSpacing="wide" noOfLines={1} flex="1">
                  {r.kind.replace(/-/g, " ")}
                </Text>
                <StatusBadge
                  state={
                    r.status === "deployed"
                      ? "alert"
                      : r.status === "available"
                        ? "operational"
                        : r.status === "returning"
                          ? "active"
                          : "offline"
                  }
                  size="xs"
                  variant="subtle"
                  label={r.status.toUpperCase()}
                />
              </Flex>
            ))}
          </VStack>
        </MapOverlayCard></Box>

        <Box w={{ base: "280px", md: "320px" }}><MapOverlayCard
          icon={MdContacts}
          label="Listín telefónico"
          subLabel={`${PHONE_DIRECTORY.length} contactos`}
          state="active"
          isOpen={open.directory}
          onToggle={() => toggle("directory")}
        >
          <VStack spacing={1.5} align="stretch">
            {PHONE_DIRECTORY.map((c) => (
              <Flex
                key={c.phone + c.name}
                align="center"
                gap={2}
                px={2}
                py={1.5}
                bg="bg.panelSubtle"
                borderRadius="md"
                border="1px solid"
                borderColor="border.subtle"
              >
                <Box minW={0} flex="1">
                  <HStack spacing={1.5}>
                    <Text
                      fontSize="9px"
                      fontWeight={900}
                      letterSpacing="widest"
                      color="text.label"
                    >
                      {c.group}
                    </Text>
                    <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>
                      {c.name}
                    </Text>
                  </HStack>
                  <Text fontSize="10px" color="text.secondary" noOfLines={1}>
                    {c.role}
                  </Text>
                  <Text fontSize="10px" color="text.muted" fontFamily="mono" fontWeight={700}>
                    {c.phone}
                  </Text>
                </Box>
                <IconButton
                  as="a"
                  href={`tel:${c.phone.replace(/\s+/g, "")}`}
                  aria-label={`Llamar a ${c.name}`}
                  icon={<Icon as={MdCall} boxSize={3.5} />}
                  size="sm"
                  variant="ghost"
                  color="state.active"
                />
              </Flex>
            ))}
          </VStack>
        </MapOverlayCard></Box>
      </HStack>
    </Box>
  );
};

