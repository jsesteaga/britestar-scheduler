import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost";

// Extending ButtonHTMLAttributes means this component accepts every prop a
// normal <button> does (onClick, disabled, type, ...) PLUS our own `variant`.
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brite-red text-brite-white hover:bg-brite-red-bright",
  ghost:
    "bg-transparent text-brite-cream border border-brite-tan/40 hover:border-brite-tan",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`rounded-lg px-4 py-2.5 font-semibold tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
