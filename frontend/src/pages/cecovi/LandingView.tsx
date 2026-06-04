import { Box, Heading, Text, VStack } from "@chakra-ui/react";

// Raíz sin emergencia: el acceso es por /{idEmergencia}. Sin ruta válida no hay
// nada que mostrar (cada emergencia se abre por su enlace).
export function LandingView() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.900">
      <VStack spacing={3} maxW="480px" textAlign="center" px={6}>
        <Heading size="lg" color="white">
          CECOPAL Virtual
        </Heading>
        <Text color="gray.400">
          Accede a tu emergencia desde el enlace recibido por correo
          (<Text as="span" color="gray.200">/&lt;id-emergencia&gt;</Text>).
        </Text>
      </VStack>
    </Box>
  );
}
