import { env, isTelegramConfigured } from "../env.js";
import { logApiCall } from "../lib/apiLog.js";

const TELEGRAM_API = "https://api.telegram.org";

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Real Telegram Bot API calls — no mock mode here, this either genuinely
 * posts or genuinely fails and says why. Inert (always returns "not
 * configured") until TELEGRAM_BOT_TOKEN is set. */
export async function sendTelegramMessage(chatId: string, text: string, opts?: { photoUrl?: string }): Promise<SendMessageResult> {
  if (!isTelegramConfigured) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured." };
  const token = env.TELEGRAM_BOT_TOKEN!;
  const start = Date.now();
  const method = opts?.photoUrl ? "sendPhoto" : "sendMessage";
  try {
    const body: Record<string, unknown> = opts?.photoUrl
      ? { chat_id: chatId, photo: opts.photoUrl, caption: text, parse_mode: "HTML" }
      : { chat_id: chatId, text, parse_mode: "HTML" };
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    logApiCall("telegram", method, res.ok && json.ok, res.status, json.ok ? undefined : json.description, Date.now() - start);
    if (!json.ok) return { ok: false, error: json.description ?? `Telegram API error (${res.status})` };
    return { ok: true, messageId: String(json.result?.message_id) };
  } catch (err) {
    logApiCall("telegram", method, false, undefined, (err as Error).message, Date.now() - start);
    return { ok: false, error: (err as Error).message };
  }
}

export async function editTelegramMessage(chatId: string, messageId: string, text: string): Promise<SendMessageResult> {
  if (!isTelegramConfigured) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured." };
  const start = Date.now();
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: Number(messageId), text, parse_mode: "HTML" }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    logApiCall("telegram", "editMessageText", res.ok && json.ok, res.status, json.ok ? undefined : json.description, Date.now() - start);
    if (!json.ok) return { ok: false, error: json.description };
    return { ok: true };
  } catch (err) {
    logApiCall("telegram", "editMessageText", false, undefined, (err as Error).message, Date.now() - start);
    return { ok: false, error: (err as Error).message };
  }
}

export async function sendAdminNotification(text: string): Promise<void> {
  if (!isTelegramConfigured || !env.ADMIN_TELEGRAM_CHAT_ID) return;
  await sendTelegramMessage(env.ADMIN_TELEGRAM_CHAT_ID, text);
}

export async function checkTelegramHealth(): Promise<{ ok: boolean; botUsername?: string; error?: string }> {
  if (!isTelegramConfigured) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured." };
  const start = Date.now();
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
    const json = (await res.json()) as { ok: boolean; result?: { username: string }; description?: string };
    logApiCall("telegram", "getMe", res.ok && json.ok, res.status, json.ok ? undefined : json.description, Date.now() - start);
    if (!json.ok) return { ok: false, error: json.description };
    return { ok: true, botUsername: json.result?.username };
  } catch (err) {
    logApiCall("telegram", "getMe", false, undefined, (err as Error).message, Date.now() - start);
    return { ok: false, error: (err as Error).message };
  }
}
