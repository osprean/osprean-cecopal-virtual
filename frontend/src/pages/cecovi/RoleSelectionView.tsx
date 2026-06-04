import { useEffect, useState } from "react";
import {
  Box, Button, Checkbox, Heading, Stack, Text, VStack, useToast,
} from "@chakra-ui/react";
import { cecoviApi } from "../../services/cecoviApi";
import { useAuthStore } from "../../auth/authStore";

const ROL_LABELS: Record<string, string> = {
  seguridad: "Seguridad",
  sanitario: "Sanitario",
  logistica: "Logística",
  gabinete: "Gabinete de prensa",
  campo: "Puesto avanzado (campo)",
};

/** Primer acceso: elección libre de rol(es). Inmutable tras confirmar (I4). */
export function RoleSelectionView({ slug }: { slug: string }) {
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingCat, setLoadingCat] = useState(true);
  const seleccionarRoles = useAuthStore((s) => s.seleccionarRoles);
  const loading = useAuthStore((s) => s.loading);
  const toast = useToast();

  useEffect(() => {
    cecoviApi
      .catalogoRoles(slug)
      .then((r) => setCatalogo(r.seleccionables))
      .catch(() => setCatalogo([]))
      .finally(() => setLoadingCat(false));
  }, [slug]);

  const toggle = (rol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(rol) ? next.delete(rol) : next.add(rol);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    try {
      await seleccionarRoles(slug, [...selected]);
    } catch (e: any) {
      toast({
        title: "No se pudo confirmar",
        description: e?.message || "Inténtalo de nuevo.",
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    }
  };

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.900">
      <Box bg="gray.800" p={8} rounded="xl" w="full" maxW="460px" boxShadow="2xl">
        <VStack spacing={5} align="stretch">
          <Heading size="md" color="white">
            Elige tu rol
          </Heading>
          <Text fontSize="sm" color="gray.400">
            Selecciona uno o varios roles. <strong>Una vez confirmado, no podrás cambiarlo.</strong>
          </Text>
          <Stack spacing={3}>
            {loadingCat && <Text color="gray.500" fontSize="sm">Cargando…</Text>}
            {catalogo.map((rol) => (
              <Checkbox
                key={rol}
                isChecked={selected.has(rol)}
                onChange={() => toggle(rol)}
                colorScheme="pink"
                color="white"
              >
                {ROL_LABELS[rol] ?? rol}
              </Checkbox>
            ))}
          </Stack>
          <Button
            colorScheme="pink"
            onClick={submit}
            isLoading={loading}
            isDisabled={selected.size === 0}
          >
            Confirmar rol(es)
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
