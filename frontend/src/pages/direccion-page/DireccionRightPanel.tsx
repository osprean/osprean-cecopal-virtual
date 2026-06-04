import { useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AnimatePresence } from "framer-motion";
import {
  MdNotificationsActive,
  MdPlaylistAddCheck,
  MdReportProblem,
  MdCheckCircle,
  MdClose,
  MdLocationOn,
} from "react-icons/md";
import {
  AlertBadge,
  RealtimeNotification,
  StatusBadge,
  TacticalButton,
  TacticalCard,
  TacticalHeader,
  TacticalTabs,
  type TacticalTabItem,
} from "../../components/base";
import {
  selectPendingMediaCount,
  useAlertsStore,
  useDireccionStore,
  useIncidentsStore,
} from "../../store";
import { formatTime } from "../../utils";
import type { OperationalState, Severity } from "../../types";

type Pane = "alerts" | "requests" | "incidents";

const SEVERITY_TO_STATE: Record<Severity, OperationalState> = {
  critical: "critical",
  high: "alert",
  medium: "pending",
  low: "offline",
  info: "active",
};

export const DireccionRightPanel = () => {
  const [pane, setPane] = useState<Pane>("alerts");
  const alerts = useAlertsStore((s) => s.alerts);
  const ackAlert = useAlertsStore((s) => s.acknowledgeAlert);
  const mediaRequests = useDireccionStore((s) => s.mediaRequests);
  const decideRequest = useDireccionStore((s) => s.decideMediaRequest);
  const incidents = useIncidentsStore((s) => s.incidents);
  const setIncidentStatus = useIncidentsStore((s) => s.setIncidentStatus);
  const pendingMedia = useDireccionStore(selectPendingMediaCount);
  const openIncidents = incidents.filter((i) => i.status === "active" || i.status === "monitoring");

  // Tabs muestran solo iconos + abreviaciones (ALR/SOL/INC) sin el nombre largo.
  const tabs: TacticalTabItem<Pane>[] = [
    {
      key: "alerts",
      label: "",
      shortLabel: "ALR",
      icon: MdNotificationsActive,
      badge: alerts.filter((a) => !a.acknowledged).length,
    },
    {
      key: "requests",
      label: "",
      shortLabel: "SOL",
      icon: MdPlaylistAddCheck,
      badge: pendingMedia,
    },
    {
      key: "incidents",
      label: "",
      shortLabel: "INC",
      icon: MdReportProblem,
      badge: openIncidents.length,
    },
  ];

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="white">
      <Box flexShrink={0}>
        <TacticalTabs<Pane> tabs={tabs} active={pane} onChange={setPane} size="sm" variant="bar" fullWidth />
      </Box>
      <Box flex="1" minH={0} overflowY="auto" p={{ base: 3, md: 4, lg: 5 }}>
        {pane === "alerts" && (
          <VStack spacing={2} align="stretch">
            <AnimatePresence>
              {alerts.map((a) => (
                <RealtimeNotification
                  key={a.id}
                  state={SEVERITY_TO_STATE[a.severity]}
                  title={a.source}
                  message={a.message}
                  source={a.emergencyId ?? "GLOBAL"}
                  timestamp={formatTime(a.createdAt)}
                  category={a.severity.toUpperCase()}
                  unread={!a.acknowledged}
                  onOpen={() => ackAlert(a.id)}
                />
              ))}
            </AnimatePresence>
          </VStack>
        )}

        {pane === "requests" && (
          <VStack spacing={2} align="stretch">
            <TacticalHeader
              icon={MdPlaylistAddCheck}
              label="SOLICITUDES DE MEDIOS"
              subLabel={`${mediaRequests.length}`}
              actions={<AlertBadge count={pendingMedia} state="alert" size="sm" />}
            />
            {mediaRequests.map((r) => (
              <TacticalCard
                key={r.id}
                state={
                  r.priority === "critical"
                    ? "critical"
                    : r.priority === "high"
                      ? "alert"
                      : r.priority === "medium"
                        ? "pending"
                        : "active"
                }
                unread={r.status === "pending"}
                title={`${r.quantity}× ${r.resourceType.replace(/-/g, " ")}`}
                meta={formatTime(r.requestedAt)}
                subtitle={r.reason}
                rightBadge={
                  <StatusBadge
                    state={
                      r.status === "pending"
                        ? "alert"
                        : r.status === "approved"
                          ? "active"
                          : r.status === "delivered"
                            ? "operational"
                            : "offline"
                    }
                    size="xs"
                    label={r.status.toUpperCase()}
                  />
                }
                footer={
                  <>
                    <HStack spacing={1.5}>
                      <Icon as={MdLocationOn} color="text.muted" boxSize={3} />
                      <Text fontSize="10px" color="text.muted" fontWeight={700} letterSpacing="wide">
                        {r.requestedBy}
                      </Text>
                    </HStack>
                    {r.status === "pending" ? (
                      <HStack spacing={1.5}>
                        <TacticalButton
                          size="xs"
                          variant="tactical-danger"
                          icon={MdClose}
                          onClick={() => decideRequest(r.id, "denied")}
                        >
                          Denegar
                        </TacticalButton>
                        <TacticalButton
                          size="xs"
                          variant="tactical-primary"
                          icon={MdCheckCircle}
                          onClick={() => decideRequest(r.id, "approved")}
                        >
                          Aprobar
                        </TacticalButton>
                      </HStack>
                    ) : (
                      <Text fontSize="10px" color="text.muted" fontFamily="mono">
                        {r.eta ? `ETA ${formatTime(r.eta)}` : "—"}
                      </Text>
                    )}
                  </>
                }
              />
            ))}
          </VStack>
        )}

        {pane === "incidents" && (
          <VStack spacing={2} align="stretch">
            <TacticalHeader
              icon={MdReportProblem}
              label="INCIDENCIAS ABIERTAS"
              subLabel={`${openIncidents.length} / ${incidents.length}`}
            />
            {incidents.map((i) => {
              const state: OperationalState =
                i.severity === "critical"
                  ? "critical"
                  : i.severity === "high"
                    ? "alert"
                    : i.severity === "medium"
                      ? "pending"
                      : "active";
              return (
                <TacticalCard
                  key={i.id}
                  state={state}
                  unread={i.status === "active"}
                  title={i.title}
                  meta={formatTime(i.reportedAt)}
                  subtitle={i.description}
                  rightBadge={
                    <HStack spacing={1.5}>
                      <StatusBadge state={state} size="xs" label={i.severity.toUpperCase()} />
                      <StatusBadge
                        state={
                          i.status === "active"
                            ? "critical"
                            : i.status === "monitoring"
                              ? "alert"
                              : i.status === "resolved"
                                ? "operational"
                                : "active"
                        }
                        size="xs"
                        label={i.status.toUpperCase()}
                      />
                    </HStack>
                  }
                  footer={
                    <>
                      <Text fontSize="10px" color="text.muted" letterSpacing="wider" fontWeight={700} textTransform="uppercase">
                        {i.assignedResources.length} recursos
                      </Text>
                      {i.status !== "resolved" && (
                        <HStack spacing={1.5}>
                          {i.status === "active" && (
                            <TacticalButton size="xs" variant="tactical" onClick={() => setIncidentStatus(i.id, "monitoring")}>
                              Monitorizar
                            </TacticalButton>
                          )}
                          <TacticalButton
                            size="xs"
                            variant="tactical-primary"
                            icon={MdCheckCircle}
                            onClick={() => setIncidentStatus(i.id, "resolved")}
                          >
                            Resolver
                          </TacticalButton>
                        </HStack>
                      )}
                    </>
                  }
                />
              );
            })}
          </VStack>
        )}
      </Box>
    </Flex>
  );
};
