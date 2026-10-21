type AvatarProps = {
  name: string;
  color: string;
  imageUrl?: string;
  size?: "sm" | "md";
};

function initialsFor(name: string): string {
  // Skip words that don't start with a letter/number, so "Taylor (closer)"
  // gives "T", not "T(".
  return name
    .split(" ")
    .filter((part) => /^[\p{L}\p{N}]/u.test(part))
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ name, color, imageUrl, size = "md" }: AvatarProps) {
  const sizeClasses = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} flex shrink-0 items-center justify-center rounded-full font-bold text-brite-white`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initialsFor(name)}
    </div>
  );
}
