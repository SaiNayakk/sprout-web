import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { amountToApi, direction, inr, paise, fromPaise, percent } from '../core/money';
import { messageOf } from '../core/problem';
import { Prices } from '../core/prices';
import { Toasts } from '../core/toast';
import { Candle, Holding, Instrument, NewOrder, Order } from '../core/types';
import { Chg } from '../ui/chg';
import { value } from '../ui/dom';
import { LineChart } from '../ui/line-chart';
import { Status } from '../ui/status';

/** One share: its live price and history, and the order ticket. An order is always reviewed before it is placed. */
@Component({
  selector: 'app-stock',
  imports: [RouterLink, Status, LineChart, Chg],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <p><a routerLink="/markets" class="small">← Markets</a></p>
      <app-status [loading]="info.loading() && !info.value()" [error]="info.error()" (retry)="info.reload()" />
      @if (info.value(); as i) {
        <div class="row between">
          <div><h1>{{ i.symbol }}</h1><p class="muted">{{ i.name }}@if (i.industry) { · {{ i.industry }} }</p></div>
          @if (quote(); as q) {
            <div class="right">
              <p class="big">{{ inr(q.last) }}</p>
              <p class="num small" [class]="dir(q.change)">{{ q.change > 0 ? '▲ ' : q.change < 0 ? '▼ ' : '' }}{{ percent(q.changePercent) }} today</p>
            </div>
          }
        </div>

        <div class="grid two">
          <section class="card" aria-label="Price history">
            <div class="row between"><h2>Price</h2>
              <span class="row">
                <button class="btn small" [class.secondary]="range() !== 'day'" type="button" (click)="setRange('day')">Today</button>
                <button class="btn small" [class.secondary]="range() !== 'days'" type="button" (click)="setRange('days')">Days</button>
              </span>
            </div>
            <app-line-chart [points]="closes()" [unit]="i.symbol" />
            @if (quote(); as q) {
              <div class="grid three small" style="margin-top:.8rem">
                <div><span class="label">Open</span><p class="num">{{ inr(q.open) }}</p></div>
                <div><span class="label">High / Low</span><p class="num">{{ inr(q.high) }} / {{ inr(q.low) }}</p></div>
                <div><span class="label">Yesterday</span><p class="num">{{ inr(q.prevClose) }}</p></div>
              </div>
            }
            @if (held(); as h) {
              <p class="small">You hold <strong class="num">{{ h.quantity }}</strong> ({{ inr(h.investedValue) }} invested)@if (h.pnl) { , <app-chg [amount]="h.pnl" /> }.</p>
            }
          </section>

          @if (i.tradable) {
            <section class="card" aria-labelledby="ticket-h">
              @if (placed(); as o) {
                <h2 id="ticket-h">Order {{ o.status === 'FILLED' ? 'done' : o.status === 'REJECTED' ? 'refused' : 'placed' }}</h2>
                <p>
                  {{ o.side === 'BUY' ? 'Buy' : 'Sell' }} {{ o.quantity }} × {{ o.symbol }}
                  <span class="chip" [class.bad]="o.status === 'REJECTED'">{{ statusText(o) }}</span>
                </p>
                @if (o.status === 'FILLED') {
                  <p class="num">at {{ inr(o.price) }} · {{ inr(o.value) }} <span class="muted small">+ {{ inr(o.charges?.total) }} charges</span></p>
                }
                @if (o.rejection) { <p class="error">{{ o.rejection.message }}</p> }
                <div class="row">
                  <button class="btn small" type="button" (click)="placed.set(null)">Another order</button>
                  <a class="btn secondary small" routerLink="/orders">All orders</a>
                </div>
              } @else {
                <h2 id="ticket-h">Trade</h2>
                <div class="row" role="group" aria-label="Buy or sell">
                  <button class="btn" [class.secondary]="side() !== 'BUY'" type="button" (click)="side.set('BUY')">Buy</button>
                  <button class="btn" [class.secondary]="side() !== 'SELL'" type="button" (click)="side.set('SELL')">Sell</button>
                </div>
                <form (submit)="$event.preventDefault(); review.set(true)" novalidate style="margin-top:.8rem">
                  <div class="field"><label for="qty">Quantity</label>
                    <input id="qty" inputmode="numeric" [value]="qty()" (input)="qty.set(digits($event))" /></div>
                  <div class="field"><label for="type">Order type</label>
                    <select id="type" [value]="type()" (change)="type.set(text($event) === 'LIMIT' ? 'LIMIT' : 'MARKET')">
                      <option value="MARKET" [selected]="type() === 'MARKET'">Market: at the price now</option>
                      <option value="LIMIT" [selected]="type() === 'LIMIT'">Limit: at my price or better</option>
                    </select></div>
                  @if (type() === 'LIMIT') {
                    <div class="field"><label for="limit">Limit price (₹)</label>
                      <input id="limit" inputmode="decimal" [value]="limit()" (input)="limit.set(text($event))" /></div>
                  }
                  <div class="field"><label for="prod">Product</label>
                    <select id="prod" [value]="product()" (change)="product.set(text($event) === 'MIS' ? 'MIS' : 'CNC')">
                      <option value="CNC" [selected]="product() === 'CNC'">Delivery: buy and keep</option>
                      <option value="MIS" [selected]="product() === 'MIS'">Intraday: 5× leverage, closed at 15:20</option>
                    </select>
                    @if (product() === 'MIS') {
                      <p class="hint">Intraday can lose more than you expect, and Sprout closes every position at 15:20. Delivery investing is what builds your habit.</p>
                    }
                  </div>
                  @if (marketClosed()) { <p class="hint">The market is closed: this will be queued and sent when it opens.</p> }
                  @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

                  @if (review()) {
                    <div class="card soft" role="status">
                      <p class="label">Review</p>
                      <p><strong>{{ side() === 'BUY' ? 'Buy' : 'Sell' }} {{ qty() }} × {{ i.symbol }}</strong>
                        {{ type() === 'LIMIT' ? 'at ₹' + limit() + ' or better' : 'at the market price' }}, {{ product() === 'CNC' ? 'delivery' : 'intraday' }}.</p>
                      @if (estimate(); as e) { <p class="num">About {{ inr(e) }} plus charges</p> }
                      <div class="row">
                        <button class="btn" type="button" [disabled]="busy()" (click)="place()">{{ busy() ? 'Placing…' : 'Confirm' }}</button>
                        <button class="btn secondary" type="button" [disabled]="busy()" (click)="edit()">Edit</button>
                      </div>
                    </div>
                  } @else {
                    <button class="btn block" type="submit">Review order</button>
                  }
                </form>
                <p class="small muted" style="margin-top:.8rem">
                  Prefer to invest regularly? <a [routerLink]="'/plans'" [queryParams]="{ symbol: i.symbol }">Start a monthly plan</a> or put it towards a <a routerLink="/goals">goal</a>.
                </p>
              }
            </section>
          }
        </div>
      }
    </div>
  `,
})
export class Stock {
  private readonly api = inject(Api);
  private readonly prices = inject(Prices);
  private readonly toasts = inject(Toasts);
  protected readonly inr = inr;
  protected readonly percent = percent;
  protected readonly dir = direction;
  protected readonly text = value;
  protected readonly digits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 6);

  /** From the route: /markets/:symbol */
  readonly symbol = input.required<string>();

  protected readonly info = new Loader<Instrument>(() => this.api.get(`/marketdata/v1/instruments/${this.symbol()}`), false);
  private readonly holdings = new Loader<Holding[]>(async () => (await this.api.get<{ holdings: Holding[] }>('/oms/v1/holdings')).holdings);
  protected readonly range = signal<'day' | 'days'>('day');
  protected readonly candles = signal<Candle[]>([]);
  protected readonly side = signal<'BUY' | 'SELL'>('BUY');
  protected readonly qty = signal('1');
  protected readonly type = signal<'MARKET' | 'LIMIT'>('MARKET');
  protected readonly limit = signal('');
  protected readonly product = signal<'CNC' | 'MIS'>('CNC');
  protected readonly review = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly placed = signal<Order | null>(null);

  protected readonly quote = computed(() => this.prices.quotes()[this.symbol()]);
  protected readonly closes = computed(() => this.candles().map((c) => c.close));
  protected readonly held = computed(() => (this.holdings.value() ?? []).find((h) => h.symbol === this.symbol() && h.quantity > 0));
  protected readonly marketClosed = computed(() => this.prices.market()?.state === 'CLOSED');
  protected readonly estimate = computed(() => {
    const q = Number(this.qty());
    const price = this.type() === 'LIMIT' ? amountToApi(this.limit()) : this.quote() ? String(this.quote()!.last) : null;
    return price && q > 0 ? fromPaise(paise(price) * q) : null;
  });

  private key = Api.key();

  constructor() {
    let stream: { close(): void } | null = null;
    let current = '';
    effect(() => {
      const symbol = this.symbol();
      if (symbol === current) {
        return;
      }
      current = symbol;
      stream?.close();
      stream = this.prices.open([symbol]);
      this.placed.set(null);
      this.review.set(false);
      void this.info.reload();
      void this.loadCandles();
    });
    inject(DestroyRef).onDestroy(() => stream?.close());
  }

  /** Changing the order makes it a different order: a different attempt, so a different key. */
  protected edit(): void {
    this.review.set(false);
    this.key = Api.key();
  }

  protected setRange(r: 'day' | 'days'): void {
    this.range.set(r);
    void this.loadCandles();
  }

  private async loadCandles(): Promise<void> {
    try {
      const interval = this.range() === 'day' ? '1m' : '1d';
      const r = await this.api.get<{ candles: Candle[] }>(`/marketdata/v1/candles/${this.symbol()}`, { interval, limit: 300 });
      this.candles.set(r.candles);
    } catch {
      this.candles.set([]);
    }
  }

  protected statusText(o: Order): string {
    return { FILLED: 'Filled', OPEN: 'Waiting at your price', PENDING: 'Sent to the exchange', AMO_QUEUED: 'Queued for the open', REJECTED: 'Refused',
      CANCELLED: 'Cancelled', EXPIRED: 'Expired' }[o.status];
  }

  protected async place(): Promise<void> {
    const quantity = Number(this.qty());
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.error.set('Enter a whole number of shares, at least 1.');
      this.review.set(false);
      return;
    }
    const order: NewOrder & { variety?: string } = { symbol: this.symbol(), side: this.side(), quantity, orderType: this.type(), product: this.product() };
    if (this.type() === 'LIMIT') {
      const price = amountToApi(this.limit());
      if (price === null || Number(price) <= 0) {
        this.error.set('Enter your limit price, like 1450.50.');
        this.review.set(false);
        return;
      }
      order.limitPrice = price;
    }
    if (this.marketClosed()) {
      order.variety = 'AMO';
    }
    this.busy.set(true);
    this.error.set('');
    try {
      this.placed.set(await this.api.post<Order>('/oms/v1/orders', order, this.key));
      this.key = Api.key();   // done: the next order is a new attempt
      this.review.set(false);
      void this.holdings.reload();
      this.toasts.show('Order placed.');
    } catch (e) {
      this.error.set(messageOf(e));
      // Only when the outcome is unknown (no answer, or the server failed) is the key kept, so tapping Confirm again
      // finds the first attempt instead of placing a second. A definite refusal is a new attempt with a new key.
      if (e instanceof HttpErrorResponse && e.status > 0 && e.status < 500) {
        this.key = Api.key();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
