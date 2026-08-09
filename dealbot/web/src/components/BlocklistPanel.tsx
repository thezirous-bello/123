import { useEffect, useState } from "react";
import { api, type BlockedBrand, type BlockedProduct } from "../api/client.js";
import { Panel } from "./Panel.js";

export function BlocklistPanel() {
  const [products, setProducts] = useState<BlockedProduct[]>([]);
  const [brands, setBrands] = useState<BlockedBrand[]>([]);

  function reload() {
    api.blockedProducts().then(setProducts).catch(() => {});
    api.blockedBrands().then(setBrands).catch(() => {});
  }

  useEffect(reload, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title={`Blocked Products (${products.length})`}>
        <div className="space-y-1.5">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-sm border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
              <span className="text-white/70">{p.label}</span>
              <button
                onClick={async () => {
                  await api.unblockProduct(p.id);
                  reload();
                }}
                className="rounded-sm border border-white/20 px-2 py-1 text-[10px] hover:bg-white/10"
              >
                UNBLOCK
              </button>
            </div>
          ))}
          {products.length === 0 && <p className="text-xs text-white/30">No blocked products.</p>}
        </div>
      </Panel>
      <Panel title={`Blocked Brands (${brands.length})`}>
        <div className="space-y-1.5">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-sm border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
              <span className="text-white/70">{b.brand}</span>
              <button
                onClick={async () => {
                  await api.unblockBrand(b.id);
                  reload();
                }}
                className="rounded-sm border border-white/20 px-2 py-1 text-[10px] hover:bg-white/10"
              >
                UNBLOCK
              </button>
            </div>
          ))}
          {brands.length === 0 && <p className="text-xs text-white/30">No blocked brands.</p>}
        </div>
      </Panel>
    </div>
  );
}
