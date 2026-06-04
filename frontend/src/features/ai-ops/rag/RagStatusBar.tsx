// Barra compacta de estado del índice RAG, embebida en el header del
// Centro Operativo IA. Muestra qué Plan está cargado, progreso de ingesta,
// y permite cargar un PDF adicional. Diseñada para no distraer en uso
// normal: cuando todo está listo, se reduce a un texto monoespaciado de
// una línea. Cuando hay ingesta en curso, muestra una mini barra.

import { useEffect, useRef, useState } from "react";
import { Box, Flex, HStack, Icon, IconButton, Text, Tooltip } from "@chakra-ui/react";
import { MdCloudUpload, MdInfo } from "react-icons/md";
import {
  getIngestStatus,
  ingestPdfFile,
  listIngestedDocs,
  onIngestProgress,
  seedPlatermuIfNeeded,
} from "./index";
import type { IngestProgress, IngestedDocSummary } from "./types";

export const RagStatusBar = () => {
  const [status, setStatus] = useState<IngestProgress>(getIngestStatus);
  const [docs, setDocs] = useState<IngestedDocSummary[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Suscripción al progreso. Refresca el catálogo de documentos cuando una
  // ingesta termina o falla.
  useEffect(() => {
    const off = onIngestProgress((p) => {
      setStatus(p);
      if (p.phase === "done" || p.phase === "error" || p.phase === "idle") {
        void listIngestedDocs().then(setDocs);
      }
    });
    // Catálogo inicial.
    void listIngestedDocs().then(setDocs);
    return off;
  }, []);

  // Lanza el seed del PLATERMU al montar (una vez por sesión).
  useEffect(() => {
    void seedPlatermuIfNeeded();
  }, []);

  const onUploadClick = () => fileRef.current?.click();
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) return;
    try {
      await ingestPdfFile(f);
    } catch {
      /* el estado de error ya se refleja en `status` */
    }
  };

  const busy =
    status.phase === "extracting" ||
    status.phase === "chunking" ||
    status.phase === "embedding" ||
    status.phase === "indexing";
  const progressPct = Math.round((status.progress || 0) * 100);

  return (
    <Flex
      align="center"
      gap={2}
      px={3}
      py={1.5}
      borderBottom="1px solid"
      borderColor="border.subtle"
      bg="bg.panelSubtle"
      flexShrink={0}
      fontFamily="mono"
      fontSize="10px"
      letterSpacing="wider"
      color="text.muted"
    >
      <Box w="6px" h="6px" borderRadius="full" bg={busy ? "accent.amber" : status.phase === "error" ? "accent.red" : "accent.teal"} flexShrink={0} />
      {busy ? (
        <>
          <Text textTransform="uppercase" fontWeight={800} color="text.secondary">
            RAG · {status.phase}
          </Text>
          <Text noOfLines={1} flex="1" minW={0}>{status.message}</Text>
          {status.progress > 0 && (
            <Text fontWeight={800} color="text.secondary">
              {progressPct}%
            </Text>
          )}
        </>
      ) : status.phase === "error" ? (
        <>
          <Text textTransform="uppercase" fontWeight={800} color="accent.red">
            RAG · ERROR
          </Text>
          <Text noOfLines={1} flex="1" minW={0} color="accent.red">
            {status.error ?? status.message}
          </Text>
        </>
      ) : (
        <>
          <Text textTransform="uppercase" fontWeight={800} color="text.secondary">
            RAG
          </Text>
          <Text noOfLines={1} flex="1" minW={0}>
            {docs.length === 0
              ? "Preparando índice del Plan…"
              : `${docs.length} doc · ${docs.reduce((a, d) => a + d.chunkCount, 0)} fragmentos`}
          </Text>
          {docs.length > 0 && (
            <Tooltip
              label={
                <Box fontFamily="mono" fontSize="11px">
                  {docs.map((d) => (
                    <Text key={d.docId}>
                      · {d.title} ({d.chunkCount} frag.)
                    </Text>
                  ))}
                </Box>
              }
              placement="bottom-end"
              hasArrow
              openDelay={200}
            >
              <Box as="span" display="inline-flex" alignItems="center" cursor="help">
                <Icon as={MdInfo} boxSize={3.5} color="text.muted" />
              </Box>
            </Tooltip>
          )}
        </>
      )}
      <HStack spacing={0}>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFileChosen}
          style={{ display: "none" }}
        />
        <Tooltip label="Cargar Plan en PDF" placement="bottom" hasArrow openDelay={250}>
          <IconButton
            aria-label="Cargar PDF"
            size="xs"
            variant="ghost"
            icon={<Icon as={MdCloudUpload} boxSize={3.5} />}
            onClick={onUploadClick}
            isDisabled={busy}
            color="text.secondary"
            _hover={{ bg: "white", color: "accent.teal" }}
          />
        </Tooltip>
      </HStack>
    </Flex>
  );
};
