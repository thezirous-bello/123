import type { FastifyInstance } from "fastify";
import { getSolBalance, getTokenBalances, getWalletAddress, isWalletConfigured } from "../wallet/walletManager.js";
import { getPaperAccount } from "../engine/paperAccount.js";

export default async function walletRoutes(app: FastifyInstance) {
  app.get("/wallet", async () => {
    const configured = isWalletConfigured();
    if (!configured) {
      return { configured: false, address: null, solBalance: null, tokenBalances: [] };
    }
    const [solBalance, tokenBalances] = await Promise.all([getSolBalance(), getTokenBalances()]);
    return {
      configured: true,
      address: getWalletAddress(),
      solBalance: solBalance.toFixed(),
      tokenBalances,
    };
  });

  app.get("/paper-account", async () => {
    const account = getPaperAccount();
    return {
      startingBalanceUsd: account.startingBalanceUsd.toFixed(),
      cashBalanceUsd: account.cashBalanceUsd.toFixed(),
      updatedAt: account.updatedAt,
    };
  });
}
