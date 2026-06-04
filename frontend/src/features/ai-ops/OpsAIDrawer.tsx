import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  Textarea,
  Tooltip,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MdAdd,
  MdArrowUpward,
  MdAutoAwesome,
  MdCheckCircle,
  MdChevronRight,
  MdClose,
  MdCloudUpload,
  MdMic,
  MdStop,
} from "react-icons/md";
import { TacticalButton } from "../../components/base";
import { useAiOpsStore, type OpsChatMessage, type ToolCallRecord } from "./aiOpsStore";
import { runChat } from "./orchestrator";
import { undoAppliedAction } from "./tools";
import { isOpenRouterConfigured } from "../../services";
import { RagStatusBar } from "./rag/RagStatusBar";
import {
  getIngestStatus,
  ingestPdfFile,
  onIngestProgress,
  type IngestProgress,
} from "./rag";

// El avatar de la IA es el logo de marca de Osprean (mismo PNG que el favicon).
const OSPREAN_AVATAR = "/osprean.png";

export const OpsAIDrawer = () => {
  const open = useAiOpsStore((s) => s.open);
  const setOpen = useAiOpsStore((s) => s.setOpen);
  const busy = useAiOpsStore((s) => s.busy);
  const messages = useAiOpsStore((s) => s.messages);
  const error = useAiOpsStore((s) => s.error);
  const clear = useAiOpsStore((s) => s.clear);
  // En móvil/tablet portrait el panel ocupa toda la pantalla (overlay).
  // Desde lg vuelve a su modo lateral.
  const isCompact = useBreakpointValue(
    { base: true, lg: false },
    { fallback: "lg" },
  );

  const [input, setInput] = useState("");
  const [ingestStatus, setIngestStatus] = useState<IngestProgress>(getIngestStatus);
  const {
    supported: speechSupported,
    listening,
    start: startDictation,
    stop: stopDictation,
  } = useSpeechDictation(setInput);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Suscripción al estado de ingesta RAG: si hay carga de documentos en curso,
  // el campo de escritura se bloquea para evitar consultas sin contexto.
  useEffect(() => {
    return onIngestProgress(setIngestStatus);
  }, []);

  const ingesting =
    ingestStatus.phase === "extracting" ||
    ingestStatus.phase === "chunking" ||
    ingestStatus.phase === "embedding" ||
    ingestStatus.phase === "indexing";
  const ingestPct = Math.round((ingestStatus.progress || 0) * 100);

  const triggerUpload = () => uploadInputRef.current?.click();
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) return;
    try {
      await ingestPdfFile(f);
    } catch {
      /* el estado de error se refleja en `ingestStatus` */
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Autosize del textarea (estilo ChatGPT).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(40, next)}px`;
  }, [input]);

  // Focus al abrir.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Si el panel se cierra mientras se dicta, detener reconocimiento.
  useEffect(() => {
    if (!open && listening) stopDictation();
  }, [open, listening, stopDictation]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy || ingesting) return;
    setInput("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    void runChat(text, { signal: abortRef.current.signal });
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const configured = isOpenRouterConfigured();
  const empty = messages.length === 0;
  // `error` no se muestra como banner rojo (UX conversacional) pero
  // mantenemos la variable porque el store la sigue exponiendo; basta con
  // no renderizarla.
  void error;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <MotionPanelShell key="ops-ai-panel" isCompact={Boolean(isCompact)}>
          {/* Header tipo Comacon: tira muy estrecha, mono, ALL CAPS */}
          <Flex
            align="center"
            h={{ base: "52px", md: "48px" }}
            px={{ base: 3, md: 4 }}
            borderBottom="1px solid"
            borderColor="border.subtle"
            bg="white"
            flexShrink={0}
            gap={2}
          >
            <Icon as={MdAutoAwesome} color="accent.teal" boxSize={4} />
            <Text
              fontSize="11px"
              fontWeight={900}
              letterSpacing="widest"
              textTransform="uppercase"
              color="text.primary"
              noOfLines={1}
            >
              <Box as="span" display={{ base: "none", sm: "inline" }}>Centro Operativo </Box>IA
            </Text>
            <Text fontSize="9px" fontFamily="mono" color="text.muted" letterSpacing="wider" display={{ base: "none", md: "inline" }}>
              · OpenRouter
            </Text>
            <Box flex="1" />
            {messages.length > 0 && (
              <Box
                as="button"
                onClick={clear}
                display="flex"
                alignItems="center"
                gap={1.5}
                px={2.5}
                py={1}
                borderRadius="md"
                border="1px solid"
                borderColor="border.subtle"
                bg="bg.panelSubtle"
                color="text.secondary"
                transition="all 0.12s ease"
                _hover={{ bg: "white", borderColor: "accent.teal", color: "accent.teal" }}
              >
                <Icon as={MdAdd} boxSize={3.5} />
                <Text fontSize="10px" fontWeight={800} letterSpacing="widest" textTransform="uppercase">
                  Nueva
                </Text>
              </Box>
            )}
            <Tooltip label="Cerrar panel" placement="bottom" hasArrow openDelay={250}>
              <IconButton
                aria-label="Cerrar Centro IA"
                size={isCompact ? "sm" : "xs"}
                variant="ghost"
                color="text.primary"
                icon={<Icon as={isCompact ? MdClose : MdChevronRight} boxSize={isCompact ? 5 : 4} />}
                onClick={() => setOpen(false)}
                _hover={{ bg: "bg.panelSubtle", color: "accent.teal" }}
              />
            </Tooltip>
          </Flex>

          {/* Barra de estado del índice RAG: muestra qué Plan está cargado,
              progreso de ingesta y permite subir un PDF adicional. */}
          <RagStatusBar />

          <Box flex="1" minH={0} display="flex" flexDirection="column">
          {/* Cuerpo: o pantalla vacía centrada (estilo ChatGPT) o lista de mensajes */}
          <Box
            ref={scrollRef}
            flex="1"
            overflowY="auto"
            position="relative"
          >
            {empty ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                h="100%"
                px={6}
                py={10}
                gap={3}
              >
                <Image
                  src={OSPREAN_AVATAR}
                  alt="Osprean"
                  boxSize="56px"
                  objectFit="contain"
                />
                <Text fontSize="16px" fontWeight={700} color="text.primary" textAlign="center" mt={1}>
                  ¿En qué puedo ayudarte?
                </Text>
                <Text
                  fontSize="12px"
                  color="text.muted"
                  textAlign="center"
                  maxW="320px"
                  lineHeight="1.55"
                >
                  Dime qué acción quieres ejecutar y la realizaré sobre la plataforma.
                </Text>
                <Box
                  as="button"
                  onClick={triggerUpload}
                  disabled={ingesting}
                  mt={2}
                  px={4}
                  py={2.5}
                  borderRadius="full"
                  border="1px solid"
                  borderColor="accent.teal"
                  bg="white"
                  color="accent.teal"
                  display="flex"
                  alignItems="center"
                  gap={2}
                  transition="all 0.15s ease"
                  _hover={{ bg: "accent.teal", color: "white", boxShadow: "0 4px 14px -4px rgba(49,151,149,0.45)" }}
                  _disabled={{ opacity: 0.5, cursor: "not-allowed", _hover: { bg: "white", color: "accent.teal", boxShadow: "none" } }}
                >
                  <Icon as={MdCloudUpload} boxSize={4} />
                  <Text fontSize="12px" fontWeight={800} letterSpacing="wider" textTransform="uppercase">
                    {ingesting ? `Subiendo Plan… ${ingestPct}%` : "Sube tu Plan Municipal"}
                  </Text>
                </Box>
                <Text
                  fontSize="10px"
                  color="text.muted"
                  textAlign="center"
                  maxW="300px"
                  lineHeight="1.5"
                >
                  PDF del Plan local de emergencias para activar el contexto operativo.
                </Text>
                <Text
                  fontSize="9px"
                  color="text.label"
                  letterSpacing="widest"
                  fontWeight={900}
                  textTransform="uppercase"
                  mt={4}
                >
                  Conectado a Seguridad · Sanitario · Logística · Gabinete · Dirección
                </Text>
              </Flex>
            ) : (
              <VStack
                align="stretch"
                spacing={5}
                px={4}
                py={5}
              >
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {busy && <TypingIndicator />}
              </VStack>
            )}
          </Box>

          {/* File input oculto compartido por el CTA de la portada para subir
              el Plan Municipal (PDF). Reutiliza el pipeline de ingesta RAG. */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFileChosen}
            style={{ display: "none" }}
          />

          {/* Input estilo ChatGPT: cápsula con botón redondo a la derecha */}
          <Box px={4} pb={4} pt={2} bg="bg.base">
            <Tooltip
              isDisabled={!ingesting}
              label={`Subiendo documentos al índice (${ingestPct}%). El chat estará disponible cuando termine la carga.`}
              placement="top"
              hasArrow
              openDelay={120}
              bg="text.primary"
              color="white"
              fontSize="11px"
              px={3}
              py={2}
              borderRadius="md"
              maxW="280px"
              textAlign="center"
            >
              <Box
                position="relative"
                bg={ingesting ? "bg.panelSubtle" : "white"}
                border="1px solid"
                borderColor={ingesting ? "border.subtle" : "border.subtle"}
                borderRadius="2xl"
                boxShadow="0 2px 12px -4px rgba(15,22,36,0.08)"
                transition="border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease"
                cursor={ingesting ? "not-allowed" : undefined}
                _focusWithin={
                  ingesting
                    ? undefined
                    : {
                        borderColor: "accent.teal",
                        boxShadow: "0 0 0 3px rgba(49,151,149,0.18)",
                      }
                }
              >
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    ingesting
                      ? `Subiendo documentos… ${ingestPct}%`
                      : "Escribe una acción…"
                  }
                  rows={1}
                  bg="transparent"
                  border="none"
                  resize="none"
                  pr={speechSupported ? "92px" : "52px"}
                  pl={4}
                  py={3}
                  fontSize="14px"
                  lineHeight="1.5"
                  _focus={{ boxShadow: "none", outline: "none" }}
                  isDisabled={!configured || ingesting}
                  overflow="hidden"
                  cursor={ingesting ? "not-allowed" : "text"}
                  _disabled={{
                    opacity: ingesting ? 0.7 : 0.4,
                    cursor: "not-allowed",
                  }}
                />
                {speechSupported && !busy && (
                  <Tooltip
                    label={listening ? "Detener dictado" : "Dictar por voz"}
                    placement="top"
                    hasArrow
                    openDelay={250}
                  >
                    <IconButton
                      aria-label={listening ? "Detener dictado" : "Dictar por voz"}
                      icon={<MdMic />}
                      onClick={listening ? stopDictation : startDictation}
                      isDisabled={!configured || ingesting}
                      position="absolute"
                      right="44px"
                      bottom="8px"
                      size="sm"
                      borderRadius="full"
                      bg={listening ? "red.500" : "bg.panelSubtle"}
                      color={listening ? "white" : "text.secondary"}
                      _hover={{
                        bg: listening ? "red.600" : "white",
                        color: listening ? "white" : "accent.teal",
                      }}
                      _disabled={{
                        bg: "border.subtle",
                        color: "text.muted",
                        cursor: "not-allowed",
                      }}
                      sx={
                        listening
                          ? {
                              animation: "ops-mic-pulse 1.4s ease-in-out infinite",
                              "@keyframes ops-mic-pulse": {
                                "0%, 100%": { boxShadow: "0 0 0 0 rgba(229,62,62,0.55)" },
                                "50%": { boxShadow: "0 0 0 8px rgba(229,62,62,0)" },
                              },
                            }
                          : undefined
                      }
                    />
                  </Tooltip>
                )}
                {busy ? (
                  <IconButton
                    aria-label="Detener"
                    icon={<MdStop />}
                    onClick={stop}
                    position="absolute"
                    right="8px"
                    bottom="8px"
                    size="sm"
                    borderRadius="full"
                    bg="text.primary"
                    color="white"
                    _hover={{ bg: "text.secondary" }}
                  />
                ) : (
                  <IconButton
                    aria-label="Enviar"
                    icon={<MdArrowUpward />}
                    onClick={submit}
                    isDisabled={!input.trim() || !configured || ingesting}
                    position="absolute"
                    right="8px"
                    bottom="8px"
                    size="sm"
                    borderRadius="full"
                    bg="accent.teal"
                    color="white"
                    _hover={{ bg: "accent.tealDeep" }}
                    _disabled={{
                      bg: "border.subtle",
                      color: "text.muted",
                      cursor: "not-allowed",
                    }}
                  />
                )}
              </Box>
            </Tooltip>
            <Text fontSize="9px" color="text.muted" textAlign="center" mt={2} letterSpacing="wider">
              {ingesting
                ? `Subiendo documentos · No disponible hasta finalizar (${ingestPct}%)`
                : "La IA puede ejecutar acciones reales sobre la plataforma."}
            </Text>
          </Box>
          </Box>
        </MotionPanelShell>
      )}
    </AnimatePresence>
  );
};

// Cápsula con animación de slide-in desde la derecha. El padding del
// contenedor y el bg/border replican el aspecto de CollapsibleSidePanel —
// pero como aquí el panel solo aparece cuando open=true, no hay pestaña fija
// en el borde, solo el handle redondo a la izquierda cuando está abierto.
const MotionBox = motion(Box);

interface MotionPanelShellProps {
  children: React.ReactNode;
  isCompact: boolean;
}

const MotionPanelShell = ({ children, isCompact }: MotionPanelShellProps) => {
  if (isCompact) {
    return (
      <MotionBox
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        // zIndex 1200 para superar los controles de Leaflet (≤1000) y el
        // backdrop (1100).
        zIndex={1200}
        bg="white"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        {children}
      </MotionBox>
    );
  }
  return (
    <MotionBox
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 432, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      h="100%"
      py={3}
      px={3}
      flexShrink={0}
      position="relative"
      overflow="hidden"
    >
      <Flex
        direction="column"
        w={{ lg: "408px" }}
        h="100%"
        bg="white"
        borderRadius="2xl"
        border="1px solid"
        borderColor="gray.100"
        boxShadow="xl"
        overflow="hidden"
        position="relative"
      >
        {children}
      </Flex>
    </MotionBox>
  );
};

// ───── subcomponentes ─────

const AiAvatar = ({ size = 28 }: { size?: number }) => (
  <Image
    src={OSPREAN_AVATAR}
    alt="Osprean"
    boxSize={`${size}px`}
    objectFit="contain"
    flexShrink={0}
    mt={0.5}
    draggable={false}
    userSelect="none"
  />
);

const TypingIndicator = () => (
  <Flex align="center" gap={2.5} px={1}>
    <AiAvatar size={26} />
    <HStack spacing={1}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          w="6px"
          h="6px"
          borderRadius="full"
          bg="text.muted"
          animation={`ops-bounce 1.2s ease-in-out ${i * 0.18}s infinite`}
          sx={{
            "@keyframes ops-bounce": {
              "0%, 80%, 100%": { transform: "scale(0.6)", opacity: 0.4 },
              "40%": { transform: "scale(1)", opacity: 1 },
            },
          }}
        />
      ))}
    </HStack>
  </Flex>
);

// UX conversacional: el chat solo muestra mensajes del usuario y del asistente.
// La única excepción son las acciones de MAPA aplicadas por la IA, que se
// muestran como una tarjeta con cuenta atrás y botón "Deshacer". Las acciones
// permanecen en el chat tras resolverse (como rastro auditable colapsado).
const hasAppliedAction = (tc: ToolCallRecord) => Boolean(tc.applied);

const MessageBubble = ({ message }: { message: OpsChatMessage }) => {
  const isUser = message.role === "user";
  const hasContent = Boolean(message.content?.trim());
  const appliedActions = (message.toolCalls ?? []).filter(hasAppliedAction);
  const hasApplied = appliedActions.length > 0;

  // Mensajes intermedios del LLM sin texto ni acciones aplicadas: no se renderizan.
  if (!isUser && !hasContent && !hasApplied) return null;

  if (isUser) {
    return (
      <Flex justify="flex-end">
        <Box
          maxW="86%"
          px={3.5} py={2.5}
          bg="accent.teal"
          color="white"
          borderRadius="2xl"
          borderBottomRightRadius="md"
          boxShadow="0 2px 8px -2px rgba(49,151,149,0.35)"
        >
          <Text fontSize="13.5px" lineHeight="1.55" whiteSpace="pre-wrap">
            {message.content}
          </Text>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex align="flex-start" gap={2.5}>
      <AiAvatar />
      <Box flex="1" minW={0}>
        {hasContent && (
          <Box
            px={3.5} py={2.5}
            bg="white"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="2xl"
            borderTopLeftRadius="md"
            boxShadow="0 1px 3px rgba(15,22,36,0.04)"
          >
            <Text fontSize="13.5px" lineHeight="1.55" whiteSpace="pre-wrap" color="text.primary">
              {message.content}
            </Text>
          </Box>
        )}
        {hasApplied && (
          <VStack align="stretch" spacing={1.5} mt={hasContent ? 2 : 0}>
            {appliedActions.map((tc) => (
              <AppliedActionCard key={tc.id} msgId={message.id} call={tc} />
            ))}
          </VStack>
        )}
      </Box>
    </Flex>
  );
};

// Ventana en segundos durante la cual la tarjeta muestra el botón "Deshacer"
// tras una acción aplicada. Pasado ese tiempo, la tarjeta se colapsa a un
// rastro permanente "✓ Acción aplicada" sin opción de undo.
const UNDO_WINDOW_SECONDS = 8;

// Tarjeta de acción auto-aplicada al mapa por la IA. Tres estados visuales:
//   · Vivo (dentro de la ventana de undo): banda verde + "Deshacer (Xs)".
//   · Colapsado (vencida la ventana): una línea con check, sin botones.
//   · Deshecho: línea apagada con icono de bloqueo.
// La acción ya está aplicada en el store cuando llega a este componente, así
// que el operador solo decide si revertirla.
const AppliedActionCard = ({ msgId, call }: { msgId: string; call: ToolCallRecord }) => {
  const updateToolCall = useAiOpsStore((s) => s.updateToolCall);
  const applied = call.applied;
  const undone = call.status === "undone" || applied?.undone === true;

  // Cuenta atrás de la ventana de undo. Se inicia desde appliedAt para que la
  // tarjeta sea consistente aunque el operador haya cerrado y reabierto el
  // drawer (no se reinicia el contador entre renders).
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!applied) return 0;
    const elapsed = (Date.now() - new Date(applied.appliedAt).getTime()) / 1000;
    return Math.max(0, UNDO_WINDOW_SECONDS - Math.floor(elapsed));
  });

  useEffect(() => {
    if (undone || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [undone, secondsLeft]);

  if (!applied) return null;

  const canUndo = !undone && secondsLeft > 0;

  const handleUndo = () => {
    if (!canUndo) return;
    const exec = undoAppliedAction(applied);
    // El result se sobreescribe con el rastro "deshecho" para que la próxima
    // vuelta del LLM vea que la acción no quedó en el mapa.
    const originalMsg = call.result?.message ?? applied.summary;
    updateToolCall(msgId, call.id, {
      status: "undone",
      applied: { ...applied, undone: true },
      result: {
        ok: exec.ok,
        message: `${originalMsg} → DESHECHO por el operador (${exec.message}).`,
      },
    });
    setSecondsLeft(0);
  };

  // Estado colapsado: deshecha o ventana vencida.
  if (undone) {
    return (
      <Box
        bg="bg.panelSubtle"
        borderLeft="2px solid"
        borderLeftColor="border.subtle"
        borderRadius="md"
        px={3} py={1.5}
        opacity={0.7}
      >
        <HStack spacing={2}>
          <Icon as={MdClose} color="text.secondary" boxSize="14px" />
          <Text fontSize="12px" color="text.secondary" textDecoration="line-through">
            {applied.summary}
          </Text>
          <Text fontSize="11px" color="text.secondary" ml="auto">Deshecho</Text>
        </HStack>
      </Box>
    );
  }

  if (!canUndo) {
    return (
      <Box
        bg="bg.panelSubtle"
        borderLeft="2px solid"
        borderLeftColor="accent.teal"
        borderRadius="md"
        px={3} py={1.5}
      >
        <HStack spacing={2}>
          <Icon as={MdCheckCircle} color="accent.teal" boxSize="14px" />
          <Text fontSize="12px" fontWeight={600} color="text.primary">
            {applied.summary}
          </Text>
          {applied.detail && (
            <Text fontSize="11px" color="text.secondary" noOfLines={1}>
              · {applied.detail}
            </Text>
          )}
        </HStack>
      </Box>
    );
  }

  // Estado vivo: aplicado pero todavía deshacible.
  return (
    <Box
      bg="bg.panelSubtle"
      borderLeft="2px solid"
      borderLeftColor="accent.teal"
      borderRadius="md"
      px={3} py={2}
    >
      <HStack spacing={2} align="flex-start">
        <Icon as={MdCheckCircle} color="accent.teal" boxSize="16px" mt="2px" />
        <Box flex="1" minW={0}>
          <Text fontSize="12px" fontWeight={700} color="text.primary" lineHeight="1.35">
            {applied.summary}
          </Text>
          {applied.detail && (
            <Text fontSize="11px" color="text.secondary" lineHeight="1.5" mt={0.5}>
              {applied.detail}
            </Text>
          )}
        </Box>
        <TacticalButton size="xs" variant="tactical-ghost" icon={MdClose} onClick={handleUndo}>
          Deshacer ({secondsLeft}s)
        </TacticalButton>
      </HStack>
    </Box>
  );
};

// Hook de dictado por voz usando Web Speech API. Pinta la transcripción en
// vivo dentro del input (interim + finales) de forma incremental: lo que el
// usuario ya tenía escrito se conserva intacto, y a la derecha aparece lo
// que se va dictando, igual que en el teclado por voz del móvil. Devuelve
// `supported=false` en navegadores que no la implementan (p. ej. Firefox),
// de modo que el botón simplemente no se renderiza.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const useSpeechDictation = (
  setInput: React.Dispatch<React.SetStateAction<string>>,
) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Texto del input en el momento de empezar a dictar. Sobre él se concatena
  // todo lo que vaya transcribiendo el reconocedor.
  const baseRef = useRef("");
  // Acumulado de frases ya consolidadas (isFinal=true) durante esta sesión.
  const finalRef = useRef("");
  const setInputRef = useRef(setInput);
  useEffect(() => {
    setInputRef.current = setInput;
  }, [setInput]);

  const Ctor =
    typeof window !== "undefined"
      ? ((window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }).SpeechRecognition ??
        (window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }).webkitSpeechRecognition)
      : undefined;
  const supported = Boolean(Ctor);

  const compose = (extra: string) => {
    const base = baseRef.current;
    const tail = (finalRef.current + extra).trimStart();
    if (!tail) return base;
    const sep = base && !/\s$/.test(base) ? " " : "";
    return base + sep + tail;
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  const start = () => {
    if (!Ctor) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* noop */
      }
    }
    // Capturar el texto actual del input usando un functional update
    // (forma idiomática de leer el estado más reciente sin acoplarse a él).
    setInputRef.current((prev) => {
      baseRef.current = prev;
      return prev;
    });
    finalRef.current = "";

    const rec = new Ctor();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const transcript = res[0]?.transcript ?? "";
        if (res.isFinal) {
          finalRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      setInputRef.current(compose(interim));
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      // Consolidar el texto final en el input y limpiar buffers.
      setInputRef.current(compose(""));
      finalRef.current = "";
      baseRef.current = "";
      setListening(false);
      recognitionRef.current = null;
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  return { supported, listening, start, stop };
};

