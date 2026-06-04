import { Box, HStack, Icon, IconButton, type BoxProps } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import type { OperationalState } from "../../types";
import { TacticalHeader } from "./TacticalHeader";
import { STATE_VISUAL } from "./stateConfig";

interface TacticalPanelProps extends Omit<BoxProps, "title"> {
  title?: string;            // tiny ALL CAPS label
  code?: string;             // mono code shown next to label
  icon?: IconType;           // custom header icon
  state?: OperationalState;  // drives header icon + accent if no custom icon
  actions?: ReactNode;
  dense?: boolean;           // tighter padding for sidebars
  bodyBg?: string;
  noPadding?: boolean;       // for embedding maps / tables
  collapsible?: boolean;     // adds a chevron toggle + clickable header
  defaultOpen?: boolean;     // initial collapsed state when uncontrolled
  open?: boolean;            // controlled open state
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export const TacticalPanel = ({
  title,
  code,
  icon,
  state,
  actions,
  dense = false,
  bodyBg,
  noPadding = false,
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  ...rest
}: TacticalPanelProps) => {
  const stateCfg = state ? STATE_VISUAL[state] : null;
  const headerIcon = icon ?? stateCfg?.icon;
  const iconColor = stateCfg?.fg ?? "accent.teal";

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const collapsedActions = collapsible ? (
    <HStack spacing={1.5}>
      {actions}
      <IconButton
        aria-label={isOpen ? "Contraer" : "Expandir"}
        size="xs"
        variant="ghost"
        icon={<Icon as={isOpen ? MdExpandLess : MdExpandMore} boxSize={4} />}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      />
    </HStack>
  ) : (
    actions
  );

  return (
    <Box
      bg="bg.panel"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="xl"
      boxShadow="0 1px 3px rgba(15,22,36,0.06)"
      display="flex"
      flexDirection="column"
      minH={0}
      overflow="hidden"
      {...rest}
    >
      {(title || actions || collapsible) && (
        <Box
          px={dense ? 2.5 : 3}
          py={dense ? 1 : 1.5}
          borderBottom={isOpen ? "1px solid" : undefined}
          borderColor="border.subtle"
          bg="bg.panelSubtle"
          flexShrink={0}
          onClick={collapsible ? toggle : undefined}
          cursor={collapsible ? "pointer" : undefined}
          _hover={collapsible ? { bg: "bg.panel" } : undefined}
        >
          <TacticalHeader
            icon={headerIcon}
            iconColor={iconColor}
            label={title ?? ""}
            subLabel={code}
            actions={collapsedActions}
          />
        </Box>
      )}
      {isOpen && (
        <Box
          flex="1"
          minH={0}
          p={noPadding ? 0 : dense ? 2 : 2.5}
          bg={bodyBg ?? "transparent"}
          overflow="auto"
        >
          {children}
        </Box>
      )}
    </Box>
  );
};
