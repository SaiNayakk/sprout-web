import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { amountToApi, inr } from '../core/money';
import { messageOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { Instrument, Plan } from '../core/types';
import { value } from '../ui/dom';
import { Status } from '../ui/status';

/** A monthly plan: a fixed amount into a share on the day you choose. The habit Sprout is built to grow. */
@Component({
  selector: 'app-plans',
  imports: [RouterLink, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Plans</h1>
      <p class="muted">Invest a fixed amount every month. Each instalment buys as many whole shares as the amount covers. A month that can't buy
        (not enough money, or the amount is less than one share) is skipped and noted, never bought late.</p>

      <div class="grid two">
        <section class="card" aria-labelledby="new-h">
          <h2 id="new-h">Start a plan</h2>
          <form (submit)="$event.preventDefault(); start()" novalidate>
            <div class="field"><label for="sym">Share</label>
              <select id="sym" [value]="symbol()" (change)="symbol.set(text($event))">
                <option value="">Choose a share</option>
                @for (i of tradable(); track i.symbol) { <option [value]="i.symbol" [selected]="i.symbol === symbol()">{{ i.symbol }} · {{ i.name }}</option> }
              </select></div>
            <div class="field"><label for="amt">Amount each month (₹100 to ₹1,00,000)</label>
              <input id="amt" inputmode="decimal" placeholder="2,000" [value]="amount()" (input)="amount.set(text($event))" /></div>
            <div class="field"><label for="day">Day of the month (1 to 28)</label>
              <input id="day" inputmode="numeric" [value]="day()" (input)="day.set(dayDigits($event))" /></div>
            <div class="field"><label class="row"><input type="checkbox" [checked]="now()" (change)="now.set(!now())" /> Make the first instalment now</label></div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Starting…' : 'Start plan' }}</button>
          </form>
        </section>

        <section class="card soft">
          <h2>Why a plan?</h2>
          <p class="small">Investing the same amount regularly means you buy more when prices are low and less when they are high, and you never have to pick a moment.
            Every month with a plan instalment also builds your streak and earns points.</p>
          <a routerLink="/habits" class="btn secondary small">See your habit</a>
        </section>
      </div>

      <app-status [loading]="plans.loading() && !plans.value()" [error]="plans.error()" (retry)="plans.reload()" />
      <div class="stack">
        @for (p of plans.value() ?? []; track p.id) {
          <article class="card">
            <div class="row between">
              <h2><a [routerLink]="['/markets', p.symbol]">{{ p.symbol }}</a> <span class="small muted">{{ inr(p.amount, true) }} a month, on day {{ p.dayOfMonth }}</span></h2>
              <span class="chip" [class.plain]="p.status !== 'ACTIVE'">{{ p.status === 'ACTIVE' ? 'Active' : p.status === 'PAUSED' ? 'Paused' : 'Stopped' }}</span>
            </div>
            @if (p.nextDue && p.status === 'ACTIVE') { <p class="small muted">Next instalment: {{ p.nextDue }}</p> }
            @if (p.invested) { <p class="small">Invested so far <span class="num">{{ inr(p.invested) }}</span></p> }
            @if (p.instalments.length) {
              <div class="scroll-x"><table>
                <thead><tr><th>Month</th><th>What happened</th></tr></thead>
                <tbody>
                  @for (x of p.instalments.slice(0, 6); track x.month) {
                    <tr><td class="mono small">{{ x.month }}</td>
                      <td class="small">
                        <span class="chip" [class.plain]="x.status === 'SKIPPED'" [class.bad]="x.status === 'FAILED'">{{ x.status === 'FILLED' ? 'Bought' : x.status === 'PLACED' ? 'Placing' : x.status === 'SKIPPED' ? 'Skipped' : x.status }}</span>
                        @if (x.quantity && x.status === 'FILLED') { {{ x.quantity }} at {{ inr(x.price) }} }
                        @if (x.reason) { <span class="muted"> {{ x.reason }}</span> }
                      </td></tr>
                  }
                </tbody>
              </table></div>
            }
            @if (p.status !== 'CANCELLED') {
              <div class="row">
                @if (p.status === 'ACTIVE') { <button class="btn secondary small" type="button" (click)="change(p, 'pause')">Pause</button> }
                @if (p.status === 'PAUSED') { <button class="btn secondary small" type="button" (click)="change(p, 'resume')">Resume</button> }
                <button class="btn quiet small" type="button" (click)="stop(p)">Stop for good</button>
              </div>
            }
          </article>
        } @empty {
          @if (plans.value()) { <div class="card empty">No plans yet. Start one above.</div> }
        }
      </div>
    </div>
  `,
})
export class Plans implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly inr = inr;
  protected readonly text = value;
  protected readonly dayDigits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 2);

  /** From ?symbol= (the trade page links here). */
  readonly symbolParam = input<string>('', { alias: 'symbol' });

  protected readonly plans = new Loader<Plan[]>(async () => (await this.api.get<{ plans: Plan[] }>('/plans/v1/plans')).plans);
  protected readonly instruments = new Loader<Instrument[]>(async () => (await this.api.get<{ instruments: Instrument[] }>('/marketdata/v1/instruments')).instruments);
  protected readonly symbol = signal('');
  protected readonly amount = signal('');
  protected readonly day = signal('5');
  protected readonly now = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private key = Api.key();

  ngOnInit(): void {
    this.symbol.set(this.symbolParam());
  }

  protected tradable(): Instrument[] {
    return (this.instruments.value() ?? []).filter((i) => i.tradable);
  }

  protected async start(): Promise<void> {
    const amount = amountToApi(this.amount());
    const day = Number(this.day());
    if (!this.symbol() || amount === null || Number(amount) < 100 || Number(amount) > 100000 || !Number.isInteger(day) || day < 1 || day > 28) {
      this.error.set('Choose a share, an amount from ₹100 to ₹1,00,000 and a day from 1 to 28.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.post('/plans/v1/plans', { symbol: this.symbol(), amount, dayOfMonth: day, startNow: this.now() }, this.key);
      this.key = Api.key();
      this.amount.set('');
      this.toasts.show('Plan started.');
      await this.plans.reload();
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async change(p: Plan, what: 'pause' | 'resume'): Promise<void> {
    await this.run(() => this.api.post(`/plans/v1/plans/${p.id}/${what}`), what === 'pause' ? 'Plan paused.' : 'Plan resumed.');
  }

  protected async stop(p: Plan): Promise<void> {
    if (confirm(`Stop the ${p.symbol} plan for good? Its history stays on record.`)) {
      await this.run(() => this.api.delete(`/plans/v1/plans/${p.id}`), 'Plan stopped.');
    }
  }

  private async run(action: () => Promise<unknown>, done: string): Promise<void> {
    try {
      await action();
      this.toasts.show(done);
      await this.plans.reload();
    } catch (e) {
      this.toasts.fail(messageOf(e));
    }
  }
}
