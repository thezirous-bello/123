export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#131318] p-5 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
