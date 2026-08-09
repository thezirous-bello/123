import type { DealSourceAdapter, RawOffer, SourceScanResult } from "./types.js";

/** Fixed catalog for the demo source — every field is clearly synthetic and
 * merchant/brand names say "Demo" so nothing here can be mistaken for a
 * real product if it ever ended up on screen. This exists purely so the
 * full discovery -> verify -> score -> link -> post pipeline can be
 * exercised end to end without any real affiliate credentials. Per the
 * project's own spec: DEMO MODE only, never used in production mode. */
const CATALOG: Array<{ name: string; brand: string; category: string; basePrice: number; rating: number; reviewCount: number }> = [
  { name: "Demo Wireless Headphones X2", brand: "Demo Audio", category: "Tech", basePrice: 349, rating: 4.7, reviewCount: 2140 },
  { name: "Demo Mechanical Keyboard 87", brand: "Demo Gaming", category: "Gaming", basePrice: 129, rating: 4.5, reviewCount: 860 },
  { name: "Demo 4K Action Camera", brand: "Demo Optics", category: "Tech", basePrice: 259, rating: 4.3, reviewCount: 410 },
  { name: "Demo Running Shoes Air", brand: "Demo Sport", category: "Fashion", basePrice: 119, rating: 4.6, reviewCount: 3200 },
  { name: "Demo Smart Watch S3", brand: "Demo Wear", category: "Tech", basePrice: 219, rating: 4.4, reviewCount: 1580 },
  { name: "Demo Espresso Machine Pro", brand: "Demo Home", category: "Home", basePrice: 449, rating: 4.8, reviewCount: 970 },
  { name: "Demo Gaming Mouse GX", brand: "Demo Gaming", category: "Gaming", basePrice: 79, rating: 4.6, reviewCount: 2410 },
  { name: "Demo Backpack Voyager", brand: "Demo Travel", category: "Travel", basePrice: 89, rating: 4.2, reviewCount: 540 },
  { name: "Demo Bluetooth Speaker Mini", brand: "Demo Audio", category: "Tech", basePrice: 59, rating: 4.1, reviewCount: 1980 },
  { name: "Demo Air Fryer 5L", brand: "Demo Home", category: "Home", basePrice: 129, rating: 4.5, reviewCount: 5200 },
];

const MERCHANTS = ["Demo Store A", "Demo Store B"];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export class DemoSourceAdapter implements DealSourceAdapter {
  kind = "demo";

  async scan(): Promise<SourceScanResult> {
    const offers: RawOffer[] = [];
    const scanSeed = Math.floor(Date.now() / (1000 * 60 * 5)); // stable within a 5-minute window

    CATALOG.forEach((product, productIdx) => {
      MERCHANTS.forEach((merchant, merchantIdx) => {
        const noise = seededRandom(scanSeed * 97 + productIdx * 13 + merchantIdx * 7);
        // Most scans: no discount (price == reference). Occasionally: a
        // real-looking drop, so verification/scoring has actual signal —
        // this is the demo source's own honest data, not a fabrication
        // layered on top by the app.
        const hasDrop = noise > 0.62;
        const dropPct = hasDrop ? 0.1 + seededRandom(scanSeed + productIdx * 31) * 0.35 : 0;
        const currentPrice = product.basePrice * (1 - dropPct);

        offers.push({
          externalProductId: `demo-${productIdx}`,
          name: product.name,
          brand: product.brand,
          category: product.category,
          imageUrl: undefined,
          currentPrice: currentPrice.toFixed(2),
          referencePrice: product.basePrice.toFixed(2),
          currency: "EUR",
          productUrl: `https://example-demo-store.invalid/product/demo-${productIdx}`,
          merchant,
          country: "AL",
          rating: product.rating,
          reviewCount: product.reviewCount,
          availability: noise > 0.05 ? "in_stock" : "out_of_stock",
        });
      });
    });

    return { offers, ok: true };
  }
}
