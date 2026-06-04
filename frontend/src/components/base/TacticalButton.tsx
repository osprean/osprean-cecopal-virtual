import { Button, type ButtonProps, forwardRef } from "@chakra-ui/react";
import type { IconType } from "react-icons";

type TacticalVariant =
  | "tactical"
  | "tactical-primary"
  | "tactical-danger"
  | "tactical-warning"
  | "tactical-ghost"
  | "tactical-outline";

interface TacticalButtonProps extends Omit<ButtonProps, "variant" | "leftIcon" | "rightIcon"> {
  variant?: TacticalVariant;
  icon?: IconType;
  iconRight?: IconType;
  uppercase?: boolean;
}

// Wraps Chakra Button with tactical defaults: uppercase, large hit targets,
// and react-icons support to match COMACON's leftIcon usage pattern.
export const TacticalButton = forwardRef<TacticalButtonProps, "button">(
  (
    {
      variant = "tactical",
      icon: LeftIcon,
      iconRight: RightIcon,
      uppercase = true,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        leftIcon={LeftIcon ? <LeftIcon size="14px" /> : undefined}
        rightIcon={RightIcon ? <RightIcon size="14px" /> : undefined}
        textTransform={uppercase ? "uppercase" : "none"}
        {...rest}
      >
        {children}
      </Button>
    );
  },
);
