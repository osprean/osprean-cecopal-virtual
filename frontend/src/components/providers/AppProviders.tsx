import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { ChakraTacticalProvider } from "./ChakraTacticalProvider";

interface Props {
  children: ReactNode;
}

export const AppProviders = ({ children }: Props) => {
  return (
    <ChakraTacticalProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </ChakraTacticalProvider>
  );
};
