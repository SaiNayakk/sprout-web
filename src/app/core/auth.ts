import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { store } from './storage';
import { DemoSession, SignInResponse, TokenPair, User } from './types';

/** Set on requests that must not carry (or wait for) a login: sign-in, refresh and the public sandbox. */
export const PUBLIC = new HttpContextToken<boolean>(() => false);
const NO_AUTH = new HttpContext().set(PUBLIC, true);

const KEY = 'sprout.session';

interface Saved {
  accessToken: string;
  refreshToken: string;
  name?: string;
  /** Set for a demo account: when it stops being this visitor's. */
  demoEndsAt?: string;
  /** A demo session from before sandbox v3 (a fictional persona); read only so such a session still shows a name. */
  persona?: { name: string };
}

/**
 * Who is signed in. Access tokens last 15 minutes and refresh tokens are single use: presenting one
 * twice ends the whole session. So a refresh must never run twice at once, in this tab or another.
 * Both tokens live in localStorage, every refresh happens under a cross-tab lock, and a tab that finds
 * the stored access token newer than the one it was using takes that instead of refreshing again.
 *
 * Trade-off, stated plainly: localStorage can be read by script, which cookies marked HttpOnly can't be.
 * Sprout's gateway issues tokens in JSON, not cookies, and the sandbox's customers are fictional.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly saved = signal<Saved | null>(store.read<Saved>(KEY));
  private inTab: Promise<string | null> | null = null;

  readonly signedIn = computed(() => this.saved() !== null);
  readonly name = computed(() => this.saved()?.name ?? this.saved()?.persona?.name ?? '');
  readonly isDemo = computed(() => this.saved()?.demoEndsAt !== undefined || this.saved()?.persona !== undefined);
  /** When the demo account stops being this visitor's, if it is one. */
  readonly demoEndsAt = computed(() => this.saved()?.demoEndsAt ?? null);

  constructor() {
    // another tab signed in, refreshed or out: follow it
    addEventListener('storage', (e) => {
      if (e.key === KEY) {
        this.saved.set(store.read<Saved>(KEY));
        if (this.saved() === null) {
          void this.router.navigateByUrl('/');
        }
      }
    });
  }

  accessToken(): string | null {
    return this.saved()?.accessToken ?? null;
  }

  // ── signing in ─────────────────────────────────────────────────────────────

  /** Signs in. A person with two-factor on gets a challenge to answer with {@link verifyCode}. */
  async signIn(email: string, password: string): Promise<{ challengeId?: string }> {
    const r = await firstValueFrom(this.http.post<SignInResponse>('/api/identity/v1/sessions', { email, password }, { context: NO_AUTH }));
    if (r.status === 'TOTP_REQUIRED') {
      return { challengeId: r.challengeId };
    }
    await this.adopt(r.tokens!);
    return {};
  }

  async verifyCode(challengeId: string, code: string): Promise<void> {
    const r = await firstValueFrom(
      this.http.post<SignInResponse>('/api/identity/v1/sessions/totp', { challengeId, code }, { context: NO_AUTH }),
    );
    await this.adopt(r.tokens!);
  }

  async signUp(email: string, password: string, displayName: string): Promise<void> {
    await firstValueFrom(this.http.post<User>('/api/identity/v1/users', { email, password, displayName }, { context: NO_AUTH }));
    await this.signIn(email, password);
  }

  /** Try Sprout with a demo account of one's own, called {@link name}. */
  async startDemo(name: string): Promise<DemoSession> {
    const s = await firstValueFrom(this.http.post<DemoSession>('/api/sandbox/v3/demo-sessions', { name }, { context: NO_AUTH }));
    this.keep({ accessToken: s.accessToken, refreshToken: s.refreshToken, name: s.name, demoEndsAt: s.endsAt });
    return s;
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.delete('/api/identity/v1/sessions/current'));
    } catch {
      // already ended, or unreachable: signed out here either way
    }
    this.forget();
    await this.router.navigateByUrl('/');
  }

  // ── tokens ─────────────────────────────────────────────────────────────────

  private async adopt(tokens: TokenPair): Promise<void> {
    this.keep({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    const me = await firstValueFrom(this.http.get<User>('/api/identity/v1/users/me'));
    this.keep({ ...this.saved()!, name: me.displayName });
  }

  private keep(s: Saved): void {
    this.saved.set(s);
    store.write(KEY, s);
  }

  private forget(): void {
    this.saved.set(null);
    store.remove(KEY);
  }

  /**
   * A new access token after a 401 on {@code used}. One refresh at a time in this tab, one at a time
   * across tabs (Web Locks), and none at all if another tab already got a newer token. Null means the
   * session is over (and the person has been signed out).
   */
  refreshAfter(used: string | null): Promise<string | null> {
    this.inTab ??= this.refreshOnce(used).finally(() => (this.inTab = null));
    return this.inTab;
  }

  private async refreshOnce(used: string | null): Promise<string | null> {
    const run = async (): Promise<string | null> => {
      const current = store.read<Saved>(KEY);
      if (current === null) {
        this.forget();
        return null;
      }
      if (current.accessToken !== used) {
        this.saved.set(current);   // another tab refreshed first
        return current.accessToken;
      }
      try {
        const t = await firstValueFrom(
          this.http.post<TokenPair>('/api/identity/v1/tokens/refresh', { refreshToken: current.refreshToken }, { context: NO_AUTH }),
        );
        this.keep({ ...current, accessToken: t.accessToken, refreshToken: t.refreshToken });
        return t.accessToken;
      } catch {
        this.forget();
        void this.router.navigateByUrl('/');
        return null;
      }
    };
    return navigator.locks ? navigator.locks.request('sprout-refresh', run) : run();
  }
}
