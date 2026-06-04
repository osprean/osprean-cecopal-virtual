import { useState } from "react";
import { Box, Flex, VStack } from "@chakra-ui/react";
import { useFakeRealtime } from "../../hooks";
import { LogisticaHeader } from "./LogisticaHeader";
import {
  InventorySection,
  MachinerySection,
  RequestsSection,
  ServicesSection,
  SheltersSection,
  VehiclesSection,
} from "./LogisticaSections";
import { AddSupplyModal, NewLogisticsRequestModal } from "./LogisticaModals";

// Logística: layout simplificado a una sola columna a ancho completo. Se ha
// retirado el panel lateral de "Críticos y Actividad" para dar todo el espacio
// disponible al inventario y resto de secciones.
export const LogisticaPage = () => {
  useFakeRealtime({ intervalMs: 8000 });
  const [addOpen, setAddOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="bg.base" overflow="hidden">
      <LogisticaHeader />

      <Box flex="1" minH={0} p={{ base: 2, md: 3 }}>
        <Box h="100%" overflowY="auto" minH={0}>
          <VStack spacing={{ base: 2, md: 3 }} align="stretch">
            <InventorySection onAdd={() => setAddOpen(true)} />
            <RequestsSection onCreate={() => setReqOpen(true)} />
            <VehiclesSection />
            <MachinerySection />
            <SheltersSection />
            <ServicesSection />
          </VStack>
        </Box>
      </Box>

      <AddSupplyModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <NewLogisticsRequestModal isOpen={reqOpen} onClose={() => setReqOpen(false)} />
    </Flex>
  );
};
