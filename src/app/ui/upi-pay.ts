import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { amountToApi, inr } from '../core/money';
import { codeOf, messageOf, problemOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { Merchant, Transaction } from '../core/types';
import { value } from './dom';

/** Pay one of the fictional shops by UPI, with the PIN. Spends like these are what round-ups are made from. */
@Component({
  selector: 'app-upi-pay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="$event.preventDefault(); pay()" novalidate>
      <div class="field"><label for="who">Pay</label>
        <select id="who" [value]="payee()" (change)="payee.set(text($event))">
          <option value="">Choose a shop</option>
          @for (m of merchants.value() ?? []; track m.vpa) {
            <option [value]="m.vpa" [selected]="m.vpa === payee()">{{ m.name }} · {{ m.category }}</option>
          }
        </select></div>
      <div class="field"><label for="pamount">Amount (₹)</label>
        <input id="pamount" inputmode="decimal" placeholder="46" [value]="amount()" (input)="amount.set(text($event))" /></div>
      <div class="field"><label for="ppin">UPI PIN</label>
        <input id="ppin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" [value]="pin()" (input)="pin.set(digits($event))" /></div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Paying…' : 'Pay' }}</button>
    </form>
  `,
})
export class UpiPay {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly paid = output<Transaction>();

  protected readonly merchants = new Loader<Merchant[]>(async () => (await this.api.get<{ merchants: Merchant[] }>('/bank/v1/merchants')).merchants);
  protected readonly payee = signal('');
  protected readonly amount = signal('');
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly text = value;
  protected readonly digits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 6);

  protected async pay(): Promise<void> {
    const amount = amountToApi(this.amount());
    if (!this.payee() || amount === null || Number(amount) <= 0 || this.pin().length < 4) {
      this.error.set('Choose a shop, an amount and enter your UPI PIN.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const t = await this.api.post<Transaction>('/bank/v1/payments', { payeeVpa: this.payee(), amount, upiPin: this.pin() });
      this.toasts.show(`Paid ${inr(amount)}.`);
      this.amount.set('');
      this.paid.emit(t);
    } catch (e) {
      const p = problemOf(e);
      this.error.set(codeOf(e) === 'INVALID_PIN' && p?.attemptsLeft !== undefined ? `That PIN is wrong. ${p.attemptsLeft} tries left.` : messageOf(e));
    } finally {
      this.pin.set('');
      this.busy.set(false);
    }
  }
}
