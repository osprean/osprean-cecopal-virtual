import { HStack, Image, Text, useBreakpointValue, type ResponsiveValue } from "@chakra-ui/react";

const LOGO_ASPECT_RATIO = 472.7 / 171.4;

interface OspreanLogoProps {
  showText?: boolean;
  size?: ResponsiveValue<number>;
}

export const OspreanLogo = ({ showText = true, size = 28 }: OspreanLogoProps) => {
  const resolved = useBreakpointValue<number>(
    typeof size === "number" ? { base: size } : (size as Record<string, number>),
    { fallback: "base" },
  );
  const finalSize = resolved ?? (typeof size === "number" ? size : 28);
  return (
    <HStack spacing={2.5} flexShrink={0}>
      <Image
        src="/logo_osprean_primary_RGB.svg"
        alt="Osprean"
        height={`${finalSize}px`}
        width={`${finalSize * LOGO_ASPECT_RATIO}px`}
        objectFit="contain"
      />
      {showText && (
        <Text
          fontFamily="'Osprean', 'Inter', sans-serif"
          fontSize="17px"
          fontWeight={600}
          color="text.primary"
          letterSpacing="0.04em"
          lineHeight="1"
        >
          OSPREAN
        </Text>
      )}
    </HStack>
  );
};
