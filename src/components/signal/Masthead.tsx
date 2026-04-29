import Image from "next/image";

export function Masthead() {
  return (
    <div
      data-testid="masthead"
      className="flex items-center justify-between gap-6 border-b border-[color:var(--rule)] bg-[color:var(--paper)] px-7 py-4"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/app_icon_v4.svg"
            alt="The Memory Register Logo"
            width={32}
            height={32}
            className="rounded-md"
            unoptimized
          />
          <span
            className="font-sans text-[26px] font-semibold leading-none text-[color:var(--ink)]"
            style={{ letterSpacing: "-0.02em" }}
          >
            The Memory Register
          </span>
        </div>
        <span className="smallcaps mt-1 text-[10px] text-[color:var(--text-muted)]">
          Trace entities, follow relationships, resolve and prune — all inline.
        </span>
      </div>
      <span className="smallcaps font-mono text-[10px] text-[color:var(--text-muted)]">
        Signal Edition · v1.6
      </span>
    </div>
  );
}
