import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { Api } from '../core/api';
import { amountToApi, inr } from '../core/money';
import { codeOf, messageOf, problemOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { AutoPay, BankMandate } from '../core/types';
import { value } from './dom';

/**
 * AutoPay is standing permission from the customer's bank, like UPI AutoPay: asked by Sprout, approved
 * once in the bank with the PIN, limited per debit, and the customer can withdraw it at any time.
 */
@Component({
  selector: 'app-autopay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loaded()) {
      @switch (state()) {
        @case ('none') {
          <p class="small muted">Round-ups need your bank's permission to take small amounts. You approve it once, with your PIN, and can withdraw it any time.</p>
          <form (submit)="$event.preventDefault(); setUp()" novalidate>
            <div class="field"><label for="limit">Most Sprout may take at a time (₹100 to ₹10,000)</label>
              <input id="limit" inputmode="decimal" placeholder="1,000" [value]="limit()" (input)="limit.set(text($event))" /></div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Asking your bank…' : 'Set up AutoPay' }}</button>
          </form>
        }
        @case ('waiting') {
          @if (pending(); as m) {
            <div class="card soft">
              <p class="label">Your bank is asking</p>
              <p><strong>{{ m.payeeName }}</strong> would like to take up to <span class="num">{{ inr(m.maxAmount) }}</span> at a time.</p>
              <p class="small">Purpose: {{ m.purpose }}</p>
              @if (m.shareSpends) { <p class="small">It will also be told about each UPI payment you make, so it can round them up.</p> }
            </div>
            <form (submit)="$event.preventDefault(); approve(m)" novalidate style="margin-top:.8rem">
              <div class="field"><label for="apin">UPI PIN</label>
                <input id="apin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" [value]="pin()" (input)="pin.set(digits($event))" /></div>
              @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
              <div class="row">
                <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Approving…' : 'Approve' }}</button>
                <button class="btn secondary" type="button" [disabled]="busy()" (click)="decline(m)">Decline</button>
              </div>
            </form>
          } @else {
            <p class="muted">Waiting for your bank…</p>
          }
        }
        @case ('active') {
          <p><span class="chip">Active</span> Up to <span class="num">{{ inr(mine()?.maxAmount) }}</span> at a time.</p>
          <button class="btn secondary small" type="button" [disabled]="busy()" (click)="revoke()">Withdraw permission</button>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        }
      }
    } @else {
      <p class="muted" role="status">Loading…</p>
    }
  `,
})
export class AutoPayCard implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  readonly changed = output<void>();

  protected readonly inr = inr;
  protected readonly text = value;
  protected readonly digits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 6);
  protected readonly loaded = signal(false);
  protected readonly mine = signal<AutoPay | null>(null);
  protected readonly pending = signal<BankMandate | null>(null);
  protected readonly limit = signal('1000');
  protected readonly pin = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private key = Api.key();

  protected state(): 'none' | 'waiting' | 'active' {
    const s = this.mine()?.status;
    return s === 'ACTIVE' ? 'active' : s === 'AWAITING_APPROVAL' ? 'waiting' : 'none';
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();
    this.loaded.set(true);
  }

  private async refresh(): Promise<void> {
    try {
      this.mine.set(await this.api.get<AutoPay>('/payments/v1/mandates/me'));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        this.mine.set(null);
      } else {
        this.error.set(messageOf(e));
      }
    }
    if (this.state() === 'waiting') {
      const l = await this.api.get<{ mandates: BankMandate[] }>('/bank/v1/mandates', { status: 'PENDING' });
      this.pending.set(l.mandates[0] ?? null);
    }
  }

  protected async setUp(): Promise<void> {
    const max = amountToApi(this.limit());
    if (max === null || Number(max) < 100 || Number(max) > 10000) {
      this.error.set('Choose a limit between ₹100 and ₹10,000.');
      return;
    }
    await this.guarded(async () => {
      this.mine.set(await this.api.post<AutoPay>('/payments/v1/mandates', { maxAmount: max }, this.key));
      this.key = Api.key();
      await this.refresh();
    });
  }

  protected async approve(m: BankMandate): Promise<void> {
    if (this.pin().length < 4) {
      this.error.set('Your UPI PIN is 4 or 6 digits.');
      return;
    }
    await this.guarded(async () => {
      try {
        await this.api.post(`/bank/v1/mandates/${m.id}/approve`, { upiPin: this.pin() });
      } finally {
        this.pin.set('');
      }
      this.toasts.show('AutoPay is on.');
      for (let i = 0; i < 15 && this.state() !== 'active'; i++) {
        await new Promise((r) => setTimeout(r, 800));   // the bank tells Sprout a moment after you approve
        await this.refresh();
      }
      this.changed.emit();
    });
  }

  protected async decline(m: BankMandate): Promise<void> {
    await this.guarded(async () => {
      await this.api.post(`/bank/v1/mandates/${m.id}/decline`);
      this.pending.set(null);
      this.mine.set(null);
      this.changed.emit();
    });
  }

  protected async revoke(): Promise<void> {
    await this.guarded(async () => {
      const active = await this.api.get<{ mandates: BankMandate[] }>('/bank/v1/mandates', { status: 'ACTIVE' });
      for (const m of active.mandates) {
        await this.api.post(`/bank/v1/mandates/${m.id}/revoke`);
      }
      this.toasts.show('AutoPay withdrawn. Round-ups will wait.');
      this.mine.set(null);
      this.changed.emit();
    });
  }

  private async guarded(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      const p = problemOf(e);
      this.error.set(codeOf(e) === 'INVALID_PIN' && p?.attemptsLeft !== undefined ? `That PIN is wrong. ${p.attemptsLeft} tries left.` : messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }
}
