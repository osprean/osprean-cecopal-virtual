import { useEffect, type ReactNode } from "react";
import { Box, Flex, useBreakpointValue } from "@chakra-ui/react";
import { TopNav } from "./TopNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { TimelineDrawer } from "../components/TimelineDrawer";
import { OpsAIDrawer } from "../features/ai-ops";
import { useAiOpsStore } from "../features/ai-ops/aiOpsStore";
import { useTimelineStore } from "../components/timelineStore";
import { useMapViewStore } from "../store";

interface TacticalLayoutProps {
  children: ReactNode;
}

// Pide la ubicación al navegador una sola vez al cargar la app. Si el usuario
// no concede permiso, simplemente no hay marker — el mapa usa su default.
const useGeolocateOnce = () => {
  const setUserLocation = useMapViewStore((s) => s.setUserLocation);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // permiso denegado o no disponible: silencioso
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
    return () => {
      cancelled = true;
    };
  }, [setUserLocation]);
};

export const TacticalLayout = ({ children }: TacticalLayoutProps) => {
  useGeolocateOnce();
  const timelineOpen = useTimelineStore((s) => s.open);
  const aiOpen = useAiOpsStore((s) => s.open);
  const anyDrawerOpen = timelineOpen || aiOpen;
  // En móvil/tablet portrait los drawers se renderizan como overlay
  // full-screen por encima del contenido; desde lg (tablet landscape/laptop)
  // empujan el layout como hasta ahora.
  const isCompact = useBreakpointValue(
    { base: true, lg: false },
    { fallback: "lg" },
  );
  // La barra de tabs inferior solo aparece en móvil.
  const showBottomNav = useBreakpointValue(
    { base: true, md: false },
    { fallback: "base" },
  );

  return (
    <Flex direction="column" h="100dvh" w="100vw" bg="bg.base" overflow="hidden">
      <TopNav />
      <Flex flex="1" minH={0} overflow="hidden" position="relative">
        <Box
          as="main"
          flex="1"
          minW={0}
          position="relative"
          overflow="hidden"
          bg="white"
          borderTopRightRadius={!isCompact && anyDrawerOpen ? "2xl" : 0}
          borderBottomRightRadius={!isCompact && anyDrawerOpen ? "2xl" : 0}
          transition="border-radius 0.25s ease"
        >
          {children}
        </Box>
        {/* Backdrop para móvil cuando hay drawer abierto. zIndex 1100 para
            quedar por encima del mapa Leaflet (cuyos controls llegan a 1000). */}
        {isCompact && anyDrawerOpen && (
          <Box
            position="absolute"
            inset={0}
            bg="rgba(15,22,36,0.45)"
            zIndex={1100}
            backdropFilter="blur(2px)"
            onClick={() => {
              if (aiOpen) useAiOpsStore.getState().setOpen(false);
              else if (timelineOpen) useTimelineStore.getState().setOpen(false);
            }}
            aria-hidden
          />
        )}
        <TimelineDrawer />
        <OpsAIDrawer />
      </Flex>
      {showBottomNav && <MobileBottomNav />}
    </Flex>
  );
};
