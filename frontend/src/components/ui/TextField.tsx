import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextField({ label, id, className = "", ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-lg border border-brite-tan/30 bg-brite-black-soft px-3 py-2.5 text-brite-white outline-none placeholder:text-brite-tan/40 focus:border-brite-red ${className}`}
        {...rest}
      />
    </div>
  );
}
