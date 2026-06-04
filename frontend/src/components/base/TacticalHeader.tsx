import { Flex, HStack, Icon, Text, type FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";

interface TacticalHeaderProps extends Omit<FlexProps, "title"> {
  icon?: IconType;
  iconColor?: string;
  label: string;          // tiny ALL CAPS widest label (COMACON style)
  subLabel?: string;      // optional secondary mono label
  actions?: ReactNode;
  divider?: boolean;
}

// COMACON pattern:
// <Icon /> <Text fontSize="10px" fontWeight="black" letterSpacing="widest">LABEL</Text>
export const TacticalHeader = ({
  icon,
  iconColor = "accent.teal",
  label,
  subLabel,
  actions,
  divider = false,
  ...rest
}: TacticalHeaderProps) => {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap={3}
      py={divider ? 2 : 0}
      borderBottom={divider ? "1px solid" : undefined}
      borderColor={divider ? "border.subtle" : undefined}
      {...rest}
    >
      <HStack spacing={2} minW={0}>
        {icon && <Icon as={icon} color={iconColor} boxSize={3.5} flexShrink={0} />}
        <Text
          fontSize="10px"
          fontWeight={900}
          color="text.label"
          letterSpacing="widest"
          textTransform="uppercase"
          noOfLines={1}
        >
          {label}
        </Text>
        {subLabel && (
          <Text
            fontSize="10px"
            fontFamily="mono"
            color="text.muted"
            letterSpacing="wide"
            flexShrink={0}
          >
            {subLabel}
          </Text>
        )}
      </HStack>
      {actions && <HStack spacing={1.5}>{actions}</HStack>}
    </Flex>
  );
};
