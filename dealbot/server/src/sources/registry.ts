import type { DealSourceAdapter } from "./types.js";
import { DemoSourceAdapter } from "./demoSource.js";

/** New real adapters (Amazon PA-API, AWIN, CJ, Rakuten, ...) register here
 * by kind. The scan loop never talks to a provider's HTTP API directly —
 * only through this interface — so adding a provider never touches the
 * scoring/verification/posting pipeline. */
const ADAPTERS: Record<string, DealSourceAdapter> = {
  demo: new DemoSourceAdapter(),
};

export function getAdapter(kind: string): DealSourceAdapter | undefined {
  return ADAPTERS[kind];
}

export function listAdapterKinds(): string[] {
  return Object.keys(ADAPTERS);
}
