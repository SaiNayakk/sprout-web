import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Loader } from '../core/loader';
import { amountToApi, inr } from '../core/money';
import { messageOf } from '../core/problem';
import { Toasts } from '../core/toast';
import { Instrument, Pot, RoundUps } from '../core/types';
import { AutoPayCard } from '../ui/autopay';
import { checked, value } from '../ui/dom';
import { Status } from '../ui/status';

/** Goals: pots invested in one share each, and round-ups that feed them from everyday UPI spends. */
@Component({
  selector: 'app-goals',
  imports: [Status, AutoPayCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Goals</h1>
      <p class="muted">A goal is a pot of money invested in a share you choose, with a target. Put money in whenever you like, or let round-ups from
        your UPI spends fill it.</p>

      <app-status [loading]="pots.loading() && !pots.value()" [error]="pots.error()" (retry)="pots.reload()" />
      <div class="grid two">
        @for (p of pots.value() ?? []; track p.id) {
          <article class="card" [class.reward]="p.status === 'REACHED'">
            <div class="row between">
              <h2>{{ p.name }}</h2>
              <span class="chip" [class.reward]="p.status === 'REACHED'" [class.plain]="p.status === 'CLOSED'">{{ p.status === 'REACHED' ? 'Reached! ★' : p.status === 'CLOSED' ? 'Closed' : 'Growing' }}</span>
            </div>
            <p class="big">{{ inr(p.value) }} <span class="small muted">of {{ inr(p.target, true) }}</span></p>
            <div class="progress" role="progressbar" [attr.aria-valuenow]="p.progressPercent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="p.name + ' progress'"><span [style.width.%]="p.progressPercent"></span></div>
            <p class="small muted">
              In <strong>{{ p.symbol }}</strong>: {{ p.quantity }} {{ p.quantity === 1 ? 'share' : 'shares' }}, plus {{ inr(p.uninvested) }} waiting to buy the next one.
              @if (p.monthlyNeeded && p.status !== 'CLOSED') { <br />To reach it by {{ p.targetDate }}: {{ inr(p.monthlyNeeded) }} a month. }
            </p>
            @if (p.status !== 'CLOSED') {
              <form class="row" (submit)="$event.preventDefault(); put(p)" novalidate>
                <input class="amt" [attr.aria-label]="'Amount to put in ' + p.name" inputmode="decimal" placeholder="₹ amount" [value]="amounts()[p.id] ?? ''" (input)="setAmount(p.id, text($event))" />
                <button class="btn small" type="submit" [disabled]="busy() === p.id">Put in</button>
                <button class="btn quiet small" type="button" (click)="close(p)">Close</button>
              </form>
            }
          </article>
        }
      </div>

      <div class="grid two">
        <section class="card" aria-labelledby="newpot-h">
          <h2 id="newpot-h">Start a goal</h2>
          <form (submit)="$event.preventDefault(); create()" novalidate>
            <div class="field"><label for="pname">What are you saving for?</label>
              <input id="pname" maxlength="40" placeholder="Goa trip" [value]="name()" (input)="name.set(text($event))" /></div>
            <div class="field"><label for="ptarget">Target (₹500 to ₹1,00,00,000)</label>
              <input id="ptarget" inputmode="decimal" placeholder="60,000" [value]="target()" (input)="target.set(text($event))" /></div>
            <div class="field"><label for="pdate">By when (optional)</label>
              <input id="pdate" type="date" [value]="date()" (input)="date.set(text($event))" /></div>
            <div class="field"><label for="psym">Invest it in</label>
              <select id="psym" [value]="symbol()" (change)="symbol.set(text($event))">
                <option value="">Choose a share</option>
                @for (i of tradable(); track i.symbol) { <option [value]="i.symbol" [selected]="i.symbol === symbol()">{{ i.symbol }} · {{ i.name }}</option> }
              </select></div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" type="submit" [disabled]="busy() === 'new'">{{ busy() === 'new' ? 'Starting…' : 'Start goal' }}</button>
          </form>
        </section>

        <section class="card reward" aria-labelledby="ru-h">
          <h2 id="ru-h">Round-ups</h2>
          <p class="small">Each UPI spend is rounded up to the next ₹10, ₹50 or ₹100, and the spare change is saved into a goal. Once ₹100 is waiting, it's swept in with your bank's AutoPay
            permission and invested.</p>
          <app-status [loading]="round.loading() && !round.value()" [error]="round.error()" (retry)="round.reload()" />
          @if (round.value(); as r) {
            <form (submit)="$event.preventDefault(); saveRound()" novalidate>
              <div class="field"><label class="row"><input type="checkbox" [checked]="ruOn()" (change)="ruOn.set(isChecked($event))" /> Round up my UPI spends</label></div>
              @if (ruOn()) {
                <div class="grid two">
                  <div class="field"><label for="ruto">Round up to the next</label>
                    <select id="ruto" [value]="ruTo()" (change)="ruTo.set(text($event))">
                      @for (n of [10, 50, 100]; track n) { <option [value]="n" [selected]="'' + n === ruTo()">₹{{ n }}</option> }
                    </select></div>
                  <div class="field"><label for="rumul">Times</label>
                    <select id="rumul" [value]="ruMul()" (change)="ruMul.set(text($event))">
                      @for (n of [1, 2, 3]; track n) { <option [value]="n" [selected]="'' + n === ruMul()">{{ n }}×</option> }
                    </select></div>
                </div>
                <div class="field"><label for="rupot">Into</label>
                  <select id="rupot" [value]="ruPot()" (change)="ruPot.set(text($event))">
                    <option value="">Choose a goal</option>
                    @for (p of openPots(); track p.id) { <option [value]="p.id" [selected]="p.id === ruPot()">{{ p.name }}</option> }
                  </select></div>
              }
              @if (ruError()) { <p class="error" role="alert">{{ ruError() }}</p> }
              <button class="btn small" type="submit" [disabled]="busy() === 'ru'">Save</button>
            </form>
            <p class="small">
              AutoPay: <span class="chip" [class.plain]="r.autoPay !== 'ACTIVE'">{{ r.autoPay === 'ACTIVE' ? 'On' : r.autoPay === 'AWAITING_APPROVAL' ? 'Waiting for your PIN' : 'Not set up' }}</span>
              · Waiting <span class="num">{{ inr(r.waiting) }}</span> · saved so far <span class="num">{{ inr(r.swept) }}</span>
            </p>
            @if (r.autoPay !== 'ACTIVE') { <app-autopay (changed)="round.reload()" /> }
            @if (r.recent.length) {
              <div class="scroll-x"><table>
                <thead><tr><th>Spend</th><th class="right">Rounded up</th><th></th></tr></thead>
                <tbody>
                  @for (x of r.recent.slice(0, 6); track x.spendId) {
                    <tr><td class="small">{{ x.payeeName }} · {{ inr(x.spent) }}</td><td class="right num">{{ inr(x.amount) }}</td><td class="small muted">{{ x.status === 'SWEPT' ? 'saved' : 'waiting' }}</td></tr>
                  }
                </tbody>
              </table></div>
            }
          }
        </section>
      </div>
    </div>
  `,
  styles: '.amt { max-width: 11rem; }',
})
export class Goals {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly inr = inr;
  protected readonly text = value;
  protected readonly isChecked = checked;

  protected readonly pots = new Loader<Pot[]>(async () => (await this.api.get<{ pots: Pot[] }>('/goals/v1/pots')).pots);
  protected readonly round = new Loader<RoundUps>(async () => {
    const r = await this.api.get<RoundUps>('/goals/v1/round-ups');
    this.ruOn.set(r.enabled);
    this.ruTo.set(String(r.roundTo));
    this.ruMul.set(String(r.multiplier));
    this.ruPot.set(r.potId ?? '');
    return r;
  });
  private readonly instruments = new Loader<Instrument[]>(async () => (await this.api.get<{ instruments: Instrument[] }>('/marketdata/v1/instruments')).instruments);

  protected readonly name = signal('');
  protected readonly target = signal('');
  protected readonly date = signal('');
  protected readonly symbol = signal('');
  protected readonly amounts = signal<Record<string, string | undefined>>({});
  protected readonly busy = signal('');
  protected readonly error = signal('');
  protected readonly ruOn = signal(false);
  protected readonly ruTo = signal('10');
  protected readonly ruMul = signal('1');
  protected readonly ruPot = signal('');
  protected readonly ruError = signal('');
  private newKey = Api.key();
  private readonly keys = new Map<string, string>();

  protected tradable(): Instrument[] {
    return (this.instruments.value() ?? []).filter((i) => i.tradable);
  }

  protected openPots(): Pot[] {
    return (this.pots.value() ?? []).filter((p) => p.status !== 'CLOSED');
  }

  protected setAmount(id: string, v: string): void {
    this.amounts.update((a) => ({ ...a, [id]: v }));
    this.keys.delete(id);   // a changed amount is a different contribution
  }

  protected async create(): Promise<void> {
    const target = amountToApi(this.target());
    if (this.name().trim() === '' || target === null || Number(target) < 500 || Number(target) > 10000000 || !this.symbol()) {
      this.error.set('Name your goal, set a target from ₹500 to ₹1,00,00,000 and choose a share.');
      return;
    }
    this.busy.set('new');
    this.error.set('');
    try {
      const body: Record<string, string> = { name: this.name().trim(), target, symbol: this.symbol() };
      if (this.date()) {
        body['targetDate'] = this.date();
      }
      await this.api.post('/goals/v1/pots', body, this.newKey);
      this.newKey = Api.key();
      this.name.set('');
      this.target.set('');
      this.date.set('');
      this.toasts.show('Goal started.');
      await this.pots.reload();
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set('');
    }
  }

  protected async put(p: Pot): Promise<void> {
    const amount = amountToApi(this.amounts()[p.id] ?? '');
    if (amount === null || Number(amount) < 100 || Number(amount) > 100000) {
      this.toasts.fail('Put in between ₹100 and ₹1,00,000.');
      return;
    }
    let key = this.keys.get(p.id);
    if (!key) {
      key = Api.key();
      this.keys.set(p.id, key);
    }
    this.busy.set(p.id);
    try {
      await this.api.post(`/goals/v1/pots/${p.id}/contributions`, { amount }, key);
      this.keys.delete(p.id);
      this.amounts.update((a) => ({ ...a, [p.id]: '' }));
      this.toasts.show(`${inr(amount)} put into ${p.name}. Its share is bought while the market is open.`);
      await this.pots.reload();
    } catch (e) {
      this.toasts.fail(messageOf(e));
    } finally {
      this.busy.set('');
    }
  }

  protected async close(p: Pot): Promise<void> {
    if (!confirm(`Close ${p.name}? Its shares stay in your investments; no new money goes in.`)) {
      return;
    }
    try {
      await this.api.post(`/goals/v1/pots/${p.id}/close`);
      await Promise.all([this.pots.reload(), this.round.reload()]);
    } catch (e) {
      this.toasts.fail(messageOf(e));
    }
  }

  protected async saveRound(): Promise<void> {
    if (this.ruOn() && !this.ruPot()) {
      this.ruError.set('Choose the goal round-ups go into.');
      return;
    }
    this.busy.set('ru');
    this.ruError.set('');
    try {
      await this.api.put('/goals/v1/round-ups', { enabled: this.ruOn(), roundTo: Number(this.ruTo()), multiplier: Number(this.ruMul()), ...(this.ruPot() ? { potId: this.ruPot() } : {}) });
      this.toasts.show(this.ruOn() ? 'Round-ups are on.' : 'Round-ups are off.');
      await this.round.reload();
    } catch (e) {
      this.ruError.set(messageOf(e));
    } finally {
      this.busy.set('');
    }
  }
}
