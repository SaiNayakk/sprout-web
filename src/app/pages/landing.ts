import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Loader } from '../core/loader';
import { messageOf } from '../core/problem';
import { GroupCode, Personas } from '../core/types';
import { Logo } from '../ui/logo';

/** The front door: explore as a fictional customer (no sign-up), or sign in, or create an account. */
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

      @if (personas.value(); as p) {
        <section class="card choose" aria-labelledby="who">
          <h2 id="who">Explore Sprout as a fictional customer</h2>
          <p class="muted">
            No sign-up. Meet one of fifteen fictional customers from across India, each investing in their own way, with a history
            that keeps growing. Who would you like to explore as?
          </p>
          <div class="grid groups" role="group" aria-labelledby="who">
            @for (g of p.groups; track g.code) {
              <button class="btn secondary block" type="button" [disabled]="busy()" (click)="explore(g.code)">
                {{ g.label }}
              </button>
            }
          </div>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          @if (busy()) {
            <p class="muted small" role="status">Setting things up…</p>
          }
          <p class="hint">
            Time runs fast in the demo market (about 30 trading days a day), so histories grow by months in a day or two, and they are real:
            every order went through the same exchange and books as yours would.
          </p>
        </section>

        <section>
          <h2>The people you might meet</h2>
          <div class="grid three">
            @for (person of p.personas; track person.id) {
              <article class="card person">
                <h3>{{ person.name }} <span class="muted small">({{ person.pronouns }})</span></h3>
                <p class="small muted">{{ person.city }}</p>
                <p class="small">{{ person.story }}</p>
                <span class="chip plain">{{ styles[person.style] }}</span>
              </article>
            }
          </div>
        </section>
      }

      <section class="grid three how">
        <div class="card"><h3>1 · A plan, not a punt</h3><p class="small">Buy a little every month, on the day you choose. Missing a month is recorded, never bought late.</p></div>
        <div class="card"><h3>2 · Spare change, invested</h3><p class="small">Round up each UPI spend and sweep it, with your bank's AutoPay permission, into a goal you chose.</p></div>
        <div class="card reward"><h3>3 · Rewards for staying</h3><p class="small">Points vest only if the money stays invested. Selling early forfeits them, so nothing rewards churning.</p></div>
      </section>

      <p class="small muted foot">
        Sprout is a learning project. Everything here is simulated: no real trades, no real money, and the people are made up.
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
    .groups { grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); margin: 1rem 0 .5rem; }
    .person h3 { margin-bottom: .1rem; }
    .how { margin: 2rem 0; }
    .foot { margin-top: 2rem; }
  `,
})
export class Landing {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly personas = new Loader<Personas>(() => this.api.get<Personas>('/sandbox/v1/personas'));
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly styles: Record<string, string> = {
    STEADY_PLANS: 'Steady monthly plans',
    ROUND_UPS: 'Round-ups into a goal',
    GOAL_SAVER: 'Saving for a goal',
    NEW_INVESTOR: 'Just starting out',
    EXPLORER: 'Exploring many shares',
  };

  protected async explore(group: GroupCode): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.startDemo(group);
      await this.router.navigateByUrl('/home');
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }
}
