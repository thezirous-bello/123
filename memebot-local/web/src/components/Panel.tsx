export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="relative rounded-sm border border-[#1b2530] bg-[#0B1017]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-3 flex items-center justify-between border-b border-[#1b2530] pb-2">
        <h2 className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
          <span className="text-[#00E5FF]">&gt;</span> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
