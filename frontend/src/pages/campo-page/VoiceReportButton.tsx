import { useEffect, useState } from "react";
import { Box, Flex, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { MdMic, MdMicOff, MdCheck, MdClose, MdGraphicEq } from "react-icons/md";
import { TacticalButton } from "../../components/base";
import { useCampoStore } from "../../store";
import { useVoiceRecognition } from "../../hooks";

const MotionDiv = motion.div;

// Big tap target. Tap-to-talk: press once to start, press again to stop.
// On stop, transcription is shown for review and saved as a FieldReport.
export const VoiceReportButton = () => {
  const addReport = useCampoStore((s) => s.addReport);
  const {
    supported,
    listening,
    transcript,
    finalTranscript,
    error,
    start,
    stop,
    reset,
  } = useVoiceRecognition({ lang: "es-ES", continuous: true });
  const [pendingText, setPendingText] = useState<string | null>(null);

  useEffect(() => {
    // when listening stops and we have a transcript, surface for review
    if (!listening && finalTranscript && pendingText === null) {
      setPendingText(finalTranscript);
    }
  }, [listening, finalTranscript, pendingText]);

  const handleToggle = () => {
    if (listening) {
      stop();
    } else {
      reset();
      setPendingText(null);
      start();
    }
  };

  const handleConfirm = () => {
    if (!pendingText) return;
    addReport({
      kind: "voice",
      title: "Reporte oral",
      body: pendingText,
      transcribed: true,
    });
    setPendingText(null);
    reset();
  };

  const handleDiscard = () => {
    setPendingText(null);
    reset();
  };

  return (
    <Box
      bg="white"
      border="1.5px solid"
      borderColor={listening ? "state.critical" : pendingText ? "accent.teal" : "border.strong"}
      borderRadius="3xl"
      p={4}
      boxShadow="0 8px 28px rgba(15,22,36,0.10)"
    >
      <VStack spacing={3} align="stretch">
        <HStack justify="space-between">
          <Text
            fontSize="11px"
            fontWeight={900}
            letterSpacing="widest"
            textTransform="uppercase"
            color="text.label"
          >
            Reporte por voz
          </Text>
          {!supported && (
            <Text fontSize="10px" color="state.alert" fontWeight={800} letterSpacing="wider">
              NO SOPORTADO EN ESTE NAVEGADOR
            </Text>
          )}
          {error && (
            <Text fontSize="10px" color="state.critical" fontWeight={800} letterSpacing="wider">
              ERROR · {error.toUpperCase()}
            </Text>
          )}
        </HStack>

        {/* Big tap target */}
        <Flex
          as="button"
          onClick={handleToggle}
          disabled={!supported}
          h="120px"
          align="center"
          justify="center"
          gap={4}
          bg={listening ? "state.critical" : "accent.teal"}
          color="white"
          borderRadius="2xl"
          cursor={supported ? "pointer" : "not-allowed"}
          opacity={supported ? 1 : 0.45}
          _hover={supported ? { transform: "translateY(-1px)", boxShadow: "0 12px 28px rgba(15,22,36,0.20)" } : undefined}
          _active={supported ? { transform: "translateY(0)" } : undefined}
          transition="all 0.18s ease"
          position="relative"
          overflow="hidden"
        >
          {listening && (
            <MotionDiv
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.18)",
              }}
              animate={{ opacity: [0.18, 0.05, 0.18] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <Icon as={listening ? MdMic : supported ? MdMic : MdMicOff} boxSize={12} />
          <Text fontSize="2xl" fontWeight={900} letterSpacing="widest" textTransform="uppercase">
            {listening ? "ESCUCHANDO…" : pendingText ? "REVISAR" : "HABLAR"}
          </Text>
          {listening && (
            <Icon as={MdGraphicEq} boxSize={8} animation="tactical-pulse 1s ease-in-out infinite" />
          )}
        </Flex>

        <AnimatePresence>
          {listening && transcript && (
            <MotionDiv
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Box
                p={3}
                bg="state.criticalSoft"
                border="1px solid"
                borderColor="state.critical"
                borderRadius="xl"
              >
                <Text
                  fontSize="10px"
                  fontWeight={900}
                  letterSpacing="widest"
                  color="state.critical"
                  textTransform="uppercase"
                  mb={1}
                >
                  Transcripción en directo
                </Text>
                <Text fontSize="md" color="text.primary" fontWeight={600} lineHeight="short">
                  {transcript}
                </Text>
              </Box>
            </MotionDiv>
          )}

          {!listening && pendingText && (
            <MotionDiv
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <VStack spacing={3} align="stretch">
                <Box
                  p={3}
                  bg="accent.tealSoft"
                  border="1px solid"
                  borderColor="accent.teal"
                  borderRadius="xl"
                >
                  <Text
                    fontSize="10px"
                    fontWeight={900}
                    letterSpacing="widest"
                    color="accent.tealDeep"
                    textTransform="uppercase"
                    mb={1}
                  >
                    Reporte transcrito · revísalo
                  </Text>
                  <Text fontSize="md" color="text.primary" fontWeight={600} lineHeight="short">
                    {pendingText}
                  </Text>
                </Box>
                <HStack spacing={2}>
                  <TacticalButton
                    flex="1"
                    size="lg"
                    variant="tactical-ghost"
                    icon={MdClose}
                    onClick={handleDiscard}
                  >
                    Descartar
                  </TacticalButton>
                  <TacticalButton
                    flex="2"
                    size="lg"
                    variant="tactical-primary"
                    icon={MdCheck}
                    onClick={handleConfirm}
                  >
                    Enviar reporte
                  </TacticalButton>
                </HStack>
              </VStack>
            </MotionDiv>
          )}
        </AnimatePresence>
      </VStack>
    </Box>
  );
};
