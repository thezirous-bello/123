import type { ReactNode } from "react";

export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass-panel rounded-sm border border-[#1c232c] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}>
      <div className="mb-3 flex items-center justify-between border-b border-[#1c232c] pb-2">
        <h2 className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
          <span className="text-[#2dd4bf]">&gt;</span> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
