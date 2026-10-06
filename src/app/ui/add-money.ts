import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Api } from '../core/api';
import { amountToApi, inr } from '../core/money';
import { codeOf, messageOf, problemOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { CollectRequest, Deposit } from '../core/types';
import { value } from './dom';

/**
 * Adding money is two steps in two places, the way UPI really works: Sprout asks the customer's bank
 * for the money, and the customer approves in the bank with their UPI PIN. The key for the ask is made
 * once per attempt and kept, so tapping twice (or retrying after a dropped connection) asks only once.
 */
@Component({
  selector: 'app-add-money',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (step()) {
      @case ('amount') {
        <form (submit)="$event.preventDefault(); ask()" novalidate>
          <div class="field">
            <label for="amount">Amount to add (₹1 to ₹1,00,000)</label>
            <input id="amount" inputmode="decimal" placeholder="5,000" [value]="amount()" (input)="amount.set(text($event))" />
          </div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Asking your bank…' : 'Add money' }}</button>
        </form>
      }
      @case ('approve') {
        <form (submit)="$event.preventDefault(); approve()" novalidate>
          <div class="card soft">
            <p class="label">Sprout Bank, your bank</p>
            <p><strong>{{ request()?.payeeName }}</strong> is asking for <span class="num">{{ inr(request()?.amount) }}</span>.</p>
            <p class="small muted">Approve it with your UPI PIN. It waits for you for a few minutes.</p>
          </div>
          <div class="field" style="margin-top:.9rem">
            <label for="pin">UPI PIN</label>
            <input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" [value]="pin()" (input)="pin.set(digits($event))" />
          </div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <div class="row">
            <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Paying…' : 'Pay ' + inr(request()?.amount) }}</button>
            <button class="btn secondary" type="button" [disabled]="busy()" (click)="decline()">Decline</button>
          </div>
        </form>
      }
      @case ('waiting') {
        <p role="status">Paid. Waiting for Sprout to credit your balance…</p>
      }
      @case ('done') {
        <p role="status"><strong>Added.</strong> The money is in your Sprout balance.</p>
        <button class="btn secondary small" type="button" (click)="again()">Add more</button>
      }
    }
  `,
})
export class AddMoney {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  /** Fires once the money has reached the Sprout balance. */
  readonly added = output<void>();

  protected readonly step = signal<'amount' | 'approve' | 'waiting' | 'done'>('amount');
  protected readonly amount = signal('');
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly request = signal<CollectRequest | null>(null);
  protected readonly inr = inr;
  protected readonly text = value;
  protected readonly digits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 6);

  private key = Api.key();
  private deposit: Deposit | null = null;

  protected async ask(): Promise<void> {
    const amount = amountToApi(this.amount());
    if (amount === null || Number(amount) < 1 || Number(amount) > 100000) {
      this.error.set('Enter an amount between ₹1 and ₹1,00,000.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      this.deposit = await this.api.post<Deposit>('/payments/v1/deposits', { amount }, this.key);
      if (this.deposit.status === 'FAILED') {
        this.error.set(this.deposit.failureReason ?? 'Your bank couldn’t be reached. Nothing was taken; try again.');
        this.key = Api.key();   // a new attempt, a new key
        return;
      }
      const waiting = await this.api.get<{ requests: CollectRequest[] }>('/bank/v1/requests', { status: 'PENDING' });
      const mine = waiting.requests.find((r) => Number(r.amount) === Number(amount));
      if (!mine) {
        this.error.set('Your bank hasn’t received the request yet. Wait a moment and try again.');
        return;
      }
      this.request.set(mine);
      this.step.set('approve');
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async approve(): Promise<void> {
    const r = this.request();
    if (!r) {
      return;
    }
    if (this.pin().length < 4) {
      this.error.set('Your UPI PIN is 4 or 6 digits.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post(`/bank/v1/requests/${r.id}/approve`, { upiPin: this.pin() });
      this.pin.set('');
      this.step.set('waiting');
      await this.untilCredited();
    } catch (e) {
      const p = problemOf(e);
      this.pin.set('');
      this.error.set(
        codeOf(e) === 'INVALID_PIN' && p?.attemptsLeft !== undefined ? `That PIN is wrong. ${p.attemptsLeft} tries left before approvals lock.` : messageOf(e),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async decline(): Promise<void> {
    const r = this.request();
    if (r) {
      try {
        await this.api.post(`/bank/v1/requests/${r.id}/decline`);
      } catch {
        // it will lapse by itself
      }
    }
    this.reset();
  }

  protected again(): void {
    this.reset();
  }

  /** The bank tells Sprout, and Sprout credits the balance, a moment after the approval. */
  private async untilCredited(): Promise<void> {
    for (let i = 0; i < 25; i++) {
      const d = await this.api.get<Deposit>(`/payments/v1/deposits/${this.deposit!.id}`);
      if (d.status === 'COMPLETED') {
        this.step.set('done');
        this.toasts.show(`${inr(d.amount)} added to your balance.`);
        this.added.emit();
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    this.step.set('done');   // the money is safe either way: Sprout keeps checking with the bank
    this.toasts.show('Paid. Your balance will update in a moment.');
    this.added.emit();
  }

  private reset(): void {
    this.step.set('amount');
    this.amount.set('');
    this.pin.set('');
    this.error.set('');
    this.request.set(null);
    this.key = Api.key();
  }
}
