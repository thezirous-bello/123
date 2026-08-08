export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" | "accent" }) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-white/5 text-white/70 border-white/15",
    good: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/40",
    danger: "bg-red-500/10 text-red-300 border-red-500/40",
    accent: "bg-violet-500/10 text-violet-300 border-violet-500/40",
  };
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
