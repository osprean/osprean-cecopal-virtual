import { extendTheme, type ThemeConfig } from "@chakra-ui/react";
import { tacticalColors } from "./colors";
import {
  tacticalFonts,
  tacticalFontSizes,
  tacticalFontWeights,
  tacticalLetterSpacings,
} from "./typography";
import {
  Badge,
  Button,
  Checkbox,
  Heading,
  Input,
  Menu,
  Modal,
  Radio,
  Select,
  Tabs,
  Textarea,
  Tooltip,
} from "./components";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const sem = (value: string) => ({ default: value, _light: value, _dark: value });

// Breakpoints calibrados para PMA/CECOPS: móviles de campo (≥360),
// tablets en portrait y landscape, portátiles de coordinación, sobremesa y
// pantallas de sala de operaciones grandes.
const breakpoints = {
  base: "0em",
  sm: "30em", // 480px — móvil grande
  md: "48em", // 768px — tablet portrait
  lg: "64em", // 1024px — tablet landscape / laptop pequeño
  xl: "80em", // 1280px — laptop / desktop
  "2xl": "96em", // 1536px — desktop grande / 4K
};

const tacticalTheme = extendTheme({
  config,
  breakpoints,
  fonts: tacticalFonts,
  fontSizes: tacticalFontSizes,
  fontWeights: tacticalFontWeights,
  letterSpacings: tacticalLetterSpacings,
  semanticTokens: {
    colors: {
      "bg.abyss": sem(tacticalColors.bg.abyss),
      "bg.base": sem(tacticalColors.bg.base),
      "bg.panel": sem(tacticalColors.bg.panel),
      "bg.panelRaised": sem(tacticalColors.bg.panelRaised),
      "bg.panelSubtle": sem(tacticalColors.bg.panelSubtle),
      "bg.overlay": sem(tacticalColors.bg.overlay),
      "bg.glass": sem(tacticalColors.bg.glass),
      "border.subtle": sem(tacticalColors.border.subtle),
      "border.strong": sem(tacticalColors.border.strong),
      "border.accent": sem(tacticalColors.border.accent),
      "text.primary": sem(tacticalColors.text.primary),
      "text.secondary": sem(tacticalColors.text.secondary),
      "text.muted": sem(tacticalColors.text.muted),
      "text.label": sem(tacticalColors.text.label),
      "text.inverted": sem(tacticalColors.text.inverted),
      "accent.teal": sem(tacticalColors.accent.teal),
      "accent.tealDeep": sem(tacticalColors.accent.tealDeep),
      "accent.tealSoft": sem(tacticalColors.accent.tealSoft),
      "state.critical": sem(tacticalColors.state.critical),
      "state.criticalSoft": sem(tacticalColors.state.criticalSoft),
      "state.alert": sem(tacticalColors.state.alert),
      "state.alertSoft": sem(tacticalColors.state.alertSoft),
      "state.pending": sem(tacticalColors.state.pending),
      "state.pendingSoft": sem(tacticalColors.state.pendingSoft),
      "state.operational": sem(tacticalColors.state.operational),
      "state.operationalSoft": sem(tacticalColors.state.operationalSoft),
      "state.active": sem(tacticalColors.state.active),
      "state.activeSoft": sem(tacticalColors.state.activeSoft),
      "state.standby": sem(tacticalColors.state.standby),
      "state.standbySoft": sem(tacticalColors.state.standbySoft),
      "state.offline": sem(tacticalColors.state.offline),
      "state.offlineSoft": sem(tacticalColors.state.offlineSoft),
      "domain.fire": sem(tacticalColors.domain.fire),
      "domain.flood": sem(tacticalColors.domain.flood),
      "domain.medical": sem(tacticalColors.domain.medical),
      "domain.seismic": sem(tacticalColors.domain.seismic),
      "domain.chemical": sem(tacticalColors.domain.chemical),
      "domain.security": sem(tacticalColors.domain.security),
    },
  },
  styles: {
    global: {
      "html, body, #root": {
        height: "100%",
        margin: 0,
        padding: 0,
        background: tacticalColors.bg.base,
        color: tacticalColors.text.primary,
        overflow: "hidden",
      },
      "*::selection": {
        background: tacticalColors.accent.tealSoft,
        color: tacticalColors.accent.tealDeep,
      },
      "*::-webkit-scrollbar": { width: "8px", height: "8px" },
      "*::-webkit-scrollbar-track": { background: "transparent" },
      "*::-webkit-scrollbar-thumb": {
        background: tacticalColors.border.strong,
        borderRadius: "4px",
      },
      "*::-webkit-scrollbar-thumb:hover": {
        background: tacticalColors.border.accent,
      },
      "@keyframes tactical-pulse": {
        "0%, 100%": { opacity: 1, transform: "scale(1)" },
        "50%": { opacity: 0.55, transform: "scale(1.08)" },
      },
      "@keyframes tactical-blink": {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.25 },
      },
    },
  },
  components: {
    Button,
    Modal,
    Tabs,
    Input,
    Select,
    Textarea,
    Radio,
    Checkbox,
    Badge,
    Heading,
    Menu,
    Tooltip,
  },
});

export default tacticalTheme;
export { tacticalColors } from "./colors";
