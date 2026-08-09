import { useEffect, useState } from "react";
import { api, type DashboardMetrics } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";

export function MetricsBar() {
  const tick = useRefreshSignal();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    api.metrics().then(setMetrics).catch(() => {});
  }, [tick]);

  if (!metrics) return null;

  // Conversions/revenue only ever reflect a real connected affiliate-network
  // integration (none exists in V1) — shown as "—" rather than a fabricated
  // 0, per the spec's "never fabricate unavailable metrics" rule.
  const tiles: Array<{ label: string; value: string }> = [
    { label: "Scanned Today", value: String(metrics.dealsScannedToday) },
    { label: "Qualified", value: String(metrics.qualifiedDealsToday) },
    { label: "Posted", value: String(metrics.dealsPostedToday) },
    { label: "Clicks Today", value: String(metrics.clicksToday) },
    { label: "Conversions", value: metrics.conversionsTracked ? String(metrics.conversionsToday) : "—" },
    { label: "Revenue Today", value: metrics.conversionsTracked ? `€${metrics.revenueToday}` : "—" },
    { label: "Revenue (Month)", value: metrics.conversionsTracked ? `€${metrics.revenueThisMonth}` : "—" },
    { label: "Avg Commission", value: metrics.averageCommission ? `€${metrics.averageCommission}` : "—" },
    { label: "Best Channel", value: metrics.bestChannel?.name ?? "—" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
      {tiles.map((t) => (
        <div key={t.label} className="glass-panel rounded-sm border border-[#1c232c] p-3">
          <p className="text-[10px] uppercase tracking-wide text-white/40">{t.label}</p>
          <p className="truncate text-lg font-bold text-white/90">{t.value}</p>
        </div>
      ))}
    </div>
  );
}
