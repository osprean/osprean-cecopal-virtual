import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import type { ReactNode } from "react";
import tacticalTheme from "../../theme";

interface Props {
  children: ReactNode;
}

export const ChakraTacticalProvider = ({ children }: Props) => {
  return (
    <>
      <ColorModeScript initialColorMode={tacticalTheme.config.initialColorMode} />
      <ChakraProvider theme={tacticalTheme}>{children}</ChakraProvider>
    </>
  );
};
