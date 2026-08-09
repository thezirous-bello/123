import { useEffect, useState } from "react";
import { api, type ChannelRow, type TelegramHealth } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Badge } from "./Badge.js";
import { Panel } from "./Panel.js";

export function ChannelsPanel() {
  const tick = useRefreshSignal();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [health, setHealth] = useState<TelegramHealth | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [chatId, setChatId] = useState("");
  const [categories, setCategories] = useState("");
  const [minScore, setMinScore] = useState(75);

  useEffect(() => {
    api.channels().then(setChannels).catch(() => {});
    api.telegramHealth().then(setHealth).catch(() => {});
  }, [tick]);

  async function create() {
    if (!name || !chatId) return;
    setBusy(true);
    try {
      await api.createChannel({
        name,
        chatId,
        categories: categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        minDealScore: minScore,
      });
      setName("");
      setChatId("");
      setCategories("");
      setChannels(await api.channels());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Telegram Channels"
      action={
        health && (
          <Badge tone={health.configured ? (health.ok ? "good" : "danger") : "warn"}>
            {health.configured ? (health.ok ? `@${health.botUsername}` : "bot error") : "no token configured"}
          </Badge>
        )
      }
    >
      {!health?.configured && (
        <p className="mb-3 rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          TELEGRAM_BOT_TOKEN is not set — channels can be configured, but nothing will actually post until you add a real bot token to the server's .env.
        </p>
      )}

      <div className="mb-4 space-y-2">
        {channels.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-sm border border-white/10 bg-black/20 p-3 font-mono text-xs">
            <span className="font-semibold text-white/80">{c.name}</span>
            <Badge tone={c.enabled ? "good" : "neutral"}>{c.enabled ? "enabled" : "disabled"}</Badge>
            <span className="text-white/40">chat {c.chat_id}</span>
            <span className="text-white/40">{JSON.parse(c.categories_json).join(", ") || "all categories"}</span>
            <span className="text-white/40">
              min score {c.min_deal_score} · max {c.max_posts_per_hour}/hr, {c.max_posts_per_day}/day
            </span>
            <button
              disabled={busy}
              onClick={async () => {
                await api.updateChannel(c.id, { enabled: !c.enabled });
                setChannels(await api.channels());
              }}
              className="ml-auto rounded-sm border border-white/20 px-2 py-1 text-[10px] hover:bg-white/10"
            >
              {c.enabled ? "DISABLE" : "ENABLE"}
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                await api.deleteChannel(c.id);
                setChannels(await api.channels());
              }}
              className="rounded-sm border border-red-500/40 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/10"
            >
              DELETE
            </button>
          </div>
        ))}
        {channels.length === 0 && <p className="text-xs text-white/30">No channels configured yet.</p>}
      </div>

      <div className="rounded-sm border border-white/10 bg-black/20 p-3">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-white/50">Add channel</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs" />
          <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Chat ID (-100...)" className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs" />
          <input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Categories (comma-separated, blank = all)" className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs" />
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-20 rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs"
          />
          <button disabled={busy || !name || !chatId} onClick={create} className="rounded-sm bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40">
            ADD
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/30">
          Get a chat id by adding your bot to the channel as admin, posting once, then checking https://api.telegram.org/bot&lt;token&gt;/getUpdates.
        </p>
      </div>
    </Panel>
  );
}
