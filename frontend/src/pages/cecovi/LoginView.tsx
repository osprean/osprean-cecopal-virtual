import { useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Heading,
  Input,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useAuthStore } from "../../auth/authStore";

/** Login por credencial temporal (la recibida por email). slug = id de ruta.
 *
 * P3: la credencial puede ser MASTER (titular) o BACKUP (compartida por suplentes).
 * - Si master: solo se necesita el token.
 * - Si backup: se necesita además el email del suplente que entra.
 * Mostramos siempre el campo email como opcional para simplificar el flujo;
 * el master puede dejarlo vacío.
 */
export function LoginView({ slug }: { slug: string }) {
  const [credential, setCredential] = useState("");
  const [email, setEmail] = useState("");
  const [needsForce, setNeedsForce] = useState(false);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const toast = useToast();

  const submit = async () => {
    if (!credential.trim()) return;
    try {
      await login(slug, credential.trim(), {
        email: email.trim() || undefined,
        force: needsForce,
      });
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "sesion_activa") {
        setNeedsForce(true);
        toast({
          title: "Sesión activa",
          description: "Hay otra sesión abierta con esta credencial. Pulsa de nuevo para echarla.",
          status: "warning",
          duration: 6000,
        });
        return;
      }
      const msg =
        code === "backup_email_required"
          ? "Esta credencial es de backup. Indica tu email para identificarte."
          : code === "email_no_autorizado"
            ? "El email no figura como suplente en esta emergencia."
            : e?.message || "Credencial inválida o caducada.";
      toast({
        title: "No se pudo acceder",
        description: msg,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.900"
    >
      <Box bg="gray.800" p={8} rounded="xl" w="full" maxW="420px" boxShadow="2xl">
        <VStack spacing={4} align="stretch">
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
          <Input
            type="email"
            placeholder="Tu email (solo si la credencial es backup)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            bg="gray.700"
            color="white"
            borderColor="gray.600"
          />
          {needsForce && (
            <Alert status="warning" borderRadius="md" fontSize="sm">
              <AlertIcon /> Cerrar sesión anterior y entrar como esta.
            </Alert>
          )}
          <Button
            colorScheme="pink"
            onClick={submit}
            isLoading={loading}
            isDisabled={!credential.trim()}
          >
            {needsForce ? "Forzar entrada" : "Acceder"}
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
