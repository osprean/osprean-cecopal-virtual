import { useState } from "react";
import { Box, Button, Heading, Input, Text, VStack, useToast } from "@chakra-ui/react";
import { useAuthStore } from "../../auth/authStore";

/** Login por credencial temporal (la recibida por email). slug = id de ruta. */
export function LoginView({ slug }: { slug: string }) {
  const [credential, setCredential] = useState("");
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const toast = useToast();

  const submit = async () => {
    if (!credential.trim()) return;
    try {
      await login(slug, credential.trim());
    } catch (e: any) {
      toast({
        title: "No se pudo acceder",
        description: e?.message || "Credencial inválida o caducada.",
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    }
  };

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.900">
      <Box bg="gray.800" p={8} rounded="xl" w="full" maxW="420px" boxShadow="2xl">
        <VStack spacing={5} align="stretch">
          <Heading size="md" color="white">
            CECOPAL Virtual
          </Heading>
          <Text fontSize="sm" color="gray.400">
            Emergencia <strong>{slug}</strong>. Introduce tu credencial temporal de acceso.
          </Text>
          <Input
            type="password"
            placeholder="Credencial de acceso"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            bg="gray.700"
            color="white"
            borderColor="gray.600"
            autoFocus
          />
          <Button colorScheme="pink" onClick={submit} isLoading={loading} isDisabled={!credential.trim()}>
            Acceder
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
