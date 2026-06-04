import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Icon,
  Image,
  Input,
  Spinner,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  MdBrush,
  MdCall,
  MdCheckCircle,
  MdImage,
  MdLayers,
  MdMessage,
  MdPersonOutline,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { TacticalButton, TacticalModal } from "../../components/base";

interface SendMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CaptureMode = "full" | "clean";

// Marca de clase que se aplica al clon del contenedor del mapa en html2canvas
// cuando se está capturando en modo "solo dibujos". Las reglas CSS asociadas
// ocultan marcadores y polígonos preservando los trazos del usuario.
const CLEAN_CAPTURE_CLASS = "tac-clean-capture";
const CLEAN_CAPTURE_CSS = `
  .${CLEAN_CAPTURE_CLASS} .leaflet-marker-pane,
  .${CLEAN_CAPTURE_CLASS} .leaflet-shadow-pane,
  .${CLEAN_CAPTURE_CLASS} .leaflet-tooltip-pane,
  .${CLEAN_CAPTURE_CLASS} .leaflet-popup-pane { display: none !important; }
  .${CLEAN_CAPTURE_CLASS} .leaflet-overlay-pane svg path:not(.tac-drawing-stroke) { display: none !important; }
`;

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
}

// Lista local de destinatarios — futuro: leerla de un store de contactos.
const CONTACTS: Contact[] = [
  { id: "c1", name: "J. Torres", role: "Director del Plan", phone: "+34 911 02 03 00" },
  { id: "c2", name: "Tte. Lara Méndez", role: "PMA-Norte", phone: "+34 911 02 03 01" },
  { id: "c3", name: "Sgto. Núñez", role: "Jefe Seguridad", phone: "+34 911 02 03 04" },
  { id: "c4", name: "Dra. Pereira", role: "Coord. Sanitario", phone: "+34 911 02 03 05" },
  { id: "c5", name: "Coord. Romero", role: "Jefe Logística", phone: "+34 911 02 03 06" },
  { id: "c6", name: "A. Soler", role: "Gabinete", phone: "+34 911 02 03 07" },
  { id: "c7", name: "112 Emergencias", role: "Sala 112", phone: "112" },
];

const findMapContainer = (): HTMLElement | null => {
  // react-leaflet añade la clase "leaflet-container" al contenedor raíz.
  return document.querySelector(".leaflet-container") as HTMLElement | null;
};

export const SendMapModal = ({ isOpen, onClose }: SendMapModalProps) => {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("full");

  useEffect(() => {
    if (!isOpen) {
      // Reset estado al cerrar.
      setSnapshot(null);
      setBusy(false);
      setError(null);
      setSelected(new Set());
      setMessage("");
      setSent(false);
      setSearch("");
      setMode("full");
      return;
    }

    const el = findMapContainer();
    if (!el) {
      setError("No se ha podido localizar el mapa.");
      return;
    }
    setBusy(true);
    setError(null);
    const isClean = mode === "clean";
    // html2canvas pesa ~150 kB; lo cargamos solo cuando el operador abre este
    // modal en lugar de empaquetarlo en el bundle inicial.
    import("html2canvas")
      .then(({ default: html2canvas }) =>
        html2canvas(el, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#EEF2F6",
          logging: false,
          scale: window.devicePixelRatio > 1 ? 1.5 : 1,
          onclone: (clonedDoc, clonedEl) => {
            if (!isClean) return;
            // Inyectamos un <style> y marcamos el contenedor clonado para que las
            // reglas oculten todo excepto los trazos del usuario. Operamos solo
            // sobre el clon: el mapa real no se modifica.
            const style = clonedDoc.createElement("style");
            style.textContent = CLEAN_CAPTURE_CSS;
            clonedDoc.head.appendChild(style);
            clonedEl.classList.add(CLEAN_CAPTURE_CLASS);
          },
        }),
      )
      .then((canvas) => {
        setSnapshot(canvas.toDataURL("image/png"));
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`No se pudo capturar el mapa: ${msg}`);
      })
      .finally(() => setBusy(false));
  }, [isOpen, mode]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = CONTACTS.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const handleDownload = () => {
    if (!snapshot) return;
    const a = document.createElement("a");
    a.href = snapshot;
    a.download = `mapa-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
  };

  const handleSend = () => {
    if (selected.size === 0 || !snapshot) return;
    // Mock send — en una integración real iría aquí WhatsApp / TETRA / etc.
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1400);
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar mapa"
      subtitle="Captura el mapa actual y compártelo con uno o varios destinatarios"
      icon={MdImage}
      size="2xl"
      footer={
        sent ? (
          <HStack color="state.operational">
            <Icon as={MdCheckCircle} />
            <Text fontSize="sm" fontWeight={700}>
              Enviado a {selected.size} destinatario{selected.size === 1 ? "" : "s"}
            </Text>
          </HStack>
        ) : (
          <HStack spacing={2}>
            <TacticalButton variant="tactical-ghost" onClick={onClose}>
              Cancelar
            </TacticalButton>
            <TacticalButton
              variant="tactical"
              onClick={handleDownload}
              isDisabled={!snapshot}
            >
              Descargar PNG
            </TacticalButton>
            <TacticalButton
              variant="tactical-primary"
              icon={MdMessage}
              onClick={handleSend}
              isDisabled={!snapshot || selected.size === 0}
            >
              Enviar a {selected.size || 0}
            </TacticalButton>
          </HStack>
        )
      }
    >
      <Flex gap={4} align="stretch" direction={{ base: "column", md: "row" }}>
        {/* PREVIEW */}
        <VStack flex="1" minW={0} align="stretch" spacing={2}>
          <Box>
            <Text
              fontSize="10px"
              fontWeight={900}
              letterSpacing="widest"
              color="text.label"
              textTransform="uppercase"
              mb={1.5}
            >
              Contenido de la captura
            </Text>
            <HStack spacing={2}>
              <CaptureModeOption
                label="Mapa completo"
                description="Recursos, emergencia y tus dibujos."
                icon={MdLayers}
                active={mode === "full"}
                onClick={() => setMode("full")}
              />
              <CaptureModeOption
                label="Solo dibujos"
                description="Mapa limpio, sin recursos ni emergencia."
                icon={MdBrush}
                active={mode === "clean"}
                onClick={() => setMode("clean")}
              />
            </HStack>
          </Box>
          <Box
            flex="1"
            bg="bg.panelSubtle"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="lg"
            minH="280px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            {busy && (
              <VStack spacing={2}>
                <Spinner color="accent.teal" />
                <Text fontSize="xs" color="text.muted">Capturando mapa…</Text>
              </VStack>
            )}
            {!busy && error && (
              <Text fontSize="xs" color="state.critical" px={4} textAlign="center">
                {error}
              </Text>
            )}
            {!busy && !error && snapshot && (
              <Image src={snapshot} alt="Captura del mapa" maxH="360px" objectFit="contain" />
            )}
          </Box>
        </VStack>

        {/* RECIPIENTS + MESSAGE */}
        <Box w={{ base: "100%", md: "280px" }} flexShrink={0}>
          <Text
            fontSize="10px"
            fontWeight={900}
            letterSpacing="widest"
            color="text.label"
            textTransform="uppercase"
            mb={1.5}
          >
            Destinatarios
          </Text>
          <Input
            size="sm"
            placeholder="Buscar contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            mb={2}
            bg="white"
            borderColor="border.strong"
          />
          <VStack
            spacing={1}
            align="stretch"
            maxH="180px"
            overflowY="auto"
            pr={1}
          >
            {filtered.map((c) => {
              const isOn = selected.has(c.id);
              return (
                <Flex
                  key={c.id}
                  as="button"
                  type="button"
                  onClick={() => toggle(c.id)}
                  align="center"
                  gap={2}
                  px={2}
                  py={1.5}
                  bg={isOn ? "bg.panelRaised" : "bg.panelSubtle"}
                  border="1px solid"
                  borderColor={isOn ? "accent.teal" : "border.subtle"}
                  borderRadius="md"
                  cursor="pointer"
                  _hover={{ borderColor: "accent.teal" }}
                  textAlign="left"
                >
                  <Icon as={MdPersonOutline} boxSize={3.5} color={isOn ? "accent.teal" : "text.muted"} />
                  <Box flex="1" minW={0}>
                    <Text fontSize="11px" color="text.primary" fontWeight={800} noOfLines={1}>
                      {c.name}
                    </Text>
                    <Text fontSize="10px" color="text.muted" noOfLines={1}>
                      {c.role}
                    </Text>
                  </Box>
                  <HStack spacing={1}>
                    <Icon as={MdCall} boxSize={3} color="text.muted" />
                    <Text fontSize="10px" color="text.muted" fontFamily="mono">
                      {c.phone}
                    </Text>
                  </HStack>
                </Flex>
              );
            })}
          </VStack>

          <Text
            mt={3}
            fontSize="10px"
            fontWeight={900}
            letterSpacing="widest"
            color="text.label"
            textTransform="uppercase"
            mb={1.5}
          >
            Mensaje (opcional)
          </Text>
          <Textarea
            size="sm"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Información adicional para los destinatarios…"
            bg="white"
            borderColor="border.strong"
            resize="vertical"
          />
        </Box>
      </Flex>
    </TacticalModal>
  );
};

const CaptureModeOption = ({
  label,
  description,
  icon,
  active,
  onClick,
}: {
  label: string;
  description: string;
  icon: IconType;
  active: boolean;
  onClick: () => void;
}) => (
  <Flex
    as="button"
    type="button"
    onClick={onClick}
    flex="1"
    align="flex-start"
    gap={2}
    px={2.5}
    py={2}
    bg={active ? "bg.panelRaised" : "bg.panelSubtle"}
    border="1px solid"
    borderColor={active ? "accent.teal" : "border.subtle"}
    borderRadius="md"
    cursor="pointer"
    textAlign="left"
    _hover={{ borderColor: "accent.teal" }}
  >
    <Icon
      as={icon}
      boxSize={4}
      mt="2px"
      color={active ? "accent.teal" : "text.muted"}
    />
    <Box flex="1" minW={0}>
      <Text fontSize="11px" fontWeight={800} color="text.primary" noOfLines={1}>
        {label}
      </Text>
      <Text fontSize="10px" color="text.muted" noOfLines={2}>
        {description}
      </Text>
    </Box>
  </Flex>
);
