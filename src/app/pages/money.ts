import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { amountToApi, inr } from '../core/money';
import { messageOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { BankAccount, Deposit, Funds, Transaction, Withdrawal } from '../core/types';
import { AddMoney } from '../ui/add-money';
import { AutoPayCard } from '../ui/autopay';
import { value } from '../ui/dom';
import { Status } from '../ui/status';
import { UpiPay } from '../ui/upi-pay';

/** Money in and out of Sprout, and Sprout Bank (the pretend bank: spend with UPI, give AutoPay permission). */
@Component({
  selector: 'app-money',
  imports: [AddMoney, UpiPay, AutoPayCard, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Money</h1>
      <div class="grid two">
        <section class="card" aria-labelledby="sp-h">
          <h2 id="sp-h" class="label">In Sprout</h2>
          <app-status [loading]="funds.loading() && !funds.value()" [error]="funds.error()" (retry)="funds.reload()" />
          @if (funds.value(); as f) {
            <p class="big">{{ inr(f.cash) }}</p>
            <p class="small muted">Set aside for orders {{ inr(f.blocked) }} · arriving after a sale {{ inr(f.unsettled) }}</p>
          }
        </section>
        <section class="card" aria-labelledby="bk-h">
          <h2 id="bk-h" class="label">In Sprout Bank</h2>
          <app-status [loading]="bank.loading() && !bank.value()" [error]="bank.error()" (retry)="bank.reload()" />
          @if (bank.value(); as b) {
            <p class="big">{{ inr(b.balance) }}</p>
            <p class="small muted mono">{{ b.vpa }}</p>
          }
        </section>
      </div>

      <div class="grid two">
        <section class="card" aria-labelledby="add-h">
          <h2 id="add-h">Add money to Sprout</h2>
          <app-add-money (added)="refresh()" />
        </section>

        <section class="card" aria-labelledby="out-h">
          <h2 id="out-h">Take money back to your bank</h2>
          <form (submit)="$event.preventDefault(); withdraw()" novalidate>
            <div class="field"><label for="wamount">Amount (₹)</label>
              <input id="wamount" inputmode="decimal" [value]="wamount()" (input)="wamount.set(text($event))" /></div>
            @if (werror()) { <p class="error" role="alert">{{ werror() }}</p> }
            <button class="btn secondary" type="submit" [disabled]="wbusy()">{{ wbusy() ? 'Sending…' : 'Withdraw' }}</button>
            <p class="hint">Money from a sale is available to withdraw once the trade settles, the next session.</p>
          </form>
        </section>
      </div>

      <div class="grid two">
        <section class="card" aria-labelledby="upi-h">
          <h2 id="upi-h">Pay with UPI</h2>
          <p class="small muted">Pay a shop from your bank. With round-ups on, the change is saved towards a goal.</p>
          <app-upi-pay (paid)="refresh()" />
        </section>
        <section class="card reward" aria-labelledby="ap-h">
          <h2 id="ap-h">AutoPay for round-ups</h2>
          <app-autopay (changed)="refresh()" />
        </section>
      </div>

      <section class="card" aria-labelledby="tx-h">
        <h2 id="tx-h">Recent bank activity</h2>
        <app-status [loading]="txns.loading() && !txns.value()" [error]="txns.error()" (retry)="txns.reload()" />
        @if (txns.value(); as list) {
          <div class="scroll-x"><table>
            <thead><tr><th>When</th><th>What</th><th class="right">Amount</th><th class="right">Balance</th></tr></thead>
            <tbody>
              @for (t of list.slice(0, 12); track t.id) {
                <tr>
                  <td class="small muted">{{ when(t.at) }}</td>
                  <td>{{ t.description }}</td>
                  <td class="right num" [class.gain]="t.direction === 'IN'" [class.loss]="t.direction === 'OUT'">{{ t.direction === 'IN' ? '+' : '−' }}{{ inr(t.amount) }}</td>
                  <td class="right num muted">{{ inr(t.balanceAfter) }}</td>
                </tr>
              }
            </tbody>
          </table></div>
        }
      </section>

      <section class="card" aria-labelledby="mv-h">
        <h2 id="mv-h">Added and withdrawn</h2>
        @for (d of deposits.value() ?? []; track d.id) {
          <p class="small row between"><span>Added {{ inr(d.amount) }} · {{ when(d.createdAt) }}</span><span class="chip" [class.bad]="d.status === 'FAILED'" [class.plain]="d.status !== 'COMPLETED' && d.status !== 'FAILED'">{{ statusOf(d.status) }}</span></p>
        }
        @for (w of withdrawals.value() ?? []; track w.id) {
          <p class="small row between"><span>Withdrew {{ inr(w.amount) }} · {{ when(w.createdAt) }}</span><span class="chip" [class.bad]="w.status === 'FAILED'" [class.plain]="w.status === 'PROCESSING'">{{ statusOf(w.status) }}</span></p>
        }
      </section>
    </div>
  `,
})
export class Money {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly inr = inr;
  protected readonly text = value;

  protected readonly funds = new Loader<Funds>(() => this.api.get('/oms/v1/funds'));
  protected readonly bank = new Loader<BankAccount>(() => this.api.get('/bank/v1/accounts/me'));
  protected readonly txns = new Loader<Transaction[]>(async () => (await this.api.get<{ transactions: Transaction[] }>('/bank/v1/transactions')).transactions);
  protected readonly deposits = new Loader<Deposit[]>(async () => (await this.api.get<{ deposits: Deposit[] }>('/payments/v1/deposits')).deposits.slice(0, 6));
  protected readonly withdrawals = new Loader<Withdrawal[]>(async () => (await this.api.get<{ withdrawals: Withdrawal[] }>('/payments/v1/withdrawals')).withdrawals.slice(0, 6));

  protected readonly wamount = signal('');
  protected readonly wbusy = signal(false);
  protected readonly werror = signal('');
  private wkey = Api.key();

  protected refresh(): void {
    void this.funds.reload();
    void this.bank.reload();
    void this.txns.reload();
    void this.deposits.reload();
    void this.withdrawals.reload();
  }

  protected async withdraw(): Promise<void> {
    const amount = amountToApi(this.wamount());
    if (amount === null || Number(amount) < 1 || Number(amount) > 100000) {
      this.werror.set('Enter an amount between ₹1 and ₹1,00,000.');
      return;
    }
    this.wbusy.set(true);
    this.werror.set('');
    try {
      const w = await this.api.post<Withdrawal>('/payments/v1/withdrawals', { amount }, this.wkey);
      this.wkey = Api.key();
      this.wamount.set('');
      this.toasts.show(w.status === 'COMPLETED' ? `${inr(amount)} is back in your bank.` : `${inr(amount)} is on its way to your bank.`);
      this.refresh();
    } catch (e) {
      this.werror.set(messageOf(e));
    } finally {
      this.wbusy.set(false);
    }
  }

  protected statusOf(s: string): string {
    return { COMPLETED: 'Done', AWAITING_APPROVAL: 'Waiting for your PIN', DECLINED: 'Declined', EXPIRED: 'Expired', FAILED: 'Failed', PROCESSING: 'On its way' }[s] ?? s;
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
