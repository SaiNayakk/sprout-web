import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, PUBLIC } from './auth';

const NO_AUTH = new HttpContext().set(PUBLIC, true);

export const DEMO_ENDED_MESSAGE = 'Your demo ended after a while without activity. Start a new one any time.';

/**
 * Tracks demo session presence:
 * - Sends a heartbeat every 30 s with active = true if visitor interacted since last tick.
 * - Leaves on sign-out. Not on pagehide: it fires on a reload too, which would end the demo of a visitor who refreshed;
 *   a closed tab is noticed when its heartbeats stop (the sandbox closes the account two minutes after the last one).
 * - Signs out and surfaces notice on 404 DEMO_SESSION_ENDED.
 */
@Injectable({ providedIn: 'root' })
export class Presence {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly notice = signal<string | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;
  private hasActivity = false;
  private currentSession: string | null = null;
  private boundOnActivity = () => this.recordActivity();
  private listenersAttached = false;

  start(sessionKey: string): void {
    this.stop();
    this.currentSession = sessionKey;
    this.hasActivity = false;

    this.attachListeners();

    this.timer = setInterval(() => {
      void this.heartbeat();
    }, 30_000);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.detachListeners();
    this.currentSession = null;
  }

  recordActivity(): void {
    this.hasActivity = true;
  }

  async heartbeat(): Promise<void> {
    const key = this.currentSession;
    if (!key) return;

    const active = this.hasActivity;
    this.hasActivity = false;

    try {
      await firstValueFrom(
        this.http.post(
          '/api/sandbox/v3/demo-sessions/heartbeat',
          { demoSession: key, active },
          { context: NO_AUTH },
        ),
      );
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        const code = (e.error as { code?: string } | null)?.code;
        if (!code || code === 'DEMO_SESSION_ENDED') {
          await this.handleSessionEnded();
        }
      }
    }
  }

  private async handleSessionEnded(): Promise<void> {
    this.stop();
    this.notice.set(DEMO_ENDED_MESSAGE);
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  leave(): void {
    const key = this.currentSession ?? this.auth.demoSession();
    if (!key) return;

    this.stop();

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        '/api/sandbox/v3/demo-sessions/leave',
        JSON.stringify({ demoSession: key }),
      );
    }
  }

  private attachListeners(): void {
    if (this.listenersAttached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.boundOnActivity, { passive: true });
    window.addEventListener('click', this.boundOnActivity, { passive: true });
    window.addEventListener('scroll', this.boundOnActivity, { passive: true });
    window.addEventListener('touchstart', this.boundOnActivity, { passive: true });
    this.listenersAttached = true;
  }

  private detachListeners(): void {
    if (!this.listenersAttached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.boundOnActivity);
    window.removeEventListener('click', this.boundOnActivity);
    window.removeEventListener('scroll', this.boundOnActivity);
    window.removeEventListener('touchstart', this.boundOnActivity);
    this.listenersAttached = false;
  }
}
