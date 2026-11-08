// compact: smaller on phones (for the schedule page's header bar), full size
// from the `sm` breakpoint up.
export function BritestarLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`font-black tracking-tight text-brite-white ${compact ? "text-2xl sm:text-4xl" : "text-4xl"}`}
      >
        Brite<span className="text-brite-red-bright">star</span>
      </span>
      <span
        className={`font-semibold uppercase text-brite-tan/70 ${
          compact ? "text-[9px] tracking-[0.25em] sm:text-xs sm:tracking-[0.3em]" : "text-xs tracking-[0.3em]"
        }`}
      >
        Tavern Scheduler
      </span>
    </div>
  );
}
