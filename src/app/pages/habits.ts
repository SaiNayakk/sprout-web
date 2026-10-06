import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { amountToApi, inr } from '../core/money';
import { messageOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { Challenge, Habits, Squad, Wrapped } from '../core/types';
import { value } from '../ui/dom';
import { Status } from '../ui/status';

interface Projection {
  monthly: string;
  years: number;
  invested: string;
  rates: { yearlyRatePercent: number; finalValue: string }[];
}

interface Readiness {
  ready: boolean;
  advice: string[];
}

/** The habit: what Sprout rewards (investing regularly), what it never does (reward trading often or rank people by money). */
@Component({
  selector: 'app-habits-page',
  imports: [Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Your habit</h1>
      <app-status [loading]="habits.loading() && !habits.value()" [error]="habits.error()" (retry)="habits.reload()" />
      @if (habits.value(); as h) {
        <div class="grid two">
          <section class="card" aria-labelledby="streak-h">
            <h2 id="streak-h" class="label">Streak</h2>
            <p class="big">{{ h.streak.months }} <span class="small muted">{{ h.streak.months === 1 ? 'month' : 'months' }} in a row</span></p>
            <p class="small muted">Longest {{ h.streak.longest }} · freezes {{ h.streak.freezes }} (a freeze covers one missed month; you earn one every 6 months)</p>
            @if (h.streak.atRisk) { <p class="small loss">You haven't invested this month. Do it before the month ends to keep your streak.</p> }
            @if (h.nudge) { <p class="card warn small">{{ h.nudge.message }}</p> }
            <p><span class="chip">{{ h.level.name }}</span>
              @if (h.level.nextName) { <span class="small muted"> {{ h.level.monthsToNext }} more {{ h.level.monthsToNext === 1 ? 'month' : 'months' }} to {{ h.level.nextName }}</span> }</p>
          </section>
          <section class="card reward" aria-labelledby="pts-h">
            <h2 id="pts-h" class="label">Points</h2>
            <p class="big">★ {{ h.points.vested }} <span class="small muted">to spend</span></p>
            <p class="small">{{ h.points.pending }} vesting (they vest 30 days after you invest, if the shares are still yours) · {{ h.points.forfeited }} lost to selling early.</p>
            <p class="small muted">Only delivery purchases count. Intraday trading never earns anything.</p>
          </section>
        </div>

        @if (h.badges.length) {
          <section class="card" aria-labelledby="badge-h">
            <h2 id="badge-h">Badges</h2>
            <div class="row">
              @for (b of h.badges; track b.code) { <span class="chip reward" [title]="'Earned ' + b.earnedOn">🏅 {{ b.name }}</span> }
            </div>
          </section>
        }
      }

      <section class="card" aria-labelledby="ch-h">
        <h2 id="ch-h">This month's challenges</h2>
        <app-status [loading]="challenges.loading() && !challenges.value()" [error]="challenges.error()" (retry)="challenges.reload()" />
        <div class="grid two">
          @for (c of challenges.value() ?? []; track c.code) {
            <div class="card" [class.soft]="c.completed">
              <div class="row between"><strong>{{ c.title }}</strong><span class="chip" [class.reward]="c.completed" [class.plain]="!c.completed">{{ c.completed ? '★ +' + c.points : c.progress + '/' + c.target }}</span></div>
              <p class="small muted">{{ c.description }}</p>
            </div>
          }
        </div>
      </section>

      <div class="grid two">
        <section class="card" aria-labelledby="sq-h">
          <h2 id="sq-h">Squads</h2>
          <p class="small muted">Friends who invest together. A squad ranks by habit (streak, then months invested), never by how much anyone has.</p>
          <app-status [loading]="squads.loading() && !squads.value()" [error]="squads.error()" (retry)="squads.reload()" />
          @for (s of squads.value() ?? []; track s.id) {
            <div class="stack-s">
              <div class="row between"><strong>{{ s.name }}</strong><button class="btn quiet small" type="button" (click)="showSquad(s)">{{ board()?.id === s.id ? 'Hide' : 'Board' }}</button></div>
              <p class="small muted">Invite code <span class="mono">{{ s.inviteCode }}</span></p>
              @if (board()?.id === s.id) {
                <table><thead><tr><th>#</th><th>Member</th><th class="right">Streak</th><th class="right">Of 12 mo</th></tr></thead><tbody>
                  @for (m of board()!.members; track m.nickname) {
                    <tr [class.you]="m.you"><td>{{ m.rank }}</td><td>{{ m.nickname }}{{ m.you ? ' (you)' : '' }}
                      @if (m.investedRange) { <div class="small muted">{{ m.investedRange }}</div> }</td>
                      <td class="right num">{{ m.streakMonths }}</td><td class="right num">{{ m.monthsInvestedLast12 }}</td></tr>
                  }
                </tbody></table>
              }
            </div>
          }
          <form (submit)="$event.preventDefault(); joinSquad()" novalidate>
            <div class="field"><label for="nick">Your nickname in a squad</label><input id="nick" maxlength="24" [value]="nick()" (input)="nick.set(text($event))" /></div>
            <div class="row">
              <input aria-label="Invite code" placeholder="Invite code" style="max-width:11rem" [value]="invite()" (input)="invite.set(text($event))" />
              <button class="btn small" type="submit">Join</button>
            </div>
          </form>
          <form (submit)="$event.preventDefault(); newSquad()" novalidate style="margin-top:.8rem">
            <div class="row">
              <input aria-label="New squad name" placeholder="Name a new squad" style="max-width:15rem" [value]="squadName()" (input)="squadName.set(text($event))" />
              <button class="btn secondary small" type="submit">Start a squad</button>
            </div>
          </form>
          <label class="row small" style="margin-top:.8rem"><input type="checkbox" [checked]="showRange()" (change)="setRange($event)" /> Show a range for how much I've invested (never the amount)</label>
        </section>

        <section class="card" aria-labelledby="rd-h">
          <h2 id="rd-h">Are you ready to invest?</h2>
          <p class="small muted">Three questions, plain advice. Nothing is blocked.</p>
          <form (submit)="$event.preventDefault(); checkReady()" novalidate>
            <div class="field"><label for="ef">Months of expenses you've saved for emergencies</label><input id="ef" inputmode="numeric" [value]="emergency()" (input)="emergency.set(text($event))" /></div>
            <div class="field"><label class="row"><input type="checkbox" [checked]="debt()" (change)="debt.set(isChecked($event))" /> I have credit card or personal loan debt</label></div>
            <div class="field"><label for="hz">When will you need this money? (years)</label><input id="hz" inputmode="numeric" [value]="horizon()" (input)="horizon.set(text($event))" /></div>
            <button class="btn small" type="submit">Check</button>
          </form>
          @if (readiness(); as r) {
            <div class="card" [class.soft]="r.ready" [class.warn]="!r.ready" style="margin-top:.8rem">
              <p><strong>{{ r.ready ? 'You look ready.' : 'A few things first.' }}</strong></p>
              <ul>@for (a of r.advice; track a) { <li class="small">{{ a }}</li> }</ul>
            </div>
          }
        </section>
      </div>

      <div class="grid two">
        <section class="card" aria-labelledby="fy-h">
          <h2 id="fy-h">Future you</h2>
          <p class="small muted">What a monthly amount could grow to. An illustration with made-up rates, not a promise.</p>
          <form class="row" (submit)="$event.preventDefault(); project()" novalidate>
            <input aria-label="Monthly amount" inputmode="decimal" style="max-width:9rem" [value]="monthly()" (input)="monthly.set(text($event))" />
            <span class="small">a month for</span>
            <input aria-label="Years" inputmode="numeric" style="max-width:5rem" [value]="years()" (input)="years.set(text($event))" />
            <span class="small">years</span>
            <button class="btn small" type="submit">Show</button>
          </form>
          @if (future(); as f) {
            <p class="small">You'd put in <span class="num">{{ inr(f.invested) }}</span>. At different yearly rates it could be:</p>
            @for (r of f.rates; track r.yearlyRatePercent) { <p class="row between small"><span>{{ r.yearlyRatePercent }}% a year</span><strong class="num">{{ inr(r.finalValue) }}</strong></p> }
          }
        </section>

        <section class="card reward" aria-labelledby="wr-h">
          <h2 id="wr-h">Your year, wrapped</h2>
          <app-status [loading]="wrapped.loading() && !wrapped.value()" [error]="wrapped.error()" (retry)="wrapped.reload()" />
          @if (wrapped.value(); as w) {
            <p class="big">{{ w.title }}</p>
            <p class="small">{{ w.year }}: invested in <strong>{{ w.monthsInvested }}</strong> {{ w.monthsInvested === 1 ? 'month' : 'months' }}, longest run <strong>{{ w.longestStreak }}</strong>,
              <strong>{{ w.purchases }}</strong> purchases across <strong>{{ w.differentShares }}</strong> {{ w.differentShares === 1 ? 'share' : 'shares' }}
              (<span class="num">{{ inr(w.invested) }}</span>).
              @if (w.topShare) { Most bought: <strong>{{ w.topShare.symbol }}</strong>. }
              {{ w.planInstalments }} from plans, {{ w.potPurchases }} for goals, {{ w.challengesCompleted }} challenges done, {{ w.pointsEarned }} points earned.</p>
          }
        </section>
      </div>
    </div>
  `,
  styles: `.stack-s { margin-bottom: 1rem; } tr.you td { background: var(--leaf-soft); }`,
})
export class HabitsPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly inr = inr;
  protected readonly text = value;
  protected readonly isChecked = (e: Event) => (e.target as HTMLInputElement).checked;

  protected readonly habits = new Loader<Habits>(() => this.api.get('/habits/v1/habits/me'));
  protected readonly challenges = new Loader<Challenge[]>(async () => (await this.api.get<{ challenges: Challenge[] }>('/habits/v1/challenges')).challenges);
  protected readonly squads = new Loader<Squad[]>(async () => (await this.api.get<{ squads: Squad[] }>('/habits/v1/squads')).squads);
  protected readonly wrapped = new Loader<Wrapped>(() => this.api.get('/habits/v1/wrapped'));

  protected readonly board = signal<Squad | null>(null);
  protected readonly nick = signal('');
  protected readonly invite = signal('');
  protected readonly squadName = signal('');
  protected readonly showRange = signal(false);
  protected readonly emergency = signal('0');
  protected readonly debt = signal(false);
  protected readonly horizon = signal('5');
  protected readonly readiness = signal<Readiness | null>(null);
  protected readonly monthly = signal('2000');
  protected readonly years = signal('10');
  protected readonly future = signal<Projection | null>(null);

  constructor() {
    void this.api.get<Readiness>('/habits/v1/readiness').then((r) => this.readiness.set(r), () => undefined);
  }

  protected async showSquad(s: Squad): Promise<void> {
    if (this.board()?.id === s.id) {
      this.board.set(null);
      return;
    }
    await this.guard(async () => this.board.set(await this.api.get<Squad>(`/habits/v1/squads/${s.id}`)));
  }

  protected async joinSquad(): Promise<void> {
    if (this.invite().trim() === '' || this.nick().trim().length < 2) {
      this.toasts.fail('Add an invite code and a nickname of at least 2 letters.');
      return;
    }
    await this.guard(async () => {
      await this.api.post('/habits/v1/squads/join', { inviteCode: this.invite().trim(), nickname: this.nick().trim() });
      this.invite.set('');
      this.toasts.show('You joined the squad.');
      await this.squads.reload();
    });
  }

  protected async newSquad(): Promise<void> {
    if (this.squadName().trim().length < 2 || this.nick().trim().length < 2) {
      this.toasts.fail('Add a squad name and your nickname (at least 2 letters each).');
      return;
    }
    await this.guard(async () => {
      await this.api.post('/habits/v1/squads', { name: this.squadName().trim(), nickname: this.nick().trim() });
      this.squadName.set('');
      this.toasts.show('Squad started. Share its invite code with friends.');
      await this.squads.reload();
    });
  }

  protected async setRange(e: Event): Promise<void> {
    const on = (e.target as HTMLInputElement).checked;
    await this.guard(async () => {
      await this.api.put('/habits/v1/habits/me/privacy', { showInvestedRange: on });
      this.showRange.set(on);
    });
  }

  protected async checkReady(): Promise<void> {
    await this.guard(async () =>
      this.readiness.set(await this.api.put<Readiness>('/habits/v1/readiness', {
        emergencyFundMonths: Number(this.emergency()) || 0,
        highInterestDebt: this.debt(),
        horizonYears: Number(this.horizon()) || 0,
      })),
    );
  }

  protected async project(): Promise<void> {
    const monthly = amountToApi(this.monthly());
    const years = Number(this.years());
    if (monthly === null || !Number.isInteger(years) || years < 1 || years > 40) {
      this.toasts.fail('Enter a monthly amount and a number of years from 1 to 40.');
      return;
    }
    await this.guard(async () => this.future.set(await this.api.get<Projection>('/habits/v1/future', { monthly, years })));
  }

  private async guard(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (e) {
      this.toasts.fail(e instanceof HttpErrorResponse || e instanceof Error ? messageOf(e) : 'Something went wrong. Try again.');
    }
  }
}
