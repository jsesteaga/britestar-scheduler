import { useState, type ReactNode } from "react";

export type StackItem = { key: string; node: ReactNode };

type CardStackProps = {
  title: string;
  // Already sorted — the first item is the one shown on top of the stack.
  items: StackItem[];
  emptyText?: string;
};

/**
 * A pile of cards: the first one sits on top, and the rest peek out
 * underneath as two thinner "ghost" edges. "View all" unfolds the pile into
 * a list (the grid-rows 0fr → 1fr trick animates its height smoothly without
 * having to measure it).
 */
export function CardStack({ title, items, emptyText }: CardStackProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return emptyText ? (
      <section className="mb-6">
        <StackHeader title={title} count={0} />
        <p className="rounded-xl border border-dashed border-brite-tan/15 px-4 py-3 text-xs italic text-brite-tan/40">
          {emptyText}
        </p>
      </section>
    ) : null;
  }

  const [first, ...rest] = items;
  const peek = open ? 0 : Math.min(rest.length, 2);

  return (
    <section className="mb-6">
      <StackHeader title={title} count={items.length}>
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-full border border-brite-tan/15 bg-brite-black-soft/50 px-3 py-1 text-xs font-semibold text-brite-tan/70 transition-colors hover:border-brite-tan/40 hover:text-brite-cream"
          >
            {open ? "Show less" : `View all ${items.length}`}
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </StackHeader>

      {/* Top card, with the ghost edges of the cards beneath it. */}
      <div
        className="group relative transition-[margin] duration-300"
        style={{ marginBottom: peek === 2 ? 20 : peek === 1 ? 10 : 0 }}
      >
        {peek >= 2 && (
          <button
            type="button"
            aria-label={`Show all ${items.length}`}
            onClick={() => setOpen(true)}
            className="absolute inset-0 translate-y-5 scale-x-[0.92] rounded-xl border border-brite-tan/15 bg-[#2d241f] transition-transform duration-300 group-hover:translate-y-6"
          />
        )}
        {peek >= 1 && (
          <button
            type="button"
            aria-label={`Show all ${items.length}`}
            onClick={() => setOpen(true)}
            className="absolute inset-0 translate-y-2.5 scale-x-[0.96] rounded-xl border border-brite-tan/20 bg-[#322823] shadow-lg shadow-black/40 transition-transform duration-300 group-hover:translate-y-3.5"
          />
        )}
        <div className="relative">{first.node}</div>
      </div>

      {/* The rest, unfolding below. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        {/* inert while folded, so hidden cards can't be tabbed into. */}
        <div className="overflow-hidden" inert={!open}>
          <div className="flex flex-col gap-2 pt-2">
            {rest.map((item, i) => (
              <div
                key={item.key}
                className={`transition-[transform,opacity] duration-300 ease-out ${
                  open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
                }`}
                style={{ transitionDelay: open ? `${Math.min(i, 6) * 45}ms` : "0ms" }}
              >
                {item.node}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StackHeader({ title, count, children }: { title: string; count: number; children?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brite-amber">{title}</h2>
        {count > 0 && (
          <span className="rounded-full bg-brite-amber/15 px-2 py-0.5 text-[11px] font-bold text-brite-amber">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
