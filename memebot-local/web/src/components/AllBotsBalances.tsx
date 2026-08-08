import { useEffect, useState } from "react";
import { api, type PaperAccountInfo, type WalletInfo } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

interface Tile {
  label: string;
  primary: string;
  secondary: string;
  tone: "violet" | "emerald" | "amber" | "sky";
}

const TONE_CLASSES: Record<Tile["tone"], string> = {
  violet: "border-violet-500/20 bg-violet-500/5 text-violet-200",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-200",
  amber: "border-amber-500/20 bg-amber-500/5 text-amber-200",
  sky: "border-sky-500/20 bg-sky-500/5 text-sky-200",
};

/** One glance at every bot's balance — the four bots run entirely
 * independently (separate paper accounts / separate Bybit sub-balances),
 * so nothing anywhere else in the dashboard shows all four at once. */
export function AllBotsBalances() {
  const tick = useRefreshSignal();
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [totalUsd, setTotalUsd] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const [memeStatus, paperAccount, memeWallet, spotStatus, futuresStatus, arbWallet] = await Promise.all([
        api.status().catch(() => null),
        api.paperAccount().catch(() => null),
        api.wallet().catch(() => null),
        api.spotStatus().catch(() => null),
        api.futuresStatus().catch(() => null),
        api.arbWallet().catch(() => null),
      ]);

      const [spotWallet, futuresWallet] = await Promise.all([
        spotStatus ? api.spotWallet(spotStatus.mode).catch(() => null) : Promise.resolve(null),
        futuresStatus ? api.futuresWallet(futuresStatus.mode).catch(() => null) : Promise.resolve(null),
      ]);

      const memeTile = memeTileFrom(memeStatus?.mode ?? "paper", paperAccount, memeWallet);
      const spotTile: Tile = {
        label: "Bybit Spot",
        primary: spotWallet?.configured ? `$${(spotWallet.totalEquityUsd ?? 0).toFixed(2)}` : "—",
        secondary: spotStatus ? spotStatus.mode.toUpperCase() : "",
        tone: "emerald",
      };
      const futuresTile: Tile = {
        label: "Bybit Futures",
        primary: futuresWallet?.configured ? `$${(futuresWallet.totalEquityUsd ?? 0).toFixed(2)}` : "—",
        secondary: futuresStatus ? futuresStatus.mode.toUpperCase() : "",
        tone: "amber",
      };
      const arbTile: Tile = {
        label: "Arbitrage",
        primary: arbWallet ? `$${Number(arbWallet.cashBalanceUsd).toFixed(2)}` : "—",
        secondary: "PAPER",
        tone: "sky",
      };

      setTiles([memeTile, spotTile, futuresTile, arbTile]);

      const usdParts = [
        memeStatus?.mode === "paper" ? Number(paperAccount?.cashBalanceUsd ?? 0) : null,
        spotWallet?.configured ? spotWallet.totalEquityUsd : null,
        futuresWallet?.configured ? futuresWallet.totalEquityUsd : null,
        arbWallet ? Number(arbWallet.cashBalanceUsd) : null,
      ].filter((v): v is number => v != null);
      setTotalUsd(usdParts.length > 0 ? usdParts.reduce((a, b) => a + b, 0) : null);
    }
    load();
  }, [tick]);

  return (
    <Panel title="Portfolio Overview — All Bots" action={totalUsd != null && <Badge tone="accent">~${totalUsd.toFixed(2)} across USD-denominated bots</Badge>}>
      {!tiles ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className={`rounded-lg border p-3 ${TONE_CLASSES[tile.tone]}`}>
              <p className="text-xs uppercase tracking-wide text-white/50">{tile.label}</p>
              <p className="text-xl font-bold">{tile.primary}</p>
              {tile.secondary && <p className="text-[10px] uppercase tracking-wide text-white/40">{tile.secondary}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function memeTileFrom(mode: "paper" | "live", paperAccount: PaperAccountInfo | null, wallet: WalletInfo | null): Tile {
  if (mode === "paper") {
    return {
      label: "Meme Coins",
      primary: paperAccount ? `$${Number(paperAccount.cashBalanceUsd).toFixed(2)}` : "—",
      secondary: "PAPER",
      tone: "violet",
    };
  }
  return {
    label: "Meme Coins",
    primary: wallet?.solBalance ? `${Number(wallet.solBalance).toFixed(3)} SOL` : "—",
    secondary: "LIVE",
    tone: "violet",
  };
}
