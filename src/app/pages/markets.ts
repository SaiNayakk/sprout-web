import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { inr, percent, direction } from '../core/money';
import { Prices } from '../core/prices';
import { Instrument, Market } from '../core/types';
import { value } from '../ui/dom';
import { Status } from '../ui/status';

/** Every share, with live prices over a stream. */
@Component({
  selector: 'app-markets',
  imports: [RouterLink, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="row between">
        <h1>Markets</h1>
        @if (market(); as m) {
          <span class="chip" [class.plain]="m.state !== 'OPEN'">{{ m.state === 'OPEN' ? 'Open' : m.state === 'PRE_OPEN' ? 'Opens soon' : 'Closed' }}
            @if (m.speed > 1) { · {{ m.speed }}× speed }</span>
        }
      </div>
      <p class="muted small">
        {{ market()?.source }}. These shares are fictional.
        @if (!prices.live()) { <span class="chip bad">Reconnecting to live prices…</span> }
      </p>
      <div class="field"><label for="q" class="sr-only">Search</label>
        <input id="q" type="search" placeholder="Search by name or symbol" [value]="query()" (input)="query.set(text($event))" /></div>
      <app-status [loading]="instruments.loading() && !instruments.value()" [error]="instruments.error()" (retry)="instruments.reload()" />
      <div class="card scroll-x">
        <table>
          <thead><tr><th>Share</th><th class="right">Price</th><th class="right">Today</th></tr></thead>
          <tbody>
            @for (i of shown(); track i.symbol) {
              @let q = prices.quotes()[i.symbol];
              <tr>
                <td>
                  <a [routerLink]="i.tradable ? ['/markets', i.symbol] : null"><strong>{{ i.symbol }}</strong></a>
                  <div class="small muted">{{ i.name }}@if (i.industry) { · {{ i.industry }} }</div>
                </td>
                <td class="right num">{{ q ? inr(q.last) : '–' }}</td>
                <td class="right num" [class]="q ? dir(q.change) : ''">{{ q ? arrow(q.change) + percent(q.changePercent) : '' }}</td>
              </tr>
            } @empty {
              @if (instruments.value()) { <tr><td colspan="3" class="empty">Nothing matches “{{ query() }}”.</td></tr> }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class Markets {
  private readonly api = inject(Api);
  protected readonly prices = inject(Prices);
  protected readonly inr = inr;
  protected readonly percent = percent;
  protected readonly dir = direction;
  protected readonly text = value;

  protected readonly instruments = new Loader<Instrument[]>(async () => (await this.api.get<{ instruments: Instrument[] }>('/marketdata/v1/instruments')).instruments);
  protected readonly query = signal('');
  protected readonly market = computed<Market | null>(() => this.prices.market());
  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.instruments.value() ?? []).filter((i) => !q || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  });

  constructor() {
    let stream: { close(): void } | null = null;
    let opened = false;
    effect(() => {
      const list = this.instruments.value();
      if (list && !opened) {
        opened = true;
        stream = this.prices.open(list.map((i) => i.symbol).slice(0, 50));
      }
    });
    inject(DestroyRef).onDestroy(() => stream?.close());
  }

  /** The arrow goes with the sign: a fall is never only a colour. */
  protected arrow(change: number): string {
    return change > 0 ? '▲ ' : change < 0 ? '▼ ' : '';
  }
}
