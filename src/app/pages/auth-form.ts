import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { codeOf, messageOf } from '../core/problem';
import { Logo } from '../ui/logo';
import { value } from '../ui/dom';

/** Sign in or create an account (the route says which), then the two-factor code if that's turned on. */
@Component({
  selector: 'app-auth-form',
  imports: [RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <a routerLink="/" class="brand"><app-logo [size]="34" /> Sprout</a>
      <form class="card" (submit)="$event.preventDefault(); submit()" novalidate>
        @if (challenge()) {
          <h1>Two-factor code</h1>
          <p class="muted">Open your authenticator app and type the 6-digit code for Sprout.</p>
          <div class="field">
            <label for="code">Code</label>
            <input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [value]="code()" (input)="code.set(digits($event))" />
          </div>
        } @else {
          <h1>{{ signingUp() ? 'Create your account' : 'Sign in' }}</h1>
          @if (signingUp()) {
            <div class="field">
              <label for="name">What should we call you?</label>
              <input id="name" autocomplete="given-name" maxlength="60" [value]="name()" (input)="name.set(text($event))" />
            </div>
          }
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" autocomplete="email" [value]="email()" (input)="email.set(text($event))" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" [attr.autocomplete]="signingUp() ? 'new-password' : 'current-password'"
                   [value]="password()" (input)="password.set(text($event))" />
            @if (signingUp()) {
              <p class="hint">At least 10 characters, and not a commonly used password.</p>
            }
          </div>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="btn block" type="submit" [disabled]="busy()">
          {{ busy() ? 'One moment…' : challenge() ? 'Verify' : signingUp() ? 'Create account' : 'Sign in' }}
        </button>
        @if (!challenge()) {
          <p class="small muted switch">
            @if (signingUp()) { Already have an account? <a routerLink="/signin">Sign in</a> }
            @else { New here? <a routerLink="/signup">Create an account</a> }
            · or <a routerLink="/">explore as a demo customer</a>
          </p>
        }
      </form>
    </main>
  `,
  styles: `
    .wrap { max-width: 420px; margin: 0 auto; padding: 1.5rem 16px 3rem; }
    .brand { display: inline-flex; align-items: center; gap: .5rem; font: 700 1.3rem var(--display); color: var(--ink); text-decoration: none; margin-bottom: 1rem; }
    .switch { margin: 1rem 0 0; text-align: center; }
  `,
})
export class AuthForm {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  /** From the route's data: 'signin' or 'signup'. */
  readonly mode = input<'signin' | 'signup'>('signin');

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly challenge = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly text = value;
  protected readonly digits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 6);

  protected signingUp(): boolean {
    return this.mode() === 'signup';
  }

  protected async submit(): Promise<void> {
    this.error.set('');
    if (this.challenge()) {
      return this.run(() => this.auth.verifyCode(this.challenge(), this.code()));
    }
    const email = this.email().trim();
    if (!email.includes('@') || this.password() === '' || (this.signingUp() && this.name().trim() === '')) {
      this.error.set(this.signingUp() ? 'Add your name, an email and a password.' : 'Add your email and password.');
      return;
    }
    if (this.signingUp()) {
      return this.run(() => this.auth.signUp(email, this.password(), this.name().trim()));
    }
    this.busy.set(true);
    try {
      const r = await this.auth.signIn(email, this.password());
      if (r.challengeId) {
        this.challenge.set(r.challengeId);
        this.busy.set(false);
        return;
      }
      await this.router.navigateByUrl('/home');
    } catch (e) {
      this.error.set(codeOf(e) === 'INVALID_CREDENTIALS' ? 'That email and password don’t match.' : messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      await this.router.navigateByUrl(this.signingUp() ? '/welcome' : '/home');
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }
}
