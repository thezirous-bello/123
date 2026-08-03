export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" | "accent" }) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-white/10 text-white/80 border-white/10",
    good: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    danger: "bg-red-500/15 text-red-300 border-red-500/30",
    accent: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
