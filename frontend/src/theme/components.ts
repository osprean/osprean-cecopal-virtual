import type { ComponentStyleConfig } from "@chakra-ui/react";

// COMACON pattern: rounded buttons (lg/2xl), bold weight, leftIcon. White surfaces.
export const Button: ComponentStyleConfig = {
  baseStyle: {
    fontWeight: 700,
    letterSpacing: "wide",
    borderRadius: "lg",
    transition: "all 0.15s ease",
    _focusVisible: {
      boxShadow: "0 0 0 3px rgba(49, 151, 149, 0.4)",
    },
  },
  sizes: {
    xs: { h: "26px", px: 3, fontSize: "10px", letterSpacing: "wider" },
    sm: { h: "32px", px: 4, fontSize: "xs" },
    md: { h: "40px", px: 5, fontSize: "sm" },
    lg: { h: "48px", px: 6, fontSize: "md" },
  },
  variants: {
    tactical: {
      bg: "white",
      color: "text.primary",
      border: "1px solid",
      borderColor: "border.strong",
      _hover: {
        bg: "bg.panelSubtle",
        borderColor: "accent.teal",
        color: "accent.teal",
      },
      _active: { bg: "border.subtle" },
      _disabled: { opacity: 0.45, cursor: "not-allowed" },
    },
    "tactical-primary": {
      bg: "accent.teal",
      color: "white",
      _hover: { bg: "accent.tealDeep" },
      _active: { bg: "accent.tealDeep" },
    },
    "tactical-danger": {
      bg: "state.critical",
      color: "white",
      _hover: { bg: "#C53030" },
      _active: { bg: "#9B2C2C" },
    },
    "tactical-warning": {
      bg: "state.alert",
      color: "white",
      _hover: { bg: "#C05621" },
    },
    "tactical-ghost": {
      bg: "transparent",
      color: "text.secondary",
      _hover: { bg: "bg.panelSubtle", color: "text.primary" },
    },
    "tactical-outline": {
      bg: "transparent",
      color: "text.primary",
      border: "1px solid",
      borderColor: "border.strong",
      _hover: { bg: "bg.panelSubtle", borderColor: "accent.teal" },
    },
  },
  defaultProps: { variant: "tactical", size: "md" },
};

export const Modal: ComponentStyleConfig = {
  baseStyle: {
    overlay: {
      bg: "bg.overlay",
      backdropFilter: "blur(4px)",
    },
    dialog: {
      bg: "white",
      border: "1px solid",
      borderColor: "border.subtle",
      borderRadius: "2xl",
      color: "text.primary",
      boxShadow: "0 20px 60px rgba(15, 22, 36, 0.18)",
      overflow: "hidden",
    },
    header: {
      borderBottom: "1px solid",
      borderColor: "border.subtle",
      bg: "bg.panelSubtle",
      fontFamily: "heading",
      fontSize: "sm",
      letterSpacing: "wider",
      textTransform: "uppercase",
      color: "text.primary",
      fontWeight: 800,
      py: 4,
      px: 5,
    },
    body: { p: 5, fontSize: "sm" },
    footer: {
      borderTop: "1px solid",
      borderColor: "border.subtle",
      bg: "bg.panelSubtle",
      py: 3,
      px: 5,
    },
    closeButton: {
      color: "text.secondary",
      _hover: { color: "state.critical", bg: "transparent" },
    },
  },
};

export const Tabs: ComponentStyleConfig = {
  variants: {
    tactical: {
      tablist: {
        bg: "white",
        borderBottom: "1px solid",
        borderColor: "border.subtle",
      },
      tab: {
        color: "text.secondary",
        fontSize: "xs",
        letterSpacing: "wider",
        textTransform: "uppercase",
        fontWeight: 700,
        px: 4,
        py: 3,
        borderBottom: "2px solid transparent",
        _hover: { color: "text.primary", bg: "bg.panelSubtle" },
        _selected: {
          color: "accent.teal",
          borderColor: "accent.teal",
          bg: "bg.panelSubtle",
        },
      },
    },
  },
  defaultProps: { variant: "tactical" },
};

export const Input: ComponentStyleConfig = {
  variants: {
    tactical: {
      field: {
        bg: "white",
        border: "1px solid",
        borderColor: "border.strong",
        color: "text.primary",
        borderRadius: "lg",
        fontSize: "sm",
        _placeholder: { color: "text.muted" },
        _hover: { borderColor: "border.accent" },
        _focus: {
          borderColor: "accent.teal",
          boxShadow: "0 0 0 1px var(--chakra-colors-accent-teal)",
        },
      },
    },
  },
  defaultProps: { variant: "tactical" },
};

// Select: same look & feel as tactical Input, with a visible chevron.
export const Select: ComponentStyleConfig = {
  variants: {
    tactical: {
      field: {
        bg: "white",
        border: "1px solid",
        borderColor: "border.strong",
        color: "text.primary",
        borderRadius: "lg",
        fontSize: "sm",
        _hover: { borderColor: "border.accent" },
        _focus: {
          borderColor: "accent.teal",
          boxShadow: "0 0 0 1px var(--chakra-colors-accent-teal)",
        },
      },
      icon: {
        color: "text.secondary",
      },
    },
  },
  defaultProps: { variant: "tactical" },
};

export const Textarea: ComponentStyleConfig = {
  variants: {
    tactical: {
      bg: "white",
      border: "1px solid",
      borderColor: "border.strong",
      color: "text.primary",
      borderRadius: "lg",
      fontSize: "sm",
      _placeholder: { color: "text.muted" },
      _hover: { borderColor: "border.accent" },
      _focus: {
        borderColor: "accent.teal",
        boxShadow: "0 0 0 1px var(--chakra-colors-accent-teal)",
      },
    },
  },
  defaultProps: { variant: "tactical" },
};

// Radio: ensure the unchecked control is clearly visible against white modal
// surfaces (default Chakra renders a near-white circle on white).
export const Radio: ComponentStyleConfig = {
  baseStyle: {
    control: {
      bg: "white",
      borderColor: "border.accent",
      borderWidth: "2px",
      _hover: { borderColor: "accent.teal" },
      _checked: {
        bg: "accent.teal",
        borderColor: "accent.teal",
        color: "white",
        _hover: { bg: "accent.tealDeep", borderColor: "accent.tealDeep" },
      },
      _focusVisible: {
        boxShadow: "0 0 0 3px rgba(49, 151, 149, 0.35)",
      },
    },
    label: { color: "text.primary" },
  },
  defaultProps: { colorScheme: "teal" },
};

// Checkbox: same treatment as Radio so the unchecked box has a visible border.
export const Checkbox: ComponentStyleConfig = {
  baseStyle: {
    control: {
      bg: "white",
      borderColor: "border.accent",
      borderWidth: "2px",
      _hover: { borderColor: "accent.teal" },
      _checked: {
        bg: "accent.teal",
        borderColor: "accent.teal",
        color: "white",
        _hover: { bg: "accent.tealDeep", borderColor: "accent.tealDeep" },
      },
      _focusVisible: {
        boxShadow: "0 0 0 3px rgba(49, 151, 149, 0.35)",
      },
    },
    label: { color: "text.primary" },
  },
  defaultProps: { colorScheme: "teal" },
};


export const Badge: ComponentStyleConfig = {
  baseStyle: {
    textTransform: "uppercase",
    letterSpacing: "wider",
    fontSize: "9px",
    fontWeight: 800,
    px: 2,
    py: "2px",
    borderRadius: "md",
  },
};

export const Heading: ComponentStyleConfig = {
  baseStyle: {
    fontFamily: "heading",
    color: "text.primary",
    letterSpacing: "tight",
  },
};

export const Menu: ComponentStyleConfig = {
  baseStyle: {
    list: {
      bg: "white",
      border: "1px solid",
      borderColor: "border.subtle",
      borderRadius: "xl",
      boxShadow: "0 12px 40px rgba(15, 22, 36, 0.18)",
      py: 1,
    },
    item: {
      bg: "transparent",
      color: "text.primary",
      fontSize: "sm",
      _hover: { bg: "bg.panelSubtle" },
      _focus: { bg: "bg.panelSubtle" },
    },
  },
};

export const Tooltip: ComponentStyleConfig = {
  baseStyle: {
    bg: "text.primary",
    color: "white",
    border: "none",
    borderRadius: "md",
    fontSize: "xs",
    fontWeight: 600,
    px: 2.5,
    py: 1.5,
  },
};
