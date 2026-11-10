import * as React from "react";

type ButtonColor = "primary" | "alt" | "red" | "gold" | "silver" | "bronze";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";
type IconPosition = "left" | "right";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ButtonColor;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
}

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

/*
 * primary = the one main action on a screen (accent fill).
 * alt     = everything else: solid is a quiet filled button, outline the default secondary.
 */
const COLOR_STYLES: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    solid: "border border-accent bg-accent text-on-accent hover:brightness-110",
    outline: "border border-accent bg-transparent text-accent hover:bg-accent/8",
    ghost: "border border-transparent bg-transparent text-accent hover:bg-accent/8",
  },
  alt: {
    solid: "border border-line bg-paper text-ink hover:border-muted/60 hover:bg-line/50",
    outline: "border border-line bg-surface text-ink hover:border-muted/60 hover:bg-paper",
    ghost: "border border-transparent bg-transparent text-ink hover:bg-ink/6",
  },
  red: {
    solid: "border border-red bg-red text-on-red hover:brightness-110",
    outline: "border border-line bg-surface text-red hover:border-red hover:bg-red/6",
    ghost: "border border-transparent bg-transparent text-red hover:bg-red/8",
  },
  gold: {
    solid: "border border-gold bg-gold text-on-gold hover:brightness-105",
    outline: "border border-gold bg-transparent text-ink hover:bg-gold/20",
    ghost: "border border-transparent bg-transparent text-ink hover:bg-gold/20",
  },
  silver: {
    solid: "border border-silver bg-silver text-on-silver hover:brightness-105",
    outline: "border border-silver bg-transparent text-ink hover:bg-silver/30",
    ghost: "border border-transparent bg-transparent text-ink hover:bg-silver/30",
  },
  bronze: {
    solid: "border border-bronze bg-bronze text-on-bronze hover:brightness-105",
    outline: "border border-bronze bg-transparent text-ink hover:bg-bronze/20",
    ghost: "border border-transparent bg-transparent text-ink hover:bg-bronze/20",
  },
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      color = "primary",
      variant = "solid",
      size = "md",
      icon,
      iconPosition = "left",
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const variantClass = COLOR_STYLES[color][variant];

    return (
      <button
        ref={ref}
        type={type}
        className={cn("btn", sizeClass[size], variantClass, className)}
        {...props}
      >
        {icon && iconPosition === "left" && (
          <span className="inline-flex items-center justify-center">{icon}</span>
        )}
        {children}
        {icon && iconPosition === "right" && (
          <span className="inline-flex items-center justify-center">{icon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

/** Same look as a solid primary `Button`, for `<a>` / `<label>` / `<Link>` elements. */
export const LINK_BUTTON_CLASS = `btn ${sizeClass.md} ${COLOR_STYLES.primary.solid}`;

/** Same look as an outline alt `Button`, for non-button elements. */
export const LINK_BUTTON_OUTLINE_CLASS = `btn ${sizeClass.md} ${COLOR_STYLES.alt.outline}`;
