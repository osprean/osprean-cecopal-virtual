import { Box, type BoxProps } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

const MotionDiv = motion.div;

type Placement = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

interface TacticalOverlayProps extends Omit<BoxProps, "position"> {
  open: boolean;
  placement?: Placement;
  width?: string | number;
  children: ReactNode;
}

const PLACEMENT_STYLES: Record<Placement, BoxProps> = {
  "top-left": { top: 3, left: 3 },
  "top-right": { top: 3, right: 3 },
  "bottom-left": { bottom: 3, left: 3 },
  "bottom-right": { bottom: 3, right: 3 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

export const TacticalOverlay = ({
  open,
  placement = "top-right",
  width = 320,
  children,
  ...rest
}: TacticalOverlayProps) => {
  return (
    <AnimatePresence>
      {open && (
        <Box
          as={MotionDiv}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          position="absolute"
          // zIndex 1000 para superar los panes y controls de Leaflet (≤1000).
          zIndex={1000}
          width={width}
          bg="bg.glass"
          backdropFilter="blur(10px)"
          border="1px solid"
          borderColor="border.strong"
          borderRadius="2px"
          boxShadow="0 12px 40px rgba(0,0,0,0.55)"
          {...PLACEMENT_STYLES[placement]}
          {...rest}
        >
          {children}
        </Box>
      )}
    </AnimatePresence>
  );
};
