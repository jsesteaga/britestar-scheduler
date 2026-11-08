import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "ghost";
type ButtonSize = "md" | "sm";

// Extending ButtonHTMLAttributes means this component accepts every prop a
// normal <button> does (onClick, disabled, type, ...) PLUS our own `variant`.
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  // sm: the compact toolbar size (e.g. "Manage bartenders" above the week).
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brite-red text-brite-white hover:bg-brite-red-bright",
  ghost:
    "bg-transparent text-brite-cream border border-brite-tan/40 hover:border-brite-tan",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "rounded-lg px-4 py-2.5 tracking-wide",
  sm: "rounded-lg px-3 py-1.5 text-xs sm:text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Two versions of a label: the short one on phones, the full one from `sm` up. */
export function ShortLabel({ short, long }: { short: string; long: string }) {
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
}
