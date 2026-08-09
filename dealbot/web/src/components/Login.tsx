import { useState } from "react";
import { api } from "../api/client.js";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(username, password);
      onLoggedIn();
    } catch {
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="glass-panel w-full max-w-sm rounded-sm border border-[#1c232c] p-6">
        <h1 className="mb-1 font-mono text-lg font-bold text-white/90">
          Deal<span className="text-[#2dd4bf]">Bot</span>
        </h1>
        <p className="mb-6 text-xs text-white/40">Private admin dashboard — authorized operator only.</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Username</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-sm border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>

        {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

        <button
          disabled={busy || !username || !password}
          className="w-full rounded-sm bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
