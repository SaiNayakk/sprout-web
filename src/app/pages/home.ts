import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Loader } from '../core/loader';
import { addInr, fromPaise, inr, paise } from '../core/money';
import { Prices } from '../core/prices';
import { Challenge, Funds, Habits, Holding, Market, Plan, Pot, RoundUps } from '../core/types';
import { Chg } from '../ui/chg';
import { Status } from '../ui/status';

/** Where a customer lands: money, holdings (live), the habit, and what's growing. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Chg, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="row between">
        <h1>{{ greeting() }}</h1>
        @if (market(); as m) {
          <span class="chip" [class.plain]="m.state !== 'OPEN'" [title]="m.source">
            Market {{ m.state === 'OPEN' ? 'open' : m.state === 'PRE_OPEN' ? 'opens soon' : 'closed' }} · {{ time(m.marketTime) }}
          </span>
        }
      </div>

      <div class="grid two">
        <section class="card" aria-labelledby="funds-h">
          <h2 id="funds-h" class="label">Ready to invest</h2>
          <app-status [loading]="funds.loading() && !funds.value()" [error]="funds.error()" (retry)="funds.reload()" />
          @if (funds.value(); as f) {
            <p class="big">{{ inr(f.availableToTrade) }}</p>
            <div class="row small muted">
              <span>Set aside for orders {{ inr(f.blocked) }}</span>
              <span>Arriving after a sale {{ inr(f.unsettled) }}</span>
              @if (f.dues !== '0.00') { <span class="loss">You owe {{ inr(f.dues) }}</span> }
            </div>
          }
          <p class="row"><a class="btn small" routerLink="/money">Add money</a><a class="btn secondary small" routerLink="/markets">Invest</a></p>
        </section>

        <section class="card" aria-labelledby="hab-h">
          <h2 id="hab-h" class="label">Your habit</h2>
          <app-status [loading]="habits.loading() && !habits.value()" [error]="habits.error()" (retry)="habits.reload()" />
          @if (habits.value(); as h) {
            <p class="big">{{ h.streak.months }} <span class="small muted">{{ h.streak.months === 1 ? 'month' : 'months' }} in a row</span></p>
            <p class="small">
              <span class="chip">{{ h.level.name }}</span>
              @if (h.level.nextName) { <span class="muted"> · {{ h.level.monthsToNext }} more {{ h.level.monthsToNext === 1 ? 'month' : 'months' }} to {{ h.level.nextName }}</span> }
            </p>
            @if (h.streak.atRisk) {
              <p class="small loss">Invest by month end to keep your streak.</p>
            }
            @if (h.nudge) {
              <p class="small muted">{{ h.nudge.message }}</p>
            }
            <p class="small">
              <span class="chip reward">★ {{ h.points.vested }} points</span>
              @if (h.points.pending) { <span class="muted"> and {{ h.points.pending }} vesting</span> }
            </p>
          }
          <p><a class="btn secondary small" routerLink="/habits">See your habit</a></p>
        </section>
      </div>

      <section class="card" aria-labelledby="hold-h">
        <div class="row between">
          <h2 id="hold-h">Your investments</h2>
          @if (rows().length) {
            <span class="small muted">Worth <span class="num">{{ inr(total().value) }}</span> · <app-chg [amount]="total().pnl" /></span>
          }
        </div>
        <app-status [loading]="holdings.loading() && !holdings.value()" [error]="holdings.error()" (retry)="holdings.reload()" />
        @if (holdings.value() && !rows().length) {
          <div class="empty">
            <p>Nothing here yet.</p>
            <a class="btn" routerLink="/markets">Browse the market</a>
          </div>
        }
        @if (rows().length) {
          <div class="scroll-x">
            <table>
              <thead><tr><th>Share</th><th class="right">Qty</th><th class="right">Avg</th><th class="right">Price</th><th class="right">Gain / loss</th></tr></thead>
              <tbody>
                @for (r of rows(); track r.symbol) {
                  <tr>
                    <td><a [routerLink]="['/markets', r.symbol]"><strong>{{ r.symbol }}</strong></a>
                      @if (r.t1) { <span class="chip plain" title="Bought recently; arrives in your demat account next session">{{ r.t1 }} arriving</span> }</td>
                    <td class="right num">{{ r.quantity }}</td>
                    <td class="right num">{{ inr(r.average) }}</td>
                    <td class="right num">{{ inr(r.last) }}</td>
                    <td class="right"><app-chg [amount]="r.pnl" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <div class="grid two">
        <section class="card" aria-labelledby="goal-h">
          <h2 id="goal-h">Goals</h2>
          <app-status [loading]="pots.loading() && !pots.value()" [error]="pots.error()" (retry)="pots.reload()" />
          @for (p of openPots(); track p.id) {
            <div class="stack-s">
              <div class="row between"><strong>{{ p.name }}</strong><span class="num small">{{ inr(held(p)) }} of {{ inr(p.target, true) }}</span></div>
              <div class="progress" role="progressbar" [attr.aria-valuenow]="p.progressPercent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="p.name + ' progress'"><span [style.width.%]="p.progressPercent"></span></div>
            </div>
          } @empty {
            @if (pots.value()) { <p class="muted">Saving for something? Start a goal and invest towards it.</p> }
          }
          @if (round.value(); as r) {
            @if (r.enabled) {
              <p class="small muted">Round-ups: {{ inr(r.waiting) }} waiting, {{ inr(r.swept) }} saved so far.</p>
            }
          }
          <p><a class="btn secondary small" routerLink="/goals">Goals and round-ups</a></p>
        </section>

        <section class="card" aria-labelledby="mon-h">
          <h2 id="mon-h">This month</h2>
          <app-status [loading]="challenges.loading() && !challenges.value()" [error]="challenges.error()" (retry)="challenges.reload()" />
          @if (challenges.value(); as c) {
            <p class="small">{{ done() }} of {{ c.length }} challenges done</p>
            @for (x of c; track x.code) {
              <p class="small row between" style="margin:.2rem 0"><span [class.muted]="!x.completed">{{ x.completed ? '✔' : '○' }} {{ x.title }}</span><span class="chip" [class.reward]="x.completed" [class.plain]="!x.completed">{{ x.progress }}/{{ x.target }}</span></p>
            }
          }
          @if (plans.value(); as pl) {
            @for (p of activePlans(); track p.id) {
              <p class="small muted">Plan: {{ inr(p.amount, true) }} a month into <strong>{{ p.symbol }}</strong>{{ p.nextDue ? ', next on ' + p.nextDue : '' }}.</p>
            }
          }
          <p><a class="btn secondary small" routerLink="/plans">Plans</a></p>
        </section>
      </div>
    </div>
  `,
  styles: `.stack-s > * + * { margin-top: .3rem; } .stack-s { margin-bottom: .8rem; }`,
})
export class Home {
  private readonly api = inject(Api);
  private readonly prices = inject(Prices);
  protected readonly auth = inject(Auth);
  protected readonly inr = inr;

  protected readonly funds = new Loader<Funds>(() => this.api.get('/oms/v1/funds'));
  protected readonly holdings = new Loader<Holding[]>(async () => (await this.api.get<{ holdings: Holding[] }>('/oms/v1/holdings')).holdings);
  protected readonly habits = new Loader<Habits>(() => this.api.get('/habits/v1/habits/me'));
  protected readonly pots = new Loader<Pot[]>(async () => (await this.api.get<{ pots: Pot[] }>('/goals/v1/pots')).pots);
  protected readonly round = new Loader<RoundUps>(() => this.api.get('/goals/v1/round-ups'));
  protected readonly challenges = new Loader<Challenge[]>(async () => (await this.api.get<{ challenges: Challenge[] }>('/habits/v1/challenges')).challenges);
  protected readonly plans = new Loader<Plan[]>(async () => (await this.api.get<{ plans: Plan[] }>('/plans/v1/plans')).plans);
  private readonly marketOnce = new Loader<Market>(() => this.api.get('/marketdata/v1/market'));

  protected readonly market = computed(() => this.prices.market() ?? this.marketOnce.value());
  protected readonly openPots = computed(() => (this.pots.value() ?? []).filter((p) => p.status !== 'CLOSED').slice(0, 3));
  protected readonly activePlans = computed(() => (this.plans.value() ?? []).filter((p) => p.status === 'ACTIVE'));
  protected readonly done = computed(() => (this.challenges.value() ?? []).filter((c) => c.completed).length);

  /** Holdings at the live price where there is one, else the last price the order service knew. */
  protected readonly rows = computed(() =>
    (this.holdings.value() ?? [])
      .filter((h) => h.quantity > 0)
      .map((h) => {
        const live = this.prices.quotes()[h.symbol]?.last;
        const last = live !== undefined ? fromPaise(paise(live)) : (h.lastPrice ?? h.averagePrice);
        const value = paise(last) * h.quantity;
        return { symbol: h.symbol, quantity: h.quantity, t1: h.t1Quantity, average: h.averagePrice, last, value, pnl: fromPaise(value - paise(h.investedValue)) };
      }),
  );
  protected readonly total = computed(() => {
    const value = this.rows().reduce((s, r) => s + r.value, 0);
    const invested = (this.holdings.value() ?? []).filter((h) => h.quantity > 0).reduce((s, h) => s + paise(h.investedValue), 0);
    return { value: fromPaise(value), pnl: fromPaise(value - invested) };
  });

  constructor() {
    const stream = { current: null as { close(): void } | null, symbols: '' };
    effect(() => {
      const symbols = (this.holdings.value() ?? []).filter((h) => h.quantity > 0).map((h) => h.symbol).sort();
      if (symbols.join() === stream.symbols) {
        return;
      }
      stream.current?.close();
      stream.symbols = symbols.join();
      stream.current = symbols.length ? this.prices.open(symbols) : null;
    });
    inject(DestroyRef).onDestroy(() => stream.current?.close());
  }

  protected held(p: Pot): string {
    return addInr(p.value, p.uninvested);
  }

  protected greeting(): string {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const first = this.auth.name().split(' ')[0];
    return first ? `${part}, ${first}` : part;
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }
}
