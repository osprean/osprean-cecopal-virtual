import { useEffect, useState } from "react";
import {
  Box,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { MdCheckCircle, MdInventory2, MdLocalShipping } from "react-icons/md";
import { TacticalButton, TacticalModal } from "../../components/base";
import { useLogisticaStore } from "../../store";
import type {
  LogisticsRequestPriority,
  SupplyCategory,
} from "../../types";
import { SUPPLY_LABEL } from "../../types";

const Label = ({ children }: { children: React.ReactNode }) => (
  <Text fontSize="10px" color="text.label" fontWeight={900} letterSpacing="widest" textTransform="uppercase" mb={1.5}>
    {children}
  </Text>
);

interface ModalCommonProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddSupplyModal = ({ isOpen, onClose }: ModalCommonProps) => {
  const upsert = useLogisticaStore((s) => s.upsertSupply);
  const [category, setCategory] = useState<SupplyCategory>("medical");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ud");
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [location, setLocation] = useState("Base Logística Robledo");

  useEffect(() => {
    if (!isOpen) {
      setName(""); setUnit("ud"); setStock(0); setMinStock(0);
      setLocation("Base Logística Robledo");
    }
  }, [isOpen]);

  const submit = () => {
    if (!name) return;
    upsert({ category, name, unit, stock, minStock, location });
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir recurso al inventario"
      icon={MdInventory2}
      state="active"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>Cancelar</TacticalButton>
          <TacticalButton variant="tactical-primary" icon={MdCheckCircle} isDisabled={!name} onClick={submit}>
            Añadir
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          <Box>
            <Label>Categoría</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as SupplyCategory)} size="sm" bg="white" borderColor="border.strong">
              {(Object.entries(SUPPLY_LABEL) as [SupplyCategory, string][]).map(([k, lbl]) => (
                <option key={k} value={k}>{lbl}</option>
              ))}
            </Select>
          </Box>
          <Box>
            <Label>Unidad</Label>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} size="sm" bg="white" borderColor="border.strong">
              {["ud", "L", "kg", "m", "pack"].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Box>
        </SimpleGrid>
        <Box>
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} size="sm" bg="white" borderColor="border.strong" />
        </Box>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          <Box>
            <Label>Stock actual</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} size="sm" bg="white" borderColor="border.strong" />
          </Box>
          <Box>
            <Label>Stock mínimo</Label>
            <Input type="number" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} size="sm" bg="white" borderColor="border.strong" />
          </Box>
        </SimpleGrid>
        <Box>
          <Label>Ubicación</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} size="sm" bg="white" borderColor="border.strong" />
        </Box>
      </VStack>
    </TacticalModal>
  );
};

export const NewLogisticsRequestModal = ({ isOpen, onClose }: ModalCommonProps) => {
  const create = useLogisticaStore((s) => s.createRequest);
  const [requestedBy, setRequestedBy] = useState("PMA-Norte-01");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("ud");
  const [destination, setDestination] = useState("Pabellón Robledo");
  const [priority, setPriority] = useState<LogisticsRequestPriority>("high");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setItemName(""); setQuantity(1); setNotes("");
    }
  }, [isOpen]);

  const submit = () => {
    if (!itemName) return;
    create({
      emergencyId: "emg-001",
      requestedBy,
      category: "other",
      itemName,
      quantity,
      unit,
      priority,
      destination,
      notes,
    });
    onClose();
  };

  return (
    <TacticalModal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear solicitud logística"
      icon={MdLocalShipping}
      state="alert"
      size="md"
      footer={
        <HStack spacing={2}>
          <TacticalButton variant="tactical-ghost" onClick={onClose}>Cancelar</TacticalButton>
          <TacticalButton variant="tactical-warning" icon={MdCheckCircle} isDisabled={!itemName} onClick={submit}>
            Crear solicitud
          </TacticalButton>
        </HStack>
      }
    >
      <VStack align="stretch" spacing={3}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          <Box>
            <Label>Solicitante</Label>
            <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} size="sm" bg="white" borderColor="border.strong" />
          </Box>
          <Box>
            <Label>Destino</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} size="sm" bg="white" borderColor="border.strong" />
          </Box>
        </SimpleGrid>
        <Box>
          <Label>Item solicitado</Label>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} size="sm" bg="white" borderColor="border.strong" placeholder="Bombonas O₂, mantas térmicas, autobús..." />
        </Box>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
          <Box>
            <Label>Cantidad</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} size="sm" bg="white" borderColor="border.strong" />
          </Box>
          <Box>
            <Label>Unidad</Label>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} size="sm" bg="white" borderColor="border.strong">
              {["ud", "L", "kg", "pack"].map((u) => <option key={u}>{u}</option>)}
            </Select>
          </Box>
          <Box>
            <Label>Prioridad</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as LogisticsRequestPriority)} size="sm" bg="white" borderColor="border.strong">
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </Box>
        </SimpleGrid>
        <Box>
          <Label>Notas</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} bg="white" borderColor="border.strong" fontSize="sm" />
        </Box>
      </VStack>
    </TacticalModal>
  );
};
