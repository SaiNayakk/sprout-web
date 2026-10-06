import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { messageOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { Redemption, Referrals, Vault } from '../core/types';
import { value } from '../ui/dom';
import { Status } from '../ui/status';

/** What vested habit points buy (the brands are fictional), and rewards for friends who invest, not just sign up. */
@Component({
  selector: 'app-rewards',
  imports: [Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Rewards</h1>
      <app-status [loading]="vault.loading() && !vault.value()" [error]="vault.error()" (retry)="vault.reload()" />
      @if (vault.value(); as v) {
        <section class="card reward">
          <p class="label">Points to spend</p>
          <p class="big">★ {{ v.balance.available }}</p>
          <p class="small muted">
            {{ v.balance.habitPoints }} from your habit@if (v.balance.referralPoints) { , {{ v.balance.referralPoints }} from friends }
            @if (v.balance.spent) { , {{ v.balance.spent }} spent }
            @if (v.balance.pending) { · {{ v.balance.pending }} more are vesting: points vest 30 days after you invest, if the shares are still yours. }
          </p>
        </section>

        <h2>The vault</h2>
        <p class="small muted">The shops and charities here are fictional: Sprout has no real partners.</p>
        <div class="grid three">
          @for (i of v.items; track i.code) {
            <article class="card">
              <p class="label">{{ i.kind === 'VOUCHER' ? 'Voucher' : i.kind === 'THEME' ? 'App theme' : 'Donation' }}</p>
              <h3>{{ i.name }}</h3>
              <p class="small muted">{{ i.brand }}</p>
              <p><span class="chip reward">★ {{ i.points }}</span></p>
              <button class="btn small" type="button" [disabled]="!i.affordable || busy() === i.code" (click)="redeem(i.code, i.name)">
                {{ busy() === i.code ? 'Redeeming…' : i.affordable ? 'Redeem' : 'Not enough yet' }}
              </button>
            </article>
          }
        </div>
      }

      @if (redemptions.value()?.length) {
        <section class="card">
          <h2>What you've redeemed</h2>
          @for (r of redemptions.value() ?? []; track r.id) {
            <p class="row between small"><span>{{ r.name }}@if (r.voucherCode) { · code <strong class="mono">{{ r.voucherCode }}</strong> }</span><span class="muted">★ {{ r.points }}</span></p>
          }
        </section>
      }

      <section class="card" aria-labelledby="ref-h">
        <h2 id="ref-h">Bring a friend</h2>
        <p class="small muted">Nothing is earned for signing up. When a friend has invested in 3 different months, you both get 500 points: it rewards the habit.</p>
        <app-status [loading]="referrals.loading() && !referrals.value()" [error]="referrals.error()" (retry)="referrals.reload()" />
        @if (referrals.value(); as r) {
          <p>Your code <strong class="mono big-code">{{ r.code }}</strong></p>
          @for (f of r.friends; track $index) {
            <p class="small row between"><span>Friend who joined {{ f.joinedOn }}</span><span class="chip" [class.reward]="f.rewarded" [class.plain]="!f.rewarded">{{ f.rewarded ? '★ 500 each' : f.monthsInvested + ' of 3 months' }}</span></p>
          }
          @if (r.referredBy) {
            <p class="small muted">You joined with the code {{ r.referredBy }}.</p>
          } @else {
            <form class="row" (submit)="$event.preventDefault(); claim()" novalidate>
              <input aria-label="A friend's code" placeholder="A friend's code (SPR-…)" style="max-width:15rem" [value]="code()" (input)="code.set(text($event))" />
              <button class="btn secondary small" type="submit">Use code</button>
            </form>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <p class="hint">A friend's code can be entered in your first 30 days.</p>
          }
        }
      </section>
    </div>
  `,
  styles: '.big-code { font-size: 1.2rem; letter-spacing: .05em; }',
})
export class Rewards {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly text = value;

  protected readonly vault = new Loader<Vault>(() => this.api.get('/rewards/v1/vault'));
  protected readonly redemptions = new Loader<Redemption[]>(async () => (await this.api.get<{ redemptions: Redemption[] }>('/rewards/v1/redemptions')).redemptions);
  protected readonly referrals = new Loader<Referrals>(() => this.api.get('/rewards/v1/referrals/me'));
  protected readonly busy = signal('');
  protected readonly code = signal('');
  protected readonly error = signal('');
  private readonly keys = new Map<string, string>();

  protected async redeem(code: string, name: string): Promise<void> {
    if (!confirm(`Redeem ${name}? The points are taken now.`)) {
      return;
    }
    let key = this.keys.get(code);
    if (!key) {
      key = Api.key();
      this.keys.set(code, key);
    }
    this.busy.set(code);
    try {
      const r = await this.api.post<Redemption>('/rewards/v1/redemptions', { itemCode: code }, key);
      this.keys.delete(code);
      this.toasts.show(r.voucherCode ? `Redeemed. Your code is ${r.voucherCode}.` : 'Redeemed.');
      await Promise.all([this.vault.reload(), this.redemptions.reload()]);
    } catch (e) {
      this.toasts.fail(messageOf(e));
    } finally {
      this.busy.set('');
    }
  }

  protected async claim(): Promise<void> {
    this.error.set('');
    try {
      await this.api.post('/rewards/v1/referrals/claim', { code: this.code().trim() });
      this.toasts.show('You and your friend are linked.');
      await this.referrals.reload();
    } catch (e) {
      this.error.set(messageOf(e));
    }
  }
}
