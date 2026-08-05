import os from "node:os";

/**
 * Real process/system metrics for the dashboard's system-monitor strip —
 * actual Node process CPU and memory usage, and actual HTTP traffic through
 * this server. No fabricated numbers: if you're not making API calls, NET
 * reads zero, not a fake sparkline.
 */

let cpuPercent = 0;
let lastCpuUsage = process.cpuUsage();
let lastSampleAtMs = Date.now();

function sampleCpu() {
  const usage = process.cpuUsage(lastCpuUsage);
  const elapsedMs = Date.now() - lastSampleAtMs;
  const totalCpuMs = (usage.user + usage.system) / 1000;
  cpuPercent = elapsedMs > 0 ? Math.min(100, (totalCpuMs / elapsedMs) * 100) : 0;
  lastCpuUsage = process.cpuUsage();
  lastSampleAtMs = Date.now();
}

let cpuSamplerHandle: NodeJS.Timeout | null = null;
export function startSystemStatsSampler(): void {
  if (cpuSamplerHandle) return;
  cpuSamplerHandle = setInterval(sampleCpu, 2000);
  cpuSamplerHandle.unref();
}

// Rolling 60s window of HTTP bytes transferred, tracked via Fastify hooks.
const trafficSamples: Array<{ atMs: number; bytesIn: number; bytesOut: number }> = [];

export function recordHttpTraffic(bytesIn: number, bytesOut: number): void {
  const now = Date.now();
  trafficSamples.push({ atMs: now, bytesIn, bytesOut });
  const cutoff = now - 60_000;
  while (trafficSamples.length > 0 && (trafficSamples[0]?.atMs ?? 0) < cutoff) {
    trafficSamples.shift();
  }
}

function trafficPerMinute(): { bytesInPerMin: number; bytesOutPerMin: number; requestsPerMin: number } {
  const cutoff = Date.now() - 60_000;
  let bytesIn = 0;
  let bytesOut = 0;
  let count = 0;
  for (const sample of trafficSamples) {
    if (sample.atMs < cutoff) continue;
    bytesIn += sample.bytesIn;
    bytesOut += sample.bytesOut;
    count += 1;
  }
  return { bytesInPerMin: bytesIn, bytesOutPerMin: bytesOut, requestsPerMin: count };
}

export interface SystemStats {
  cpuPercent: number;
  memUsedMb: number;
  memTotalMb: number;
  uptimeSeconds: number;
  requestsPerMin: number;
  bytesInPerMin: number;
  bytesOutPerMin: number;
}

export function getSystemStats(): SystemStats {
  const mem = process.memoryUsage();
  const traffic = trafficPerMinute();
  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memUsedMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    memTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
    ...traffic,
  };
}
