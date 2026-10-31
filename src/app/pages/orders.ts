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
              <article class="card">
                <div class="row between">
                  <h2><a [routerLink]="['/markets', o.symbol]">{{ o.symbol }}</a>
                    <span class="small muted">{{ o.side === 'BUY' ? 'Buy' : 'Sell' }} <span class="num">{{ o.quantity }}</span></span></h2>
                  <span class="chip" [class.bad]="o.status === 'REJECTED'" [class.plain]="o.status === 'CANCELLED' || o.status === 'EXPIRED'">{{ label(o) }}</span>
                </div>
                <p class="small muted">
                  {{ o.orderType === 'LIMIT' ? 'Limit ' : 'Market' }}@if (o.orderType === 'LIMIT') { <span class="num">{{ inr(o.limitPrice) }}</span> } · {{ o.product === 'CNC' ? 'Delivery' : 'Intraday' }}
                  @if (o.variety === 'AMO') { · After market }
                  @if (o.tag?.startsWith('sip:')) { · <span class="chip plain">Plan</span> }
                  @if (o.tag?.startsWith('goal:')) { · <span class="chip plain">Goal</span> }
                  · {{ when(o.createdAt) }}
                </p>
                @if (o.status === 'FILLED') {
                  <p class="num">{{ inr(o.price) }} each · {{ inr(o.value) }} <span class="muted small">+ <span class="num">{{ inr(o.charges?.total) }}</span> charges</span></p>
                }
                @if (o.rejection) { <p class="error small">{{ o.rejection.message }}</p> }

                <div class="row" style="margin-top:var(--space-2)">
                  <button
                    class="btn quiet small"
                    type="button"
                    (click)="activeTraceId.set(activeTraceId() === o.id ? null : o.id)"
                  >
                    {{ activeTraceId() === o.id ? 'Hide pipeline' : 'Track pipeline' }}
                  </button>
                  @if (working(o)) {
                    <button class="btn secondary small" type="button" [disabled]="cancelling() === o.id" (click)="cancel(o)">Cancel order</button>
                  }
                </div>

                @if (activeTraceId() === o.id) {
                  <app-pipeline [orderId]="o.id" (closed)="activeTraceId.set(null)" />
                }
              </article>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    article.card { min-width: 0; }
    .card h2 { min-width: 0; overflow-wrap: anywhere; }
    .chip { flex-shrink: 0; }
  `,
})
export class Orders {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  private readonly tour = inject(TourService);
  protected readonly inr = inr;
  protected readonly cancelling = signal('');
  protected readonly activeTraceId = signal<string | null>(null);
  protected readonly orders = new Loader<Order[]>(async () => (await this.api.get<{ orders: Order[] }>('/oms/v1/orders')).orders);

  constructor() {
    effect(() => {
      const placed = this.tour.placedOrderId();
      if (placed && this.tour.active() && this.tour.currentStep().id === 'pipeline') {
        this.activeTraceId.set(placed);
      }
    });
  }

  protected working(o: Order): boolean {
    return WORKING.includes(o.status);
  }

  protected label(o: Order): string {
    return { FILLED: 'Filled', OPEN: 'Waiting', PENDING: 'Sent', AMO_QUEUED: 'Queued for the open', REJECTED: 'Refused', CANCELLED: 'Cancelled', EXPIRED: 'Expired' }[o.status];
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
