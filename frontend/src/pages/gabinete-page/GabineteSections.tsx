import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Circle,
  Divider,
  Flex,
  Grid,
  HStack,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { AnimatePresence } from "framer-motion";
import {
  MdArticle,
  MdAutoAwesome,
  MdCheck,
  MdCheckCircle,
  MdCampaign,
  MdEdit,
  MdHistory,
  MdSend,
  MdPodcasts,
  MdPriorityHigh,
  MdRecordVoiceOver,
  MdReportGmailerrorred,
  MdRule,
  MdNotificationsActive,
} from "react-icons/md";
import type { IconType } from "react-icons";
import {
  RealtimeNotification,
  StatusBadge,
  TacticalButton,
  TacticalCard,
  TacticalPanel,
} from "../../components/base";
import { useDireccionStore, useGabineteStore } from "../../store";
import { aiRewriteCommunique, formatTime, timeAgo } from "../../utils";
import type {
  ChannelKind,
  ChannelStatus,
  Communique,
  CommuniqueAudience,
  CommuniqueStatus,
  OperationalState,
  TemplateCategory,
} from "../../types";
import {
  CHANNEL_LABEL,
  TEMPLATE_LABEL,
} from "../../types";

const COMMUNIQUE_STATE: Record<CommuniqueStatus, OperationalState> = {
  draft: "pending",
  "pending-approval": "alert",
  approved: "active",
  sent: "operational",
};

const CHANNEL_STATE: Record<ChannelStatus, OperationalState> = {
  online: "operational",
  degraded: "alert",
  offline: "offline",
};

const CHANNEL_ICON: Record<ChannelKind, IconType> = {
  press: MdArticle,
  "social-x": MdPodcasts,
  "social-instagram": MdPodcasts,
  "social-facebook": MdPodcasts,
  "es-alert": MdNotificationsActive,
  rne: MdRecordVoiceOver,
  "internal-mail": MdSend,
  "official-bulletin": MdRule,
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={1.5}>
    {children}
  </Text>
);

// =============================
// EDITOR
// =============================
interface EditorProps {
  loadedTemplate: TemplateCategory | null;
  // Borrador/comunicado existente a precargar en el editor — proviene del
  // historial de comunicados.
  loadedDraft?: Communique | null;
}

export const CommunicationEditor = ({ loadedTemplate, loadedDraft }: EditorProps) => {
  const templates = useGabineteStore((s) => s.templates);
  const communiques = useDireccionStore((s) => s.communiques);
  const pushAction = useDireccionStore((s) => s.pushAction);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<CommuniqueAudience>("population");
  const [priority, setPriority] = useState<"critical" | "high" | "medium" | "low">("high");
  const [aiBusy, setAiBusy] = useState(false);
  const [prevBody, setPrevBody] = useState<string | null>(null);

  const handleAiRewrite = async () => {
    if (!body.trim() || aiBusy) return;
    setAiBusy(true);
    const snapshot = body;
    try {
      const next = await aiRewriteCommunique(body, { audience, priority });
      setPrevBody(snapshot);
      setBody(next);
    } finally {
      setAiBusy(false);
    }
  };

  const handleUndoAi = () => {
    if (prevBody === null) return;
    setBody(prevBody);
    setPrevBody(null);
  };

  // Apply loaded template
  useEffect(() => {
    if (!loadedTemplate) return;
    const tpl = templates.find((t) => t.category === loadedTemplate);
    if (!tpl) return;
    setTitle(tpl.title);
    setBody(tpl.body);
    setAudience(tpl.audience);
    setPriority(tpl.defaultPriority);
  }, [loadedTemplate, templates]);

  // Apply loaded draft from the comms history. El id cambia cada vez que el
  // usuario pulsa "Cargar en editor", incluso si elige el mismo comunicado.
  useEffect(() => {
    if (!loadedDraft) return;
    setTitle(loadedDraft.title);
    setBody(loadedDraft.body);
    setAudience(loadedDraft.audience);
    setPrevBody(null);
  }, [loadedDraft]);

  const saveAsDraft = () => {
    if (!title || !body) return;
    const draft: Communique = {
      id: `com-${Date.now().toString(36)}`,
      emergencyId: "emg-001",
      title,
      body,
      audience,
      status: "draft",
      createdBy: "Gabinete Comunicación",
      createdAt: new Date().toISOString(),
    };
    useDireccionStore.setState((state) => ({
      communiques: [draft, ...state.communiques],
    }));
    pushAction({
      id: `act-${Math.random().toString(36).slice(2, 8)}`,
      emergencyId: "emg-001",
      type: "communique-approved",
      performedBy: "Gabinete",
      timestamp: new Date().toISOString(),
      payload: { communiqueId: draft.id, asDraft: true, priority },
    });
    setTitle(""); setBody("");
  };

  const requestApproval = () => {
    if (!title || !body) return;
    const draft: Communique = {
      id: `com-${Date.now().toString(36)}`,
      emergencyId: "emg-001",
      title,
      body,
      audience,
      status: "pending-approval",
      createdBy: "Gabinete Comunicación",
      createdAt: new Date().toISOString(),
    };
    useDireccionStore.setState((state) => ({
      communiques: [draft, ...state.communiques],
    }));
    setTitle(""); setBody("");
  };

  const lastDraft = useMemo(
    () => communiques.find((c) => c.status === "draft" || c.status === "pending-approval"),
    [communiques],
  );

  return (
    <TacticalPanel
      title="Editor de comunicado"
      icon={MdEdit}
      state="active"
      code={loadedTemplate ? `Plantilla ${TEMPLATE_LABEL[loadedTemplate]}` : "Vacío"}
      actions={
        <HStack spacing={2} flexWrap="wrap" justify="flex-end">
          <TacticalButton size="xs" variant="tactical-ghost" onClick={() => { setTitle(""); setBody(""); }}>
            Limpiar
          </TacticalButton>
          <TacticalButton size="xs" variant="tactical" onClick={saveAsDraft} icon={MdArticle} isDisabled={!title || !body}>
            Guardar
          </TacticalButton>
          <TacticalButton size="xs" variant="tactical-primary" icon={MdSend} onClick={requestApproval} isDisabled={!title || !body}>
            Enviar
          </TacticalButton>
        </HStack>
      }
    >
      <VStack spacing={3} align="stretch">
        <Box>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} size="md" bg="white" borderColor="border.strong" placeholder="Encabezado del comunicado" />
        </Box>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
          <Box>
            <Label>Audiencia</Label>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as CommuniqueAudience)} size="sm" bg="white" borderColor="border.strong">
              <option value="population">Población</option>
              <option value="press">Prensa</option>
              <option value="authorities">Autoridades</option>
              <option value="internal">Interno</option>
            </Select>
          </Box>
          <Box>
            <Label>Prioridad</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} size="sm" bg="white" borderColor="border.strong">
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </Box>
        </SimpleGrid>
        <Box>
          <HStack mb={1.5} justify="space-between" align="center">
            <Label>Cuerpo</Label>
            <HStack spacing={2}>
              {prevBody !== null && (
                <TacticalButton
                  size="xs"
                  variant="tactical-ghost"
                  onClick={handleUndoAi}
                  isDisabled={aiBusy}
                >
                  Deshacer IA
                </TacticalButton>
              )}
              <TacticalButton
                size="xs"
                variant="tactical-primary"
                icon={MdAutoAwesome}
                onClick={handleAiRewrite}
                isDisabled={!body.trim() || aiBusy}
              >
                {aiBusy ? "Reescribiendo…" : "Reescribir con IA"}
              </TacticalButton>
            </HStack>
          </HStack>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            minH="110px"
            maxH="260px"
            overflowY="auto"
            bg="white"
            borderColor="border.strong"
            color="text.primary"
            fontSize="sm"
            placeholder="Redacta aquí el contenido del comunicado. Usa {{placeholders}} para variables."
            fontFamily="mono"
            resize="vertical"
          />
          <HStack mt={1.5} spacing={3}>
            <Text fontSize="10px" color="text.muted" fontFamily="mono">{body.length} caracteres</Text>
            {lastDraft && (
              <Text fontSize="10px" color="text.muted" fontFamily="mono">
                · Último borrador: {lastDraft.title.slice(0, 40)}…
              </Text>
            )}
          </HStack>
        </Box>
      </VStack>
    </TacticalPanel>
  );
};

// =============================
// TEMPLATES GRID
// =============================
interface TemplatesProps {
  onLoad: (cat: TemplateCategory) => void;
}

const TEMPLATE_TONE: Record<TemplateCategory, OperationalState> = {
  evacuation: "critical",
  confinement: "alert",
  preventive: "pending",
  "population-warning": "active",
  "all-clear": "operational",
};

export const TemplatesGrid = ({ onLoad }: TemplatesProps) => {
  const templates = useGabineteStore((s) => s.templates);
  return (
    <TacticalPanel title="Plantillas oficiales" icon={MdArticle} state="active" code={`${templates.length}`}>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 1 }} spacing={2}>
        {templates.map((t) => (
          <Box
            key={t.id}
            p={3}
            bg="bg.panelSubtle"
            border="1px solid"
            borderColor="border.subtle"
            borderLeft="3px solid"
            borderLeftColor={`state.${TEMPLATE_TONE[t.category]}`}
            borderRadius="xl"
            cursor="pointer"
            transition="all 0.15s ease"
            _hover={{ bg: "white", borderColor: "accent.teal" }}
            onClick={() => onLoad(t.category)}
          >
            <HStack justify="space-between" mb={1}>
              <Text fontSize="10px" letterSpacing="widest" color={`state.${TEMPLATE_TONE[t.category]}`} fontWeight={900} textTransform="uppercase">
                {TEMPLATE_LABEL[t.category]}
              </Text>
              <StatusBadge state={TEMPLATE_TONE[t.category]} size="xs" label={t.defaultPriority.toUpperCase()} />
            </HStack>
            <Text fontSize="11px" color="text.primary" fontWeight={700} noOfLines={1}>
              {t.title}
            </Text>
            <Text fontSize="11px" color="text.secondary" noOfLines={2} mt={1} lineHeight="short">
              {t.body}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </TacticalPanel>
  );
};

// =============================
// CHANNELS / DIFUSIÓN
// =============================
export const ChannelsPanel = () => {
  const channels = useGabineteStore((s) => s.channels);
  const setStatus = useGabineteStore((s) => s.setChannelStatus);
  return (
    <TacticalPanel title="Canales de difusión" icon={MdPodcasts} state="active" code={`${channels.length}`}>
      <VStack spacing={1.5} align="stretch">
        {channels.map((c) => {
          const tone = CHANNEL_STATE[c.status];
          const Icn = CHANNEL_ICON[c.kind];
          return (
            <Flex
              key={c.id}
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
              <Icon as={Icn} color={`state.${tone}`} boxSize={4} flexShrink={0} />
              <Box flex="1" minW={0}>
                <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>
                  {CHANNEL_LABEL[c.kind]}
                </Text>
                <HStack spacing={2}>
                  {c.audienceReach != null && (
                    <Text fontSize="10px" color="text.muted" fontFamily="mono">
                      {c.audienceReach.toLocaleString("es-ES")} alcance
                    </Text>
                  )}
                  {c.lastSentAt && (
                    <Text fontSize="10px" color="text.muted" fontFamily="mono">
                      · últ. {timeAgo(c.lastSentAt)}
                    </Text>
                  )}
                </HStack>
              </Box>
              <StatusBadge state={tone} size="xs" label={c.status.toUpperCase()} />
              <TacticalButton
                size="xs"
                variant="tactical-ghost"
                onClick={() =>
                  setStatus(
                    c.id,
                    c.status === "online" ? "degraded" : c.status === "degraded" ? "offline" : "online",
                  )
                }
              >
                Avanzar
              </TacticalButton>
            </Flex>
          );
        })}
      </VStack>
    </TacticalPanel>
  );
};

// =============================
// ACTIVE ALERTS (highlighted publications)
// =============================
export const ActiveAlertsPanel = () => {
  const communiques = useDireccionStore((s) => s.communiques);
  const channels = useGabineteStore((s) => s.channels);
  const publications = useGabineteStore((s) => s.publications);

  const active = communiques
    .filter((c) => c.status === "approved" || c.status === "sent")
    .slice(0, 5);

  return (
    <TacticalPanel title="Alertas activas" icon={MdReportGmailerrorred} state="alert" code={`${active.length}`}>
      <VStack spacing={2} align="stretch">
        <AnimatePresence>
          {active.map((c) => {
            const pubs = publications.filter((p) => p.communiqueId === c.id);
            const reach = pubs.reduce((acc, p) => acc + (p.reach ?? 0), 0);
            return (
              <RealtimeNotification
                key={c.id}
                state={c.status === "sent" ? "operational" : "alert"}
                title={c.title}
                message={c.body}
                source={c.audience.toUpperCase()}
                timestamp={c.sentAt ? formatTime(c.sentAt) : c.approvedAt ? formatTime(c.approvedAt) : formatTime(c.createdAt)}
                category={c.status.toUpperCase()}
                actions={
                  reach > 0 ? (
                    <Text fontSize="10px" color="state.active" fontFamily="mono" fontWeight={800}>
                      {reach.toLocaleString("es-ES")} alc.
                    </Text>
                  ) : undefined
                }
              />
            );
          })}
        </AnimatePresence>
        {active.length === 0 && (
          <Text fontSize="11px" color="text.muted" textAlign="center" py={2}>
            Sin alertas activas.
          </Text>
        )}
        <Divider borderColor="transparent" />
        <Text fontSize="9px" color="text.muted" letterSpacing="wider" fontWeight={700} textTransform="uppercase">
          {channels.filter((c) => c.status === "online").length} canales online · alcance estimado total{" "}
          {publications.filter((p) => p.status === "published").reduce((a, p) => a + (p.reach ?? 0), 0).toLocaleString("es-ES")}
        </Text>
      </VStack>
    </TacticalPanel>
  );
};

// =============================
// HISTORY (todos los comunicados con acciones)
// =============================
interface HistoryProps {
  onLoad: (c: Communique) => void;
}

export const CommunicationHistory = ({ onLoad }: HistoryProps) => {
  const communiques = useDireccionStore((s) => s.communiques);
  const setStatus = useDireccionStore((s) => s.setCommuniqueStatus);
  const channels = useGabineteStore((s) => s.channels);
  const publishToChannel = useGabineteStore((s) => s.publishToChannel);

  const onlineChannels = channels.filter((c) => c.status === "online");

  return (
    <TacticalPanel title="Historial de comunicados" icon={MdHistory} state="active" code={`${communiques.length}`}>
      <VStack spacing={2} align="stretch">
        {communiques.map((c) => (
          <TacticalCard
            key={c.id}
            state={COMMUNIQUE_STATE[c.status]}
            unread={c.status === "pending-approval"}
            title={c.title}
            meta={formatTime(c.createdAt)}
            subtitle={c.body}
            rightBadge={
              <HStack spacing={1.5}>
                <StatusBadge state={COMMUNIQUE_STATE[c.status]} size="xs" label={c.status.toUpperCase()} />
              </HStack>
            }
            footer={
              <HStack spacing={1.5} ml="auto">
                <TacticalButton size="xs" variant="tactical-ghost" icon={MdEdit} onClick={() => onLoad(c)}>
                  Cargar en editor
                </TacticalButton>
                {c.status === "pending-approval" && (
                  <TacticalButton size="xs" variant="tactical-primary" icon={MdCheckCircle} onClick={() => setStatus(c.id, "approved")}>
                    Aprobar
                  </TacticalButton>
                )}
                {c.status === "approved" && onlineChannels.length > 0 && (
                  <TacticalButton
                    size="xs"
                    variant="tactical-warning"
                    icon={MdSend}
                    onClick={() => {
                      // publish to all online channels at once
                      onlineChannels.forEach((ch) => publishToChannel(c.id, ch.id));
                      setStatus(c.id, "sent");
                    }}
                  >
                    Publicar en {onlineChannels.length} canales
                  </TacticalButton>
                )}
              </HStack>
            }
          />
        ))}
      </VStack>
    </TacticalPanel>
  );
};

// =============================
// QUICK ALERT (ES-Alert one-tap)
// =============================
export const QuickAlertButton = () => {
  const channels = useGabineteStore((s) => s.channels);
  const publishToChannel = useGabineteStore((s) => s.publishToChannel);
  const pushAction = useDireccionStore((s) => s.pushAction);
  const esAlert = channels.find((c) => c.kind === "es-alert");
  const [confirming, setConfirming] = useState(false);

  if (!esAlert || esAlert.status !== "online") {
    return (
      <Box p={4} bg="bg.panelSubtle" border="1px dashed" borderColor="border.strong" borderRadius="2xl">
        <HStack spacing={2}>
          <Icon as={MdNotificationsActive} color="text.muted" boxSize={4} />
          <Text fontSize="11px" color="text.muted" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
            ES-Alert no disponible
          </Text>
        </HStack>
      </Box>
    );
  }

  const fire = () => {
    const id = `quick-${Date.now().toString(36)}`;
    publishToChannel(id, esAlert.id, esAlert.audienceReach);
    pushAction({
      id: `act-${Math.random().toString(36).slice(2, 8)}`,
      emergencyId: "emg-001",
      type: "communique-approved",
      performedBy: "Gabinete · QuickAlert",
      timestamp: new Date().toISOString(),
      payload: { quick: true },
    });
    setConfirming(false);
  };

  return (
    <Box
      p={{ base: 3, md: 4 }}
      bg="state.criticalSoft"
      border="1.5px solid"
      borderColor="state.critical"
      borderRadius="2xl"
    >
      <Flex
        align={{ base: "stretch", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={3}
      >
        <HStack spacing={3} flex="1" minW={0}>
          <Circle size="40px" bg="state.critical" color="white" flexShrink={0}>
            <Icon as={MdNotificationsActive} boxSize={5} />
          </Circle>
          <Box flex="1" minW={0}>
            <Text fontSize="11px" color="state.critical" fontWeight={900} letterSpacing="widest" textTransform="uppercase" noOfLines={1}>
              QUICK ALERT · ES-ALERT
            </Text>
            <Text fontSize="11px" color="text.secondary" noOfLines={{ base: 2, md: 1 }}>
              Envío urgente al sistema nacional de aviso a población.
            </Text>
          </Box>
        </HStack>
        {confirming ? (
          <HStack spacing={1.5} justify="flex-end" flexWrap="wrap">
            <TacticalButton size="sm" variant="tactical-ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </TacticalButton>
            <TacticalButton size="sm" variant="tactical-danger" icon={MdPriorityHigh} onClick={fire}>
              Confirmar
            </TacticalButton>
          </HStack>
        ) : (
          <TacticalButton size="sm" variant="tactical-danger" icon={MdCampaign} onClick={() => setConfirming(true)}>
            Lanzar QuickAlert
          </TacticalButton>
        )}
      </Flex>
    </Box>
  );
};

// =============================
// ROOT GRID HELPER
// =============================
export const GabineteGrid = ({
  loadedTemplate,
  loadedDraft,
  onLoadTemplate,
  onLoadCommunique,
}: {
  loadedTemplate: TemplateCategory | null;
  loadedDraft: Communique | null;
  onLoadTemplate: (cat: TemplateCategory) => void;
  onLoadCommunique: (c: Communique) => void;
}) => (
  <Grid
    templateColumns={{ base: "1fr", lg: "1.4fr 1fr" }}
    templateRows="auto 1fr"
    gap={3}
    p={3}
    flex="1"
    minH={0}
  >
    <Box gridColumn={{ base: "1", lg: "1 / span 2" }}>
      <QuickAlertButton />
    </Box>
    <Box minH={0}>
      <VStack spacing={3} align="stretch" h="100%">
        <CommunicationEditor loadedTemplate={loadedTemplate} loadedDraft={loadedDraft} />
        <CommunicationHistory onLoad={onLoadCommunique} />
      </VStack>
    </Box>
    <Box minH={0}>
      <VStack spacing={3} align="stretch" h="100%">
        <TemplatesGrid onLoad={onLoadTemplate} />
        <ChannelsPanel />
      </VStack>
    </Box>
  </Grid>
);

export const _Used = MdCheck;
