import { Injectable, signal } from '@angular/core';

/** The witness: a small service outside both regions that sees each one's heartbeat (deploy/witness in the platform repo). */
export const WITNESS_URL = 'https://sprout-witness.sai31nayak.workers.dev';

export type RegionState = 'up' | 'degraded' | 'down' | 'unknown';

export interface Region {
  id: string;
  name: string;
  status: RegionState;
  detail: string;
  lastSeenSeconds: number | null;
}

export interface SystemEvent {
  at: number;
  text: string;
}

export interface SystemStatus {
  overall: RegionState;
  customersServed: boolean;
  summary: string;
  regions: Region[];
  events: SystemEvent[];
  updated: number;
}

const STATES: RegionState[] = ['up', 'degraded', 'down', 'unknown'];

function isState(v: unknown): v is RegionState {
  return typeof v === 'string' && (STATES as string[]).includes(v);
}

/** What the witness says, checked: null when it is not the shape that was promised (the pill then stays out of the way). */
export function parseStatus(body: unknown): SystemStatus | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object' || !Array.isArray(b['regions']) || !isState(b['overall'])) {
    return null;
  }
  const regions: Region[] = [];
  for (const r of b['regions'] as Record<string, unknown>[]) {
    if (!r || typeof r['id'] !== 'string' || typeof r['name'] !== 'string' || !isState(r['status'])) {
      return null;
    }
    regions.push({
      id: r['id'],
      name: r['name'],
      status: r['status'],
      detail: typeof r['detail'] === 'string' ? r['detail'] : '',
      lastSeenSeconds: typeof r['last_seen_s'] === 'number' ? r['last_seen_s'] : null,
    });
  }
  const events = Array.isArray(b['events'])
    ? (b['events'] as Record<string, unknown>[])
        .filter((e) => e && typeof e['at'] === 'number' && typeof e['text'] === 'string')
        .map((e) => ({ at: e['at'] as number, text: e['text'] as string }))
    : [];
  return {
    overall: b['overall'],
    customersServed: b['customers_served'] === true,
    summary: typeof b['summary'] === 'string' ? b['summary'] : '',
    regions,
    events,
    updated: typeof b['updated'] === 'number' ? b['updated'] : 0,
  };
}

/** Whether both regions are working, read from the witness every 30 s while the page is showing. */
@Injectable({ providedIn: 'root' })
export class Regions {
  readonly status = signal<SystemStatus | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Starts reading (once). Safe to call from every component that shows it. */
  watch(): void {
    if (this.timer !== null || typeof document === 'undefined') {
      return;
    }
    void this.refresh();
    this.timer = setInterval(() => {
      if (!document.hidden) {
        void this.refresh();
      }
    }, 30_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        void this.refresh();
      }
    });
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch(`${WITNESS_URL}/status`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
      this.status.set(res.ok ? parseStatus(await res.json()) : null);
    } catch {
      this.status.set(null);
    }
  }
}
