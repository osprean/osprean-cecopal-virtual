import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Progress,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import {
  MdAdd,
  MdRemove,
  MdInventory2,
  MdLocalShipping,
  MdBuild,
  MdHomeWork,
  MdPowerSettingsNew,
  MdCheckCircle,
  MdReportGmailerrorred,
  MdMyLocation,
  MdWarning,
  MdLocalGasStation,
  MdSettingsInputAntenna,
  MdWaterDrop,
  MdElectricalServices,
  MdAir,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  PaginationBar,
  StatusBadge,
  TacticalButton,
  TacticalCard,
  TacticalPanel,
  usePagination,
} from "../../components/base";
import { useDireccionStore, useLogisticaStore } from "../../store";
import { formatTime } from "../../utils";
import type {
  LogisticsRequestPriority,
  LogisticsRequestStatus,
  OperationalState,
  ServiceKind,
  SupplyCategory,
  SupplyState,
  VehicleState,
} from "../../types";
import { SUPPLY_LABEL, SERVICE_LABEL } from "../../types";

const SUPPLY_STATE_COLOR: Record<SupplyState, OperationalState> = {
  ok: "operational",
  low: "alert",
  critical: "critical",
  out: "critical",
};

const VEHICLE_STATE_COLOR: Record<VehicleState, OperationalState> = {
  available: "operational",
  deployed: "alert",
  maintenance: "pending",
  "out-of-service": "offline",
};

const PRIORITY_STATE: Record<LogisticsRequestPriority, OperationalState> = {
  critical: "critical",
  high: "alert",
  medium: "pending",
  low: "active",
};

const REQUEST_STATE: Record<LogisticsRequestStatus, OperationalState> = {
  pending: "alert",
  approved: "active",
  "in-transit": "active",
  delivered: "operational",
  denied: "offline",
};

const SERVICE_ICON: Record<ServiceKind, IconType> = {
  water: MdWaterDrop,
  electricity: MdElectricalServices,
  gas: MdLocalGasStation,
  telecom: MdSettingsInputAntenna,
  sewer: MdAir,
};

const SUPPLY_ICON: Record<SupplyCategory, IconType> = {
  water: MdWaterDrop,
  food: MdInventory2,
  medical: MdReportGmailerrorred,
  fuel: MdLocalGasStation,
  ppe: MdInventory2,
  tools: MdBuild,
  other: MdInventory2,
};

// =============================
// INVENTORY TABLE
// =============================
export const InventorySection = ({ onAdd }: { onAdd: () => void }) => {
  const supplies = useLogisticaStore((s) => s.supplies);
  const adjust = useLogisticaStore((s) => s.adjustStock);
  const { pageItems, ...pg } = usePagination(supplies, 8);

  return (
    <TacticalPanel
      title="Inventario de recursos"
      icon={MdInventory2}
      state="active"
      code={`${supplies.length}`}
      collapsible
      actions={
        <TacticalButton size="xs" variant="tactical-primary" icon={MdAdd} onClick={onAdd}>
          Añadir recurso
        </TacticalButton>
      }
      noPadding
    >
      <Box overflowY="auto" overflowX="auto" maxH="100%">
        <Table size="sm" variant="simple" minW={{ base: "640px", md: "auto" }}>
          <Thead bg="bg.panelSubtle" position="sticky" top={0} zIndex={1}>
            <Tr>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle">Categ.</Th>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle">Recurso</Th>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle" isNumeric>Stock</Th>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle" isNumeric>Mín.</Th>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle">Ubicación</Th>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle">Estado</Th>
              <Th fontSize="9px" letterSpacing="widest" color="text.label" borderColor="border.subtle" isNumeric>Acción</Th>
            </Tr>
          </Thead>
          <Tbody>
            {pageItems.map((s) => {
              const ratio = s.minStock > 0 ? Math.min(1, s.stock / s.minStock) : 1;
              const tone = SUPPLY_STATE_COLOR[s.state];
              const IconComp = SUPPLY_ICON[s.category];
              return (
                <Tr key={s.id} _hover={{ bg: "bg.panelSubtle" }}>
                  <Td borderColor="border.subtle">
                    <HStack spacing={1.5}>
                      <Icon as={IconComp} color="text.muted" boxSize={3} />
                      <Text fontSize="9px" color="text.muted" letterSpacing="wider" fontWeight={800}>
                        {SUPPLY_LABEL[s.category]}
                      </Text>
                    </HStack>
                  </Td>
                  <Td borderColor="border.subtle">
                    <Text fontSize="12px" fontWeight={700} color="text.primary">{s.name}</Text>
                  </Td>
                  <Td borderColor="border.subtle" isNumeric>
                    <Text fontSize="13px" fontFamily="mono" fontWeight={800} color={`state.${tone}`}>
                      {s.stock} <Text as="span" color="text.muted" fontSize="10px">{s.unit}</Text>
                    </Text>
                  </Td>
                  <Td borderColor="border.subtle" isNumeric>
                    <Text fontSize="11px" fontFamily="mono" color="text.muted">{s.minStock}</Text>
                  </Td>
                  <Td borderColor="border.subtle">
                    <Text fontSize="11px" color="text.secondary" noOfLines={1}>{s.location}</Text>
                  </Td>
                  <Td borderColor="border.subtle">
                    <VStack align="stretch" spacing={1}>
                      <StatusBadge state={tone} size="xs" label={s.state.toUpperCase()} />
                      <Progress value={ratio * 100} size="xs" colorScheme={tone === "critical" ? "red" : tone === "alert" ? "orange" : "green"} borderRadius="full" bg="border.subtle" />
                    </VStack>
                  </Td>
                  <Td borderColor="border.subtle" isNumeric>
                    <HStack spacing={1} justify="flex-end">
                      <IconButton aria-label="Reducir" size="xs" variant="ghost" icon={<MdRemove />} onClick={() => adjust(s.id, -10)} />
                      <IconButton aria-label="Aumentar" size="xs" variant="ghost" icon={<MdAdd />} onClick={() => adjust(s.id, 10)} />
                    </HStack>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Box px={2} pb={2}>
          <PaginationBar {...pg} onChange={pg.setPage} />
        </Box>
      </Box>
    </TacticalPanel>
  );
};

// =============================
// VEHICLES + MACHINERY
// =============================
export const VehiclesSection = () => {
  const vehicles = useLogisticaStore((s) => s.vehicles);
  const setState = useLogisticaStore((s) => s.setVehicleState);
  const { pageItems, ...pg } = usePagination(vehicles, 5);

  return (
    <TacticalPanel title="Vehículos" icon={MdLocalShipping} state="active" code={`${vehicles.length}`} collapsible>
      <VStack spacing={2} align="stretch">
        {pageItems.map((v) => {
          const tone = VEHICLE_STATE_COLOR[v.state];
          const fuelTone: OperationalState = v.fuelPct < 25 ? "critical" : v.fuelPct < 50 ? "alert" : "operational";
          return (
            <Flex
              key={v.id}
              p={2.5}
              bg="bg.panelSubtle"
              border="1px solid"
              borderColor="border.subtle"
              borderLeft="3px solid"
              borderLeftColor={`state.${tone}`}
              borderRadius="lg"
              align={{ base: "stretch", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 3 }}
            >
              <Box minW={{ md: "100px" }}>
                <Text fontSize="12px" fontFamily="mono" fontWeight={800} color="text.primary">{v.callSign}</Text>
                <Text fontSize="9px" color="text.muted" letterSpacing="wider" textTransform="uppercase" fontWeight={700}>{v.kind.replace("-", " ")}</Text>
              </Box>
              <Box flex="1" minW={0}>
                <Text fontSize="11px" color="text.secondary" noOfLines={1}>{v.location}</Text>
                <Text fontSize="10px" color="text.muted" fontFamily="mono">
                  {v.capacity} · {v.driver ?? "sin conductor"}
                </Text>
              </Box>
              <Flex
                direction={{ base: "row", md: "column" }}
                align={{ base: "center", md: "stretch" }}
                gap={{ base: 3, md: 0 }}
                minW={{ md: "70px" }}
              >
                <HStack spacing={1.5} mb={{ base: 0, md: 1 }} flexShrink={0}>
                  <Icon as={MdLocalGasStation} color={`state.${fuelTone}`} boxSize={3} />
                  <Text fontSize="10px" fontFamily="mono" fontWeight={800} color={`state.${fuelTone}`}>{v.fuelPct}%</Text>
                </HStack>
                <Box flex={{ base: "1", md: "none" }}>
                  <Progress value={v.fuelPct} size="xs" colorScheme={fuelTone === "critical" ? "red" : fuelTone === "alert" ? "orange" : "green"} borderRadius="full" bg="border.subtle" />
                </Box>
              </Flex>
              <Flex justify="space-between" align="center" gap={2} flexShrink={0}>
                <StatusBadge state={tone} size="xs" label={v.state.replace("-", " ").toUpperCase()} />
                <TacticalButton
                  size="xs"
                  variant="tactical-ghost"
                  onClick={() => setState(v.id, v.state === "available" ? "deployed" : "available")}
                >
                  {v.state === "available" ? "Desplegar" : "Liberar"}
                </TacticalButton>
              </Flex>
            </Flex>
          );
        })}
      </VStack>
      <PaginationBar {...pg} onChange={pg.setPage} />
    </TacticalPanel>
  );
};

export const MachinerySection = () => {
  const machinery = useLogisticaStore((s) => s.machinery);
  const { pageItems, ...pg } = usePagination(machinery, 6);
  return (
    <TacticalPanel title="Maquinaria" icon={MdBuild} state="active" code={`${machinery.length}`} collapsible>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
        {pageItems.map((m) => {
          const tone: OperationalState =
            m.state === "down" ? "critical" :
            m.state === "deployed" ? "alert" :
            m.state === "maintenance" ? "pending" : "operational";
          return (
            <Flex
              key={m.id}
              p={2.5}
              bg="bg.panelSubtle"
              border="1px solid"
              borderColor="border.subtle"
              borderLeft="3px solid"
              borderLeftColor={`state.${tone}`}
              borderRadius="lg"
              align="center"
              gap={2}
            >
              <Box flex="1" minW={0}>
                <Text fontSize="11px" fontFamily="mono" fontWeight={800} color="text.primary">{m.callSign}</Text>
                <Text fontSize="10px" color="text.secondary" noOfLines={1}>
                  {m.kind.toUpperCase()} · {m.location}
                </Text>
                {m.notes && (
                  <Text fontSize="10px" color="text.muted" noOfLines={1} mt={0.5}>{m.notes}</Text>
                )}
              </Box>
              <StatusBadge state={tone} size="xs" label={m.state.toUpperCase()} />
            </Flex>
          );
        })}
      </SimpleGrid>
      <PaginationBar {...pg} onChange={pg.setPage} />
    </TacticalPanel>
  );
};

// =============================
// SHELTERS
// =============================
export const SheltersSection = () => {
  const shelters = useDireccionStore((s) => s.shelters);
  const { pageItems, ...pg } = usePagination(shelters, 4);
  return (
    <TacticalPanel title="Albergues" icon={MdHomeWork} state="active" code={`${shelters.length}`} collapsible>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
        {pageItems.map((s) => {
          const ratio = s.capacity ? s.occupancy / s.capacity : 0;
          const tone: OperationalState = ratio > 0.85 ? "critical" : ratio > 0.5 ? "alert" : "operational";
          return (
            <Box
              key={s.id}
              p={3}
              bg="bg.panelSubtle"
              border="1px solid"
              borderColor="border.subtle"
              borderLeft="3px solid"
              borderLeftColor={`state.${tone}`}
              borderRadius="xl"
            >
              <Flex justify="space-between" align="baseline" mb={1}>
                <Text fontSize="12px" color="text.primary" fontWeight={800} noOfLines={1}>{s.name}</Text>
                <StatusBadge state={tone} size="xs" label={`${Math.round(ratio * 100)}%`} />
              </Flex>
              <HStack spacing={3} mb={2}>
                <Text fontSize="11px" fontFamily="mono" fontWeight={800} color={`state.${tone}`}>
                  {s.occupancy}/{s.capacity}
                </Text>
                {s.contact && (
                  <Text fontSize="10px" color="text.muted" fontFamily="mono">{s.contact}</Text>
                )}
              </HStack>
              <Progress value={ratio * 100} size="xs" colorScheme={tone === "critical" ? "red" : tone === "alert" ? "orange" : "green"} borderRadius="full" bg="border.subtle" />
              {s.facilities && s.facilities.length > 0 && (
                <HStack mt={2} spacing={1.5}>
                  {s.facilities.map((f) => (
                    <Box key={f} px={1.5} py={0.5} fontSize="9px" fontWeight={800} letterSpacing="wider" textTransform="uppercase" bg="white" border="1px solid" borderColor="border.subtle" borderRadius="md" color="text.muted">
                      {f}
                    </Box>
                  ))}
                </HStack>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
      <PaginationBar {...pg} onChange={pg.setPage} />
    </TacticalPanel>
  );
};

// =============================
// SERVICES
// =============================
export const ServicesSection = () => {
  const services = useLogisticaStore((s) => s.services);
  const setStatus = useLogisticaStore((s) => s.setServiceStatus);
  const { pageItems, ...pg } = usePagination(services, 5);

  return (
    <TacticalPanel title="Servicios afectados" icon={MdPowerSettingsNew} state="alert" code={`${services.length}`} collapsible>
      <VStack spacing={2} align="stretch">
        {pageItems.map((srv) => {
          const tone: OperationalState =
            srv.status === "outage" ? "critical" :
            srv.status === "degraded" ? "alert" :
            srv.status === "restoring" ? "pending" : "operational";
          return (
            <Flex
              key={srv.id}
              p={2.5}
              bg="bg.panelSubtle"
              border="1px solid"
              borderColor="border.subtle"
              borderLeft="3px solid"
              borderLeftColor={`state.${tone}`}
              borderRadius="lg"
              align={{ base: "flex-start", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 3 }}
            >
              <HStack spacing={2} align="center" w={{ base: "100%", md: "auto" }} flex={{ md: "1" }} minW={0}>
                <Icon as={SERVICE_ICON[srv.kind]} color={`state.${tone}`} boxSize={4} flexShrink={0} />
                <Box flex="1" minW={0}>
                  <HStack spacing={2}>
                    <Text fontSize="11px" color="text.primary" fontWeight={800}>{SERVICE_LABEL[srv.kind]}</Text>
                    <Text fontSize="10px" color="text.muted" letterSpacing="wide">· {srv.area}</Text>
                  </HStack>
                  {srv.notes && (
                    <Text fontSize="10px" color="text.secondary" noOfLines={1} mt={0.5}>{srv.notes}</Text>
                  )}
                  <HStack spacing={3} mt={0.5} flexWrap="wrap">
                    <Text fontSize="9px" color="text.muted" fontFamily="mono" letterSpacing="wider">
                      {srv.affectedPopulation.toLocaleString("es-ES")} hab. · {srv.provider}
                    </Text>
                    {srv.estimatedRestore && (
                      <Text fontSize="9px" color="state.active" fontFamily="mono" letterSpacing="wider" fontWeight={800}>
                        ETA REST. {formatTime(srv.estimatedRestore)}
                      </Text>
                    )}
                  </HStack>
                </Box>
              </HStack>
              <Flex justify="space-between" align="center" gap={2} w={{ base: "100%", md: "auto" }} flexShrink={0}>
                <StatusBadge state={tone} size="xs" label={srv.status.toUpperCase()} />
                <TacticalButton
                  size="xs"
                  variant="tactical-ghost"
                  onClick={() =>
                    setStatus(
                      srv.id,
                      srv.status === "outage" ? "restoring" : srv.status === "restoring" ? "operational" : "outage",
                    )
                  }
                >
                  Avanzar
                </TacticalButton>
              </Flex>
            </Flex>
          );
        })}
      </VStack>
      <PaginationBar {...pg} onChange={pg.setPage} />
    </TacticalPanel>
  );
};

// =============================
// REQUESTS
// =============================
export const RequestsSection = ({ onCreate }: { onCreate: () => void }) => {
  const requests = useLogisticaStore((s) => s.requests);
  const decide = useLogisticaStore((s) => s.decideRequest);
  const { pageItems, ...pg } = usePagination(requests, 5);

  return (
    <TacticalPanel
      title="Solicitudes logísticas"
      icon={MdLocalShipping}
      state="alert"
      code={`${requests.length}`}
      collapsible
      actions={
        <TacticalButton size="xs" variant="tactical-primary" icon={MdAdd} onClick={onCreate}>
          Nueva
        </TacticalButton>
      }
    >
      <VStack spacing={2} align="stretch">
        {pageItems.map((r) => (
          <TacticalCard
            key={r.id}
            state={REQUEST_STATE[r.status]}
            unread={r.status === "pending"}
            title={`${r.quantity} ${r.unit} · ${r.itemName}`}
            meta={formatTime(r.requestedAt)}
            subtitle={`${r.requestedBy} → ${r.destination}`}
            rightBadge={
              <HStack spacing={1.5}>
                <StatusBadge state={PRIORITY_STATE[r.priority]} size="xs" label={r.priority.toUpperCase()} />
                <StatusBadge state={REQUEST_STATE[r.status]} size="xs" label={r.status.toUpperCase()} />
              </HStack>
            }
            footer={
              r.status === "pending" ? (
                <HStack spacing={1.5} ml="auto">
                  <TacticalButton size="xs" variant="tactical-danger" onClick={() => decide(r.id, "denied")}>Denegar</TacticalButton>
                  <TacticalButton size="xs" variant="tactical-primary" icon={MdCheckCircle} onClick={() => decide(r.id, "approved")}>Aprobar</TacticalButton>
                </HStack>
              ) : (
                <>
                  <Text fontSize="10px" color="text.muted" letterSpacing="wider" fontWeight={700} textTransform="uppercase">
                    {r.notes ?? ""}
                  </Text>
                  {r.eta && (
                    <Text fontSize="10px" fontFamily="mono" color="state.active" fontWeight={800}>
                      ETA {formatTime(r.eta)}
                    </Text>
                  )}
                </>
              )
            }
          />
        ))}
      </VStack>
      <PaginationBar {...pg} onChange={pg.setPage} />
    </TacticalPanel>
  );
};

// =============================
// CRITICAL only (right column) — actividad vive en el Historial global del header
// =============================
export const CriticalAndActivity = () => {
  const supplies = useLogisticaStore((s) => s.supplies);
  const critical = supplies.filter((x) => x.state === "critical" || x.state === "out");

  return (
    <Box h="100%" minH={0}>
      <TacticalPanel title="Recursos críticos" icon={MdWarning} state={critical.length > 0 ? "critical" : "operational"} code={`${critical.length}`} h="100%">
        <VStack spacing={2} align="stretch">
          {critical.length === 0 && (
            <Text fontSize="11px" color="text.muted" textAlign="center" py={2}>
              Sin recursos críticos.
            </Text>
          )}
          {critical.map((s) => {
            const tone = SUPPLY_STATE_COLOR[s.state];
            return (
              <Flex
                key={s.id}
                align="center"
                gap={2}
                px={2.5}
                py={2}
                bg="bg.panelSubtle"
                border="1px solid"
                borderColor="border.subtle"
                borderLeft="3px solid"
                borderLeftColor={`state.${tone}`}
                borderRadius="lg"
              >
                <Icon as={MdMyLocation} color={`state.${tone}`} boxSize={3} />
                <Box flex="1" minW={0}>
                  <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>{s.name}</Text>
                  <Text fontSize="10px" color="text.muted" fontFamily="mono">
                    {s.stock} {s.unit} / mín {s.minStock}
                  </Text>
                </Box>
                <StatusBadge state={tone} size="xs" label={s.state.toUpperCase()} />
              </Flex>
            );
          })}
        </VStack>
      </TacticalPanel>
    </Box>
  );
};
