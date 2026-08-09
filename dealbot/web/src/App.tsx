import { useEffect, useState } from "react";
import { api } from "./api/client.js";
import { Login } from "./components/Login.js";
import { ControlBar } from "./components/ControlBar.js";
import { MetricsBar } from "./components/MetricsBar.js";
import { ActivityFeed } from "./components/ActivityFeed.js";
import { DealFeedTable } from "./components/DealFeedTable.js";
import { SourcesPanel } from "./components/SourcesPanel.js";
import { ChannelsPanel } from "./components/ChannelsPanel.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { BlocklistPanel } from "./components/BlocklistPanel.js";

const TABS = ["Dashboard", "Deals", "Sources", "Channels", "Rules", "Blocklist"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (!authed) return <Login onLoggedIn={() => setAuthed(true)} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-white/90">
            Deal<span className="text-[#2dd4bf]">Bot</span>
          </h1>
          <p className="text-xs text-white/40">Autonomous deal discovery + affiliate posting — private operator dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <nav className="flex flex-wrap gap-1 rounded-sm border border-[#1c232c] bg-[#0d1117]/80 p-1 font-mono">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition ${
                  tab === t ? "bg-teal-500/15 text-teal-300 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.4)]" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <button
            onClick={() => api.logout().then(() => setAuthed(false))}
            className="rounded-sm border border-white/15 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10"
          >
            LOGOUT
          </button>
        </div>
      </header>

      <ControlBar />

      {tab === "Dashboard" && (
        <>
          <MetricsBar />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
            <DealFeedTable />
            <ActivityFeed />
          </div>
        </>
      )}

      {tab === "Deals" && <DealFeedTable />}
      {tab === "Sources" && <SourcesPanel />}
      {tab === "Channels" && <ChannelsPanel />}
      {tab === "Rules" && <SettingsPanel />}
      {tab === "Blocklist" && <BlocklistPanel />}

      <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-white/30">
        <p>
          Private tool: nothing here is fabricated. Demo mode uses clearly-labeled sample data only; production mode only ever posts deals from
          real connected sources with a real affiliate link. Conversions/revenue show "—" until a real affiliate-network reporting integration is
          connected.
        </p>
      </footer>
    </div>
  );
}
