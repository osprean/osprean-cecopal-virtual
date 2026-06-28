// P6 — Modal grande inicial con las tareas operativas del rol (snapshot del
// diagrama de actividades del PAMIF). Al cerrar, queda accesible vía botón
// en sidebar (CecoviSidebar).

import {
  Badge,
  Box,
  Button,
  Checkbox,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useAuthStore } from "../auth/authStore";
import { useTareasStore } from "../store";
import type { Tarea } from "../services/cecoviApi";

const ROL_LABEL: Record<string, string> = {
  direccion: "Dirección",
  logistica: "Logística",
  sanitario: "Sanitario",
  seguridad: "Seguridad",
  gabinete: "Gabinete",
  campo: "Campo",
};

const ESTADO_LABEL: Record<Tarea["estado"], { label: string; color: string }> = {
  pending: { label: "PENDIENTE", color: "gray" },
  accepted: { label: "ACEPTADA", color: "blue" },
  completed: { label: "COMPLETADA", color: "green" },
  cancelled: { label: "CANCELADA", color: "red" },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TareasModal({ isOpen, onClose }: Props) {
  const { slug, me } = useAuthStore();
  const { items, loading, error, cargar, aceptar, completar } = useTareasStore();

  useEffect(() => {
    if (isOpen && slug) cargar(slug);
  }, [isOpen, slug, cargar]);

  if (!me || !slug) return null;

  const isJefe = me.roles.includes("direccion");
  // Agrupar por rol
  const grupos = items.reduce<Record<string, Tarea[]>>((acc, t) => {
    (acc[t.rol] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(2px)" />
      <ModalContent>
        <ModalHeader borderBottom="1px solid" borderColor="gray.200">
          <HStack justify="space-between" w="full">
            <Box>
              <Heading size="md">Tareas operativas iniciales</Heading>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Acciones del minuto cero según el diagrama de actividades del PAMIF.
                Marca cada paso al completarlo.
              </Text>
            </Box>
            <Badge colorScheme="purple" fontSize="sm">
              {isJefe ? "Vista jefe (todas las áreas)" : `Rol: ${me.roles.join(", ")}`}
            </Badge>
          </HStack>
          <ModalCloseButton />
        </ModalHeader>

        <ModalBody py={6}>
          {loading && <Spinner />}
          {error && <Text color="red.500">{error}</Text>}
          {!loading && !error && items.length === 0 && (
            <Text color="gray.500">Sin tareas pendientes para tu rol.</Text>
          )}
          <Stack spacing={6}>
            {Object.entries(grupos).map(([rol, ts]) => (
              <Box key={rol}>
                <Heading size="sm" color="red.700" mb={3} textTransform="uppercase">
                  {ROL_LABEL[rol] ?? rol}
                </Heading>
                <Stack spacing={2}>
                  {ts
                    .sort((a, b) => a.orden - b.orden)
                    .map((t) => (
                      <Box
                        key={t.id}
                        p={3}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="md"
                        bg={t.estado === "completed" ? "green.50" : "white"}
                      >
                        <HStack justify="space-between" align="start">
                          <Box flex={1}>
                            <HStack>
                              <Badge colorScheme={ESTADO_LABEL[t.estado].color}>
                                {ESTADO_LABEL[t.estado].label}
                              </Badge>
                              {t.codigo && (
                                <Text fontSize="xs" color="gray.500" fontWeight="bold">
                                  {t.codigo}
                                </Text>
                              )}
                            </HStack>
                            <Text fontWeight="600" mt={2}>
                              {t.titulo}
                            </Text>
                            {t.descripcion && (
                              <Text fontSize="sm" color="gray.600" mt={1}>
                                {t.descripcion}
                              </Text>
                            )}
                          </Box>
                          <Stack spacing={1} align="end">
                            <Checkbox
                              isChecked={t.estado !== "pending" && t.estado !== "cancelled"}
                              isDisabled={t.estado === "completed" || t.estado === "cancelled"}
                              onChange={() => slug && aceptar(slug, t.id)}
                            >
                              Aceptar
                            </Checkbox>
                            <Checkbox
                              isChecked={t.estado === "completed"}
                              isDisabled={t.estado === "pending" || t.estado === "cancelled"}
                              onChange={() => slug && completar(slug, t.id)}
                              colorScheme="green"
                            >
                              Completada
                            </Checkbox>
                          </Stack>
                        </HStack>
                      </Box>
                    ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor="gray.200">
          <Button onClick={onClose} colorScheme="blue">
            Cerrar y continuar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Hook para auto-abrir la modal en el primer acceso del usuario a la emergencia.
// Persiste en localStorage la clave `cecovi_tareas_modal_shown_<slug>_<userId>`.
export function useAutoOpenTareas(): {
  isOpen: boolean;
  onClose: () => void;
  open: () => void;
} {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { slug, me } = useAuthStore();

  useEffect(() => {
    if (!slug || !me?.usuario_id) return;
    const key = `cecovi_tareas_modal_shown_${slug}_${me.usuario_id}`;
    if (!localStorage.getItem(key)) {
      onOpen();
      localStorage.setItem(key, "1");
    }
  }, [slug, me?.usuario_id, onOpen]);

  return { isOpen, onClose, open: onOpen };
}
