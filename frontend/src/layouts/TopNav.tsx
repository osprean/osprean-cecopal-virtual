import { Box, Divider, Flex, HStack, Icon, Text, Tooltip, useBreakpointValue } from "@chakra-ui/react";
import { useLayoutEffect, useRef, useState } from "react";
import { MdHistory } from "react-icons/md";
import type { IconType } from "react-icons";
import {
  MdGavel,
  MdShield,
  MdMedicalServices,
  MdInventory2,
  MdCampaign,
  MdPersonPin,
} from "react-icons/md";
import { useTabsStore } from "../store";
import type { TabKey } from "../types";
import { OspreanLogo } from "../components/OspreanLogo";
import { OpsAIButton } from "../features/ai-ops";
import { useTimelineStore } from "../components/timelineStore";

const TAB_ICONS: Record<TabKey, IconType> = {
  direccion: MdGavel,
  seguridad: MdShield,
  sanitario: MdMedicalServices,
  logistica: MdInventory2,
  gabinete: MdCampaign,
  campo: MdPersonPin,
};

export const TopNav = () => {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTab = useTabsStore((s) => s.activeTab);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const timelineOpen = useTimelineStore((s) => s.open);
  const setTimelineOpen = useTimelineStore((s) => s.setOpen);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pathD, setPathD] = useState("");
  const [vb, setVb] = useState({ w: 0, h: 0 });
  // En móvil las tabs se muestran en MobileBottomNav, aquí solo logo + acciones.
  const showInlineTabs = useBreakpointValue(
    { base: false, md: true },
    { fallback: "md" },
  );
  const showTabLabels = useBreakpointValue(
    { base: false, xl: true },
    { fallback: "xl" },
  );
  // El "Historial" en móvil compacta a solo icono.
  const showHistoryLabel = useBreakpointValue(
    { base: false, md: true },
    { fallback: "md" },
  );

  useLayoutEffect(() => {
    if (!showInlineTabs) return;
    const compute = () => {
      const c = containerRef.current;
      if (!c) return;
      const cBox = c.getBoundingClientRect();
      const w = cBox.width;
      const h = cBox.height;
      const pad = 4;
      const yTop = pad;
      const yBottom = h - pad;
      const rects = tabRefs.current
        .filter((el): el is HTMLDivElement => Boolean(el))
        .map((el) => el.getBoundingClientRect());
      if (!rects.length) return;
      let d = "";
      rects.forEach((r, i) => {
        const x1 = r.left - cBox.left;
        const x2 = r.right - cBox.left;
        const y = i % 2 === 0 ? yBottom : yTop;
        if (i === 0) {
          d += `M ${x1} ${y} `;
        } else {
          const prevR = rects[i - 1];
          const prevY = (i - 1) % 2 === 0 ? yBottom : yTop;
          const prevX = prevR.right - cBox.left;
          const midX = (prevX + x1) / 2;
          d += `C ${midX} ${prevY}, ${midX} ${y}, ${x1} ${y} `;
        }
        d += `L ${x2} ${y} `;
      });
      setPathD(d);
      setVb({ w, h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", compute);
    const t = window.setTimeout(compute, 120);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
      window.clearTimeout(t);
    };
  }, [tabs, activeTab, showInlineTabs]);

  return (
    <Flex
      as="header"
      align="center"
      h={{ base: "56px", md: "68px", lg: "76px" }}
      px={{ base: 3, md: 4, lg: 5 }}
      bg="white"
      borderBottom="1px solid"
      borderColor="border.subtle"
      flexShrink={0}
      gap={{ base: 2, md: 3, lg: 4 }}
      position="relative"
    >
      {/* Brand */}
      <HStack spacing={3} flexShrink={0} minW={{ base: "auto", lg: "180px" }}>
        <OspreanLogo showText={false} size={{ base: 40, md: 52, lg: 70 }} />
      </HStack>

      <Box flex="1" minW={0} />

      {/* Cluster central de tabs — solo desde md hacia arriba (en móvil hay BottomNav). */}
      {showInlineTabs && (
        <Box
          ref={containerRef}
          position="relative"
          flexShrink={0}
          px={2}
          py={3}
          // En tablet permitimos overflow horizontal de las tabs si no caben.
          maxW={{ md: "calc(100vw - 320px)", lg: "none" }}
          overflowX={{ md: "auto", xl: "visible" }}
          sx={{
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {/* Snaking SVG line */}
          {vb.w > 0 && (
            <Box
              as="svg"
              position="absolute"
              inset={0}
              width="100%"
              height="100%"
              pointerEvents="none"
              viewBox={`0 0 ${vb.w} ${vb.h}`}
              preserveAspectRatio="none"
              overflow="visible"
            >
              <defs>
                <linearGradient id="snake-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#CBD5E0" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#319795" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#CBD5E0" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path
                d={pathD}
                fill="none"
                stroke="url(#snake-gradient)"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </Box>
          )}

          <HStack spacing={{ base: 2, md: 4, lg: 6, xl: 7 }} align="center" position="relative">
            {tabs.map((tab, i) => {
              const isActive = tab.key === activeTab;
              const IconComp = TAB_ICONS[tab.key];
              const tabContent = (
                <Box
                  key={tab.key}
                  ref={(el: HTMLDivElement | null) => {
                    tabRefs.current[i] = el;
                  }}
                  as="button"
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={tab.label}
                  position="relative"
                  px={{ base: 2.5, xl: 3.5 }}
                  py={2}
                  display="flex"
                  alignItems="center"
                  gap={{ base: 0, xl: 2 }}
                  borderRadius={{ base: "lg", xl: "xl" }}
                  color={isActive ? "accent.tealDeep" : "text.muted"}
                  bg={isActive ? "white" : "transparent"}
                  border="1px solid"
                  borderColor={isActive ? "border.subtle" : "transparent"}
                  boxShadow={
                    isActive
                      ? "0 14px 28px -14px rgba(15,22,36,0.22), 0 6px 12px -6px rgba(15,22,36,0.12), 0 1px 0 rgba(255,255,255,1) inset, 0 -1px 0 rgba(15,22,36,0.04) inset"
                      : "none"
                  }
                  transform={isActive ? "translateY(-2px)" : "none"}
                  transition="transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, color 0.2s ease, background 0.2s ease"
                  _hover={
                    isActive
                      ? {}
                      : {
                          color: "text.primary",
                          transform: "translateY(-2px)",
                          bg: "rgba(255,255,255,0.85)",
                          boxShadow:
                            "0 10px 22px -12px rgba(15,22,36,0.18), 0 3px 6px -3px rgba(15,22,36,0.08), 0 1px 0 rgba(255,255,255,1) inset",
                        }
                  }
                  _active={{
                    transform: "translateY(0)",
                    boxShadow:
                      "0 2px 6px -2px rgba(15,22,36,0.18), 0 1px 0 rgba(255,255,255,0.8) inset",
                  }}
                  _focusVisible={{
                    outline: "none",
                    boxShadow: "0 0 0 3px rgba(49,151,149,0.35)",
                  }}
                >
                  {IconComp && <Icon as={IconComp} boxSize={{ base: 5, xl: 4 }} opacity={isActive ? 1 : 0.75} />}
                  <Text
                    display={{ base: "none", xl: "inline" }}
                    fontSize="11.5px"
                    fontWeight={isActive ? 800 : 600}
                    letterSpacing="0.14em"
                    textTransform="uppercase"
                    color="inherit"
                  >
                    {tab.label}
                  </Text>
                </Box>
              );
              return showTabLabels ? (
                tabContent
              ) : (
                <Tooltip key={tab.key} label={tab.label} placement="bottom" hasArrow openDelay={200}>
                  {tabContent}
                </Tooltip>
              );
            })}
          </HStack>
        </Box>
      )}

      <Box flex="1" minW={0} />

      <Divider
        orientation="vertical"
        h="32px"
        alignSelf="center"
        borderColor="border.subtle"
        display={{ base: "none", md: "block" }}
      />

      {/* Acciones globales */}
      <HStack spacing={2} alignSelf="center">
        <Tooltip label={timelineOpen ? "Cerrar historial" : "Historial global"} placement="bottom" hasArrow>
          <Box
            as="button"
            onClick={() => setTimelineOpen(!timelineOpen)}
            px={{ base: 2, md: 3 }}
            py={1.5}
            borderRadius="lg"
            border="1px solid"
            borderColor="border.subtle"
            bg="bg.panelSubtle"
            color="text.secondary"
            display="flex"
            alignItems="center"
            gap={2}
            transition="all 0.12s ease"
            _hover={{ bg: "white", borderColor: "accent.teal", color: "accent.teal" }}
            _focusVisible={{ outline: "none", boxShadow: "0 0 0 3px rgba(49,151,149,0.3)" }}
            aria-label="Historial"
          >
            <Icon as={MdHistory} boxSize={{ base: 5, md: 4 }} />
            {showHistoryLabel && (
              <Text fontSize="11px" fontWeight={800} letterSpacing="widest" textTransform="uppercase">
                Historial
              </Text>
            )}
          </Box>
        </Tooltip>
        <OpsAIButton />
      </HStack>
    </Flex>
  );
};
