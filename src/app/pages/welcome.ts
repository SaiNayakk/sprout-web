import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { codeOf, messageOf } from '../core/problem';
import { BankAccount, SproutAccount } from '../core/types';
import { AddMoney } from '../ui/add-money';
import { value } from '../ui/dom';

type Step = 'loading' | 'bank' | 'account' | 'money';

/** Setting up a real customer, in the order a real broker does: a bank account, then KYC, then money. */
@Component({
  selector: 'app-welcome',
  imports: [AddMoney],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <h1>Welcome{{ auth.name() ? ', ' + auth.name() : '' }}</h1>
      <p class="muted">Three short steps. Everything here is simulated, so nothing you enter is checked against anything real.</p>
      <ol class="steps" aria-label="Setup steps">
        <li [class.on]="step() === 'bank'" [class.done]="rank() > 1">Bank account</li>
        <li [class.on]="step() === 'account'" [class.done]="rank() > 2">Sprout account</li>
        <li [class.on]="step() === 'money'">Add money</li>
      </ol>

      @switch (step()) {
        @case ('loading') { <p class="muted" role="status">Checking where you are…</p> }

        @case ('bank') {
          <form class="card" (submit)="$event.preventDefault(); openBank()" novalidate>
            <h2>Open your Sprout Bank account</h2>
            <p class="muted small">Sprout Bank is a pretend bank with pretend money (₹1,00,000 to start). Your UPI PIN approves payments.</p>
            <div class="field">
              <label for="holder">Name on the account</label>
              <input id="holder" autocomplete="name" [value]="holder()" (input)="holder.set(text($event))" />
            </div>
            <div class="field">
              <label for="pin">Choose a UPI PIN (4 or 6 digits)</label>
              <input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" [value]="pin()" (input)="pin.set(digits($event))" />
              <p class="hint">Not all the same digit and not a run like 1234.</p>
            </div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Opening…' : 'Open account' }}</button>
          </form>
        }

        @case ('account') {
          <form class="card" (submit)="$event.preventDefault(); openAccount()" novalidate>
            <h2>Open your Sprout account</h2>
            <p class="muted small">
              A short simulated KYC. Use any made-up details: a name, a date of birth (18 or older) and a PAN in the usual shape,
              like <span class="mono">ABCPE1234F</span> (the fourth letter P, for an individual).
            </p>
            <div class="field">
              <label for="legal">Full name</label>
              <input id="legal" autocomplete="name" [value]="legal()" (input)="legal.set(text($event))" />
            </div>
            <div class="field">
              <label for="dob">Date of birth</label>
              <input id="dob" type="date" autocomplete="bday" [value]="dob()" (input)="dob.set(text($event))" />
            </div>
            <div class="field">
              <label for="pan">PAN</label>
              <input id="pan" class="mono" maxlength="10" autocapitalize="characters" [value]="pan()" (input)="pan.set(text($event).toUpperCase())" />
            </div>
            <p class="small muted">Money moves to and from <span class="mono">{{ vpa() }}</span>.</p>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Verifying…' : 'Open Sprout account' }}</button>
          </form>
        }

        @case ('money') {
          <div class="card">
            <h2>Add some money</h2>
            <p class="muted small">Move pretend money from your bank into Sprout so you can invest. You can do this later too.</p>
            <app-add-money (added)="finish()" />
          </div>
          <p><button class="btn quiet" type="button" (click)="finish()">Skip for now</button></p>
        }
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 560px; }
    .steps { display: flex; gap: .5rem; list-style: none; padding: 0; margin: 1rem 0; flex-wrap: wrap; }
    .steps li { padding: .3rem .8rem; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-soft); font-size: .85rem; font-weight: 600; }
    .steps li.on { background: var(--leaf); border-color: var(--leaf); color: var(--on-leaf); }
    .steps li.done { background: var(--leaf-soft); color: var(--leaf-text); border-color: transparent; }
  `,
})
export class Welcome implements OnInit {
  protected readonly auth = inject(Auth);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly step = signal<Step>('loading');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly holder = signal(this.auth.name());
  protected readonly pin = signal('');
  protected readonly legal = signal(this.auth.name());
  protected readonly dob = signal('');
  protected readonly pan = signal('');
  protected readonly vpa = signal('');
  protected readonly text = value;
  protected readonly digits = (e: Event) => value(e).replace(/\D/g, '').slice(0, 6);

  protected rank(): number {
    return { loading: 0, bank: 1, account: 2, money: 3 }[this.step()];
  }

  async ngOnInit(): Promise<void> {
    try {
      const bank = await this.get<BankAccount>('/bank/v1/accounts/me');
      if (bank === null) {
        this.step.set('bank');
        return;
      }
      this.vpa.set(bank.vpa);
      this.step.set((await this.get<SproutAccount>('/accounts/v1/accounts/me')) === null ? 'account' : 'money');
    } catch (e) {
      this.error.set(messageOf(e));
      this.step.set('bank');
    }
  }

  protected async openBank(): Promise<void> {
    if (this.holder().trim().length < 2 || this.pin().length < 4) {
      this.error.set('Add the name for the account and a PIN of 4 or 6 digits.');
      return;
    }
    await this.guarded(async () => {
      try {
        await this.api.post('/bank/v1/accounts', { holderName: this.holder().trim(), upiPin: this.pin() });
      } catch (e) {
        if (codeOf(e) !== 'ACCOUNT_EXISTS') {
          throw e;
        }
      }
      this.pin.set('');
      this.vpa.set((await this.api.get<BankAccount>('/bank/v1/accounts/me')).vpa);
      this.step.set('account');
    });
  }

  protected async openAccount(): Promise<void> {
    if (this.legal().trim().length < 2 || this.dob() === '' || this.pan().length !== 10) {
      this.error.set('Add your full name, date of birth and a 10-character PAN.');
      return;
    }
    await this.guarded(async () => {
      try {
        await this.api.post('/accounts/v1/accounts', { legalName: this.legal().trim(), dateOfBirth: this.dob(), pan: this.pan(), bankVpa: this.vpa() });
      } catch (e) {
        if (codeOf(e) !== 'ACCOUNT_EXISTS') {
          throw e;
        }
      }
      this.step.set('money');
    });
  }

  protected finish(): void {
    void this.router.navigateByUrl('/home');
  }

  private async guarded(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** The thing, or null if there isn't one yet (a 404). */
  private async get<T>(path: string): Promise<T | null> {
    try {
      return await this.api.get<T>(path);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        return null;
      }
      throw e;
    }
  }
}
