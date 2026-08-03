/**
 * Standalone setup script — NOT part of the running server or API.
 *
 * Generates a brand-new dedicated trading-wallet keypair and writes it
 * straight into the project's local .env file. It deliberately never prints
 * the private key to the terminal, a log file, or anywhere else: the only
 * output is the new wallet's public address.
 *
 * Run with: npm run wallet:generate -w server
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..", "..");
const envPath = join(projectRoot, ".env");
const envExamplePath = join(projectRoot, ".env.example");

if (!existsSync(envPath)) {
  if (!existsSync(envExamplePath)) {
    console.error("Cannot find .env or .env.example at project root:", projectRoot);
    process.exit(1);
  }
  copyFileSync(envExamplePath, envPath);
  console.log("Created .env from .env.example");
}

const existing = readFileSync(envPath, "utf-8");
if (/^SOLANA_PRIVATE_KEY=.+$/m.test(existing)) {
  console.error(
    "SOLANA_PRIVATE_KEY is already set in .env. Refusing to overwrite an existing wallet.\n" +
      "If you really want a new wallet, remove that line from .env first (and make sure you\n" +
      "have withdrawn or backed up any funds in the old one — this cannot be undone).",
  );
  process.exit(1);
}

const keypair = Keypair.generate();
const secretKeyBase58 = bs58.encode(keypair.secretKey);
const publicAddress = keypair.publicKey.toBase58();

const updated = /^SOLANA_PRIVATE_KEY=\s*$/m.test(existing)
  ? existing.replace(/^SOLANA_PRIVATE_KEY=\s*$/m, `SOLANA_PRIVATE_KEY=${secretKeyBase58}`)
  : `${existing.trimEnd()}\nSOLANA_PRIVATE_KEY=${secretKeyBase58}\n`;

writeFileSync(envPath, updated, { mode: 0o600 });

console.log("New dedicated trading wallet created.");
console.log("Public address:", publicAddress);
console.log("");
console.log("The private key was written directly to .env (permissions set to 0600) and was");
console.log("NOT printed above. Back up your .env file somewhere safe and private — anyone who");
console.log("gets it can move every asset in this wallet. Never commit .env to git.");
console.log("");
console.log("Only fund this wallet with money you can afford to lose.");
