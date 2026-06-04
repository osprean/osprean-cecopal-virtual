import { useState } from "react";
import { Flex } from "@chakra-ui/react";
import { useFakeRealtime } from "../../hooks";
import { GabineteHeader } from "./GabineteHeader";
import { GabineteGrid } from "./GabineteSections";
import type { Communique, TemplateCategory } from "../../types";

// GABINETE: institutional comms hub. NOT map-based.
// Layout (desktop): editor + history (left), templates + channels (right),
// quick-alert ES-Alert button spanning the top.
export const GabinetePage = () => {
  useFakeRealtime({ intervalMs: 9000 });
  const [loadedTemplate, setLoadedTemplate] = useState<TemplateCategory | null>(null);
  const [loadedDraft, setLoadedDraft] = useState<Communique | null>(null);

  // Cada click sobre "Cargar en editor" pasa un nuevo objeto (spread) para
  // garantizar que el useEffect del editor re-aplique los campos aunque sea
  // el mismo comunicado.
  const handleLoadCommunique = (c: Communique) => {
    setLoadedDraft({ ...c });
  };

  return (
    <Flex direction="column" h="100%" w="100%" minH={0} bg="bg.base" overflow="hidden">
      <GabineteHeader />
      <GabineteGrid
        loadedTemplate={loadedTemplate}
        loadedDraft={loadedDraft}
        onLoadTemplate={setLoadedTemplate}
        onLoadCommunique={handleLoadCommunique}
      />
    </Flex>
  );
};
