import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Loader } from '../core/loader';
import { messageOf } from '../core/problem';
import { DemoStatus } from '../core/types';
import { value } from '../ui/dom';
import { Logo } from '../ui/logo';

/** The front door: try Sprout with a demo account of one's own (no sign-up), or sign in, or create an account. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <span class="brand"><app-logo [size]="32" /> Sprout</span>
      <span class="row">
        <a class="btn quiet small" routerLink="/signin">Sign in</a>
        <a class="btn secondary small" routerLink="/signup">Create account</a>
      </span>
    </header>

    <main class="page">
      <section class="hero">
        <p class="chip">A simulated brokerage · no real money</p>
        <h1>Grow the habit, <span class="leaf">not the hype.</span></h1>
        <p class="lede">
          Sprout rewards investing a little, regularly, and never trading often. Set up a monthly plan, round up your UPI
          spends into a goal, build a streak, and see exactly how a real brokerage works, from the order to the books.
        </p>
      </section>

      @if (demo.value(); as d) {
        <section class="card choose" aria-labelledby="try">
          <h2 id="try">Try Sprout with a demo account of your own</h2>
          <p class="muted">
            No sign-up. You get an account nobody else is using, with months of real history already in it: a monthly plan,
            UPI spends rounded up into a holiday pot, and a few shares. It's yours for {{ hours(d.endsAfterMinutes) }}, then it's closed
            and cleared away.
          </p>
          <form class="row try" (submit)="$event.preventDefault(); explore()" novalidate>
            <div class="field grow">
              <label for="demo-name">What should we call you?</label>
              <input id="demo-name" autocomplete="given-name" maxlength="40" placeholder="Your first name" [value]="name()" (input)="name.set(text($event))" />
            </div>
            <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Setting things up…' : 'Try the demo' }}</button>
          </form>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          @if (!d.ready) {
            <p class="muted small" role="status">A demo account is being set up right now; it may take a few minutes.</p>
          }
          <p class="hint">
            Time runs fast in the demo market (about 30 trading days a day), so histories grow by months in a day or two, and they are real:
            every order went through the same exchange and books as yours would.
          </p>
        </section>
      }

      <section class="grid three how">
        <div class="card"><h3>1 · A plan, not a punt</h3><p class="small">Buy a little every month, on the day you choose. Missing a month is recorded, never bought late.</p></div>
        <div class="card"><h3>2 · Spare change, invested</h3><p class="small">Round up each UPI spend and sweep it, with your bank's AutoPay permission, into a goal you chose.</p></div>
        <div class="card reward"><h3>3 · Rewards for staying</h3><p class="small">Points vest only if the money stays invested. Selling early forfeits them, so nothing rewards churning.</p></div>
      </section>

      <p class="small muted foot">
        Sprout is a learning project. Everything here is simulated: no real trades and no real money.
        <a href="https://github.com/SaiNayakk/sprout-platform">See how it's built</a>.
      </p>
    </main>
  `,
  styles: `
    .bar { display: flex; justify-content: space-between; align-items: center; padding: .75rem 16px; max-width: 1080px; margin: 0 auto; }
    .brand { display: inline-flex; align-items: center; gap: .5rem; font: 700 1.3rem var(--display); }
    .hero { padding: 1.5rem 0 1rem; max-width: 46rem; }
    .hero h1 { font-size: clamp(2.2rem, 7vw, 3.6rem); margin: .6rem 0; }
    .leaf { color: var(--leaf-text); }
    .lede { font-size: 1.1rem; color: var(--ink-soft); }
    .choose { margin: 1rem 0 2rem; }
    .try { align-items: flex-end; flex-wrap: wrap; gap: .75rem; margin: 1rem 0 .5rem; }
    .try .grow { flex: 1 1 14rem; margin: 0; }
    .how { margin: 2rem 0; }
    .foot { margin-top: 2rem; }
  `,
})
export class Landing {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly demo = new Loader<DemoStatus>(() => this.api.get<DemoStatus>('/sandbox/v3/demo'));
  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly text = value;

  protected hours(minutes: number): string {
    return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} minutes`;
  }

  protected async explore(): Promise<void> {
    if (!this.name().trim()) {
      this.error.set('Tell us what to call you first.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.startDemo(this.name().trim());
      await this.router.navigateByUrl('/home');
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }
}
