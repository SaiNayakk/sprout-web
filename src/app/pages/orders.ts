import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { inr } from '../core/money';
import { messageOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { Order } from '../core/types';
import { Pipeline } from '../ui/pipeline';
import { TourService } from '../ui/tour';
import { Status } from '../ui/status';

const WORKING = ['OPEN', 'PENDING', 'AMO_QUEUED'];

/** Every order, newest first, as a broker's order book shows them: refused orders are listed with the reason. */
@Component({
  selector: 'app-orders',
  imports: [RouterLink, Status, Pipeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="row between"><h1>Orders</h1><button class="btn secondary small" type="button" (click)="orders.reload()">Refresh</button></div>
      <app-status [loading]="orders.loading() && !orders.value()" [error]="orders.error()" (retry)="orders.reload()" />
      @if (orders.value(); as list) {
        @if (!list.length) {
          <div class="card empty"><p>No orders yet.</p><a class="btn" routerLink="/markets">Browse the market</a></div>
        } @else {
          <div class="stack">
            @for (o of list; track o.id) {
              <article class="card order" [attr.aria-labelledby]="'order-' + o.id">
                <div class="head">
                  <h2 class="what" [id]="'order-' + o.id">
                    <a class="sym" [routerLink]="['/markets', o.symbol]">{{ o.symbol }}</a>
                    <span class="side">{{ o.side === 'BUY' ? 'Buy' : 'Sell' }} <span class="num">{{ o.quantity }}</span> {{ o.quantity === 1 ? 'share' : 'shares' }}</span>
                  </h2>
                  <span class="chip" [class.bad]="o.status === 'REJECTED'" [class.plain]="o.status === 'CANCELLED' || o.status === 'EXPIRED'">{{ label(o) }}</span>
                </div>
                <p class="meta small muted">{{ meta(o) }}</p>

                @if (o.status === 'FILLED') {
                  <dl class="fill">
                    <div><dt>Price</dt><dd class="num">{{ inr(o.price) }}</dd></div>
                    <div><dt>Total</dt><dd class="num">{{ inr(o.value) }}</dd></div>
                    <div><dt>Charges</dt><dd class="num">{{ inr(o.charges?.total) }}</dd></div>
                  </dl>
                }
                @if (o.rejection) { <p class="error small reason">{{ o.rejection.message }}</p> }

                <div class="actions">
                  <button
                    class="toggle"
                    type="button"
                    [attr.aria-expanded]="isOpen(o.id)"
                    [attr.aria-controls]="'pipeline-' + o.id"
                    (click)="toggle(o.id)"
                  >
                    <svg class="chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    Track pipeline
                  </button>
                  @if (working(o)) {
                    <button class="btn secondary small" type="button" [disabled]="cancelling() === o.id" (click)="cancel(o)">Cancel order</button>
                  }
                </div>

                @if (isOpen(o.id)) {
                  <app-pipeline [attr.id]="'pipeline-' + o.id" [orderId]="o.id" [embedded]="true" />
                }
              </article>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .order { min-width: 0; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); min-width: 0; }
    .what {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-3);
      margin: 0; min-width: 0; font-size: var(--text-lg);
    }
    .sym { font-weight: 700; text-decoration: none; overflow-wrap: anywhere; }
    .sym:hover { text-decoration: underline; }
    .side { font-size: var(--text-sm); font-weight: 600; color: var(--ink-soft); white-space: nowrap; }
    .chip { flex-shrink: 0; }
    .meta { margin: var(--space-1) 0 0; }
    .fill { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-6); margin: var(--space-3) 0 0; }
    .fill dt { font-size: var(--text-xs); font-weight: 600; color: var(--ink-soft); }
    .fill dd { margin: 0; }
    .reason { margin: var(--space-2) 0 0; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-2); }
    .toggle {
      appearance: none; background: none; border: 0; cursor: pointer;
      display: inline-flex; align-items: center; gap: var(--space-1);
      min-height: 36px; padding: 0; margin-left: -2px;
      font: 600 var(--text-sm)/1 var(--text); color: var(--leaf-text);
      touch-action: manipulation;
    }
    .chev { transition: transform var(--duration-normal) var(--ease-out); }
    .toggle[aria-expanded='true'] .chev { transform: rotate(90deg); }
    @media (hover: hover) and (pointer: fine) {
      .toggle:hover { color: var(--leaf-deep); text-decoration: underline; text-underline-offset: 3px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .chev { transition: none; }
    }
  `,
})
export class Orders {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  private readonly tour = inject(TourService);
  protected readonly inr = inr;
  protected readonly cancelling = signal('');
  /** Orders whose pipeline is showing: several can be open, so opening one never moves the others. */
  protected readonly open = signal<ReadonlySet<string>>(new Set());
  protected readonly orders = new Loader<Order[]>(async () => (await this.api.get<{ orders: Order[] }>('/oms/v1/orders')).orders);

  constructor() {
    effect(() => {
      const placed = this.tour.placedOrderId();
      if (placed && this.tour.active() && this.tour.currentStep().id === 'pipeline') {
        this.open.update((s) => new Set(s).add(placed));
      }
    });
  }

  protected isOpen(id: string): boolean {
    return this.open().has(id);
  }

  protected toggle(id: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected working(o: Order): boolean {
    return WORKING.includes(o.status);
  }

  protected label(o: Order): string {
    return { FILLED: 'Filled', OPEN: 'Waiting', PENDING: 'Sent', AMO_QUEUED: 'Queued for the open', REJECTED: 'Refused', CANCELLED: 'Cancelled', EXPIRED: 'Expired' }[o.status];
  }

  /** One plain line: how it was placed, what for, and when. */
  protected meta(o: Order): string {
    const parts = [
      o.orderType === 'LIMIT' ? `Limit ${inr(o.limitPrice)}` : 'Market',
      o.product === 'CNC' ? 'Delivery' : 'Intraday',
    ];
    if (o.variety === 'AMO') parts.push('After market');
    if (o.tag?.startsWith('sip:')) parts.push('From a plan');
    if (o.tag?.startsWith('goal:')) parts.push('For a goal');
    parts.push(this.when(o.createdAt));
    return parts.join(' · ');
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  protected async cancel(o: Order): Promise<void> {
    this.cancelling.set(o.id);
    try {
      await this.api.delete(`/oms/v1/orders/${o.id}`);
      this.toasts.show('Order cancelled. The money set aside for it is back.');
      await this.orders.reload();
    } catch (e) {
      this.toasts.fail(messageOf(e));
    } finally {
      this.cancelling.set('');
    }
  }
}
