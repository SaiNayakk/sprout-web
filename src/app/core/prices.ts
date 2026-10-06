import { Injectable, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { SseParser } from './sse';
import { Market, Quote } from './types';

export interface PriceStream {
  close(): void;
}

/**
 * Live prices. The stream needs the login token, which the browser's EventSource can't send, so this
 * reads the response body itself. It reconnects with a pause that grows to 15 s, asks the login for a new
 * token when the old one has run out, and stops when closed.
 */
@Injectable({ providedIn: 'root' })
export class Prices {
  private readonly auth = inject(Auth);

  /** The latest quote per symbol, from the streams this page has open. */
  readonly quotes = signal<Record<string, Quote>>({});
  readonly market = signal<Market | null>(null);
  readonly live = signal(false);

  open(symbols: string[]): PriceStream {
    const control = new AbortController();
    void this.run(symbols, control.signal);
    return { close: () => control.abort() };
  }

  private async run(symbols: string[], stop: AbortSignal): Promise<void> {
    let pause = 1000;
    while (!stop.aborted) {
      try {
        const token = this.auth.accessToken();
        const res = await fetch('/api/marketdata/v1/stream?symbols=' + encodeURIComponent(symbols.join(',')), {
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: stop,
        });
        if (res.status === 401) {
          await this.auth.refreshAfter(token);
        } else if (res.ok && res.body) {
          this.live.set(true);
          pause = 1000;
          await this.read(res.body, stop);
        }
      } catch {
        // dropped or refused: pause, then try again
      }
      this.live.set(false);
      if (stop.aborted) {
        return;
      }
      await new Promise((r) => setTimeout(r, pause));
      pause = Math.min(pause * 2, 15000);
    }
  }

  private async read(body: ReadableStream<Uint8Array>, stop: AbortSignal): Promise<void> {
    const reader = body.getReader();
    const text = new TextDecoder();
    const parser = new SseParser();
    stop.addEventListener('abort', () => void reader.cancel(), { once: true });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      for (const e of parser.push(text.decode(value, { stream: true }))) {
        this.apply(e.event, e.data);
      }
    }
  }

  private apply(event: string, data: string): void {
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    if (event === 'market') {
      this.market.set(json as Market);
    } else if (event === 'quote') {
      const q = json as Quote;
      this.quotes.update((all) => ({ ...all, [q.symbol]: q }));
    } else if (event === 'tick') {
      const t = json as { symbol: string; price: number; ts: string; seq: number };
      this.quotes.update((all) => {
        const q = all[t.symbol];
        if (!q) {
          return all;
        }
        const change = round2(t.price - q.prevClose);
        return {
          ...all,
          [t.symbol]: {
            ...q,
            last: t.price,
            high: Math.max(q.high, t.price),
            low: Math.min(q.low, t.price),
            change,
            changePercent: q.prevClose ? round2((change / q.prevClose) * 100) : 0,
            ts: t.ts,
            seq: t.seq,
          },
        };
      });
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
