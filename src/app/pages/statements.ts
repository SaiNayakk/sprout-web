import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { inr } from '../core/money';
import { messageOf } from '../core/problem';
import { Market } from '../core/types';
import { Chg } from '../ui/chg';
import { Status } from '../ui/status';

interface NoteSummary { tradeDate: string; number: string; trades: number; net: string }
interface Note {
  number: string; tradeDate: string; broker: { name: string; registration: string };
  client: { name: string; clientCode: string; panMasked: string; dematAccount?: string };
  trades: { orderId: string; executedAt: string; symbol: string; side: string; product: string; quantity: number; price: string; value: string; charges: string }[];
  charges: { total: string }; bought: string; sold: string; net: string;
}
interface Funds { from: string; to: string; openingBalance: string; closingBalance: string; lines: { at: string; description: string; amount?: string; balance: string }[] }
interface Pnl { from: string; to: string; intraday: string; shortTerm: string; longTerm: string; total: string; charges: string; lines: { symbol: string; category: string; quantity: number; buyDate: string; sellDate: string; pnl: string }[] }
interface DematHolding { symbol: string; quantity: number; isin?: string }
interface Demat { dematAccount: string; asOf: string; holdings: DematHolding[] }

/** The records a real broker gives: contract notes, the funds statement, profit and loss as tax sees it, and the demat holdings. */
@Component({
  selector: 'app-statements',
  imports: [Status, Chg],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Statements</h1>
      <p class="muted small">Dates are market dates, which run fast in the demo.</p>
      <div class="row" role="tablist" aria-label="Statements">
        @for (t of tabs; track t.id) {
          <button class="btn small" [class.secondary]="tab() !== t.id" type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="open(t.id)">{{ t.label }}</button>
        }
      </div>

      @switch (tab()) {
        @case ('notes') {
          <app-status [loading]="notes.loading() && !notes.value()" [error]="notes.error()" (retry)="notes.reload()" />
          <div class="card scroll-x">
            <table>
              <thead><tr><th>Date</th><th>Number</th><th class="right">Trades</th><th class="right">Net</th><th></th></tr></thead>
              <tbody>
                @for (n of notes.value() ?? []; track n.number) {
                  <tr><td>{{ n.tradeDate }}</td><td class="mono small">{{ n.number }}</td><td class="right num">{{ n.trades }}</td><td class="right"><app-chg [amount]="n.net" /></td>
                    <td class="right"><button class="btn quiet small" type="button" (click)="note(n.tradeDate)">{{ detail()?.tradeDate === n.tradeDate ? 'Hide' : 'View' }}</button></td></tr>
                } @empty { @if (notes.value()) { <tr><td colspan="5" class="empty">No trades yet.</td></tr> } }
              </tbody>
            </table>
          </div>
          @if (detail(); as d) {
            <section class="card">
              <h2>Contract note {{ d.number }}</h2>
              <p class="small muted">{{ d.broker.name }} (registration {{ d.broker.registration }}, made up) · {{ d.client.name }}, client code {{ d.client.clientCode }}, PAN {{ d.client.panMasked }}@if (d.client.dematAccount) { , demat {{ d.client.dematAccount }} }</p>
              <div class="scroll-x"><table>
                <thead><tr><th>Share</th><th>Side</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Value</th><th class="right">Charges</th></tr></thead>
                <tbody>@for (t of d.trades; track t.orderId) {
                  <tr><td>{{ t.symbol }}</td><td>{{ t.side === 'BUY' ? 'Buy' : 'Sell' }} · {{ t.product === 'CNC' ? 'delivery' : 'intraday' }}</td><td class="right num">{{ t.quantity }}</td>
                    <td class="right num">{{ inr(t.price) }}</td><td class="right num">{{ inr(t.value) }}</td><td class="right num">{{ inr(t.charges) }}</td></tr>
                }</tbody>
              </table></div>
              <p class="small">Bought {{ inr(d.bought) }} · sold {{ inr(d.sold) }} · charges {{ inr(d.charges.total) }} · net <app-chg [amount]="d.net" /></p>
            </section>
          }
        }
        @case ('funds') {
          <app-status [loading]="funds.loading() && !funds.value()" [error]="funds.error()" (retry)="funds.reload()" />
          @if (funds.value(); as f) {
            <section class="card">
              <p class="small muted">{{ f.from }} to {{ f.to }} · opening {{ inr(f.openingBalance) }} · closing {{ inr(f.closingBalance) }}</p>
              <div class="scroll-x"><table>
                <thead><tr><th>When</th><th>What</th><th class="right">Balance</th></tr></thead>
                <tbody>@for (l of f.lines.slice(-40).reverse(); track $index) {
                  <tr><td class="small muted">{{ l.at.slice(0, 16).replace('T', ' ') }}</td><td>{{ l.description }}</td><td class="right num">{{ inr(l.balance) }}</td></tr>
                }</tbody>
              </table></div>
            </section>
          }
        }
        @case ('pnl') {
          <app-status [loading]="pnl.loading() && !pnl.value()" [error]="pnl.error()" (retry)="pnl.reload()" />
          @if (pnl.value(); as p) {
            <section class="card">
              <p class="small muted">{{ p.from }} to {{ p.to }}, as tax treats it</p>
              <div class="grid three">
                <div><span class="label">Intraday</span><p><app-chg [amount]="p.intraday" /></p></div>
                <div><span class="label">Short term</span><p><app-chg [amount]="p.shortTerm" /></p></div>
                <div><span class="label">Long term</span><p><app-chg [amount]="p.longTerm" /></p></div>
              </div>
              <p>Total <app-chg [amount]="p.total" /> <span class="small muted">· charges {{ inr(p.charges) }}</span></p>
              <div class="scroll-x"><table>
                <thead><tr><th>Share</th><th>Type</th><th class="right">Qty</th><th>Bought → sold</th><th class="right">Gain / loss</th></tr></thead>
                <tbody>@for (l of p.lines; track $index) {
                  <tr><td>{{ l.symbol }}</td><td class="small">{{ l.category.replace('_', ' ').toLowerCase() }}</td><td class="right num">{{ l.quantity }}</td><td class="small">{{ l.buyDate }} → {{ l.sellDate }}</td><td class="right"><app-chg [amount]="l.pnl" /></td></tr>
                } @empty { <tr><td colspan="5" class="empty">No sales yet, so no realised gains.</td></tr> }</tbody>
              </table></div>
            </section>
          }
        }
        @case ('demat') {
          <app-status [loading]="demat.loading() && !demat.value()" [error]="demat.error()" (retry)="demat.reload()" />
          @if (demat.value(); as d) {
            <section class="card">
              <p class="small muted">Demat account <span class="mono">{{ d.dematAccount }}</span> at the Sprout Depository, as of {{ d.asOf.slice(0, 16).replace('T', ' ') }}. Shares bought today arrive next session.</p>
              <table><thead><tr><th>Share</th><th class="right">Held</th></tr></thead>
                <tbody>@for (h of d.holdings; track h.symbol) { <tr><td>{{ h.symbol }}</td><td class="right num">{{ h.quantity }}</td></tr> }
                  @empty { <tr><td colspan="2" class="empty">Nothing delivered yet.</td></tr> }</tbody></table>
            </section>
          }
        }
      }
    </div>
  `,
})
export class Statements {
  private readonly api = inject(Api);
  protected readonly inr = inr;
  protected readonly tabs = [
    { id: 'notes', label: 'Contract notes' }, { id: 'funds', label: 'Funds' }, { id: 'pnl', label: 'Profit and loss' }, { id: 'demat', label: 'Demat' },
  ] as const;
  protected readonly tab = signal<'notes' | 'funds' | 'pnl' | 'demat'>('notes');
  protected readonly detail = signal<Note | null>(null);

  private readonly range = new Loader<{ from: string; to: string }>(async () => {
    const m = await this.api.get<Market>('/marketdata/v1/market');
    return { from: shift(m.sessionDate, -365), to: m.sessionDate };
  });
  protected readonly notes = new Loader<NoteSummary[]>(async () => (await this.api.get<{ contractNotes: NoteSummary[] }>('/statements/v1/contract-notes')).contractNotes);
  protected readonly funds = new Loader<Funds>(async () => this.api.get('/statements/v1/funds-statement', await this.dates()), false);
  protected readonly pnl = new Loader<Pnl>(async () => this.api.get('/statements/v1/pnl', await this.dates()), false);
  protected readonly demat = new Loader<Demat>(() => this.api.get('/statements/v1/holdings-statement'), false);

  protected open(t: 'notes' | 'funds' | 'pnl' | 'demat'): void {
    this.tab.set(t);
    const l = { notes: this.notes, funds: this.funds, pnl: this.pnl, demat: this.demat }[t];
    if (l.value() === null) {
      void l.reload();
    }
  }

  protected async note(date: string): Promise<void> {
    if (this.detail()?.tradeDate === date) {
      this.detail.set(null);
      return;
    }
    try {
      this.detail.set(await this.api.get<Note>(`/statements/v1/contract-notes/${date}`));
    } catch (e) {
      this.notes.error.set(messageOf(e));
    }
  }

  private async dates(): Promise<{ from: string; to: string }> {
    if (this.range.value() === null) {
      await this.range.reload();
    }
    return this.range.value()!;
  }
}

/** A date (YYYY-MM-DD) moved by whole days, with no time zone in the way. */
export function shift(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
