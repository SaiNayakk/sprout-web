import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Auth } from '../core/auth';
import { DEMO_ENDED_MESSAGE, Presence } from '../core/presence';
import { Landing } from './landing';

const ready = { ready: true, sessionsLived: 120, endsAfterMinutes: 120 };
const tick = () => new Promise((r) => setTimeout(r, 0));

async function open(status: object = ready) {
  const f = TestBed.createComponent(Landing);
  const ctl = TestBed.inject(HttpTestingController);
  f.detectChanges();
  ctl.expectOne('/api/sandbox/v3/demo').flush(status);
  await tick();
  f.detectChanges();
  return { f, ctl, el: f.nativeElement as HTMLElement };
}

function type(el: HTMLElement, name: string) {
  const input = el.querySelector('#demo-name') as HTMLInputElement;
  input.value = name;
  input.dispatchEvent(new Event('input'));
}

describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('asks only for a name: no choosing who to be', async () => {
    const { el } = await open();
    expect(el.textContent).toContain('demo account of your own');
    expect(el.textContent).toContain('2 hours');
    expect(el.querySelector('#demo-name')).not.toBeNull();
    for (const gone of ['woman', 'Non-binary', 'pronouns', 'persona']) {
      expect(el.textContent).not.toContain(gone);
    }
  });

  it('starts a demo account named as typed, keeps the session and goes home', async () => {
    const { f, ctl, el } = await open();
    const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    type(el, '  Asha ');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const req = ctl.expectOne('/api/sandbox/v3/demo-sessions');
    expect(req.request.body).toEqual({ name: 'Asha' });
    req.flush({ name: 'Asha', sessionsLived: 120, endsAt: '2026-10-08T20:00:00Z', accessToken: 'a', tokenType: 'Bearer', expiresIn: 900, refreshToken: 'r', demoSession: 'ds-1' });
    await tick();
    f.detectChanges();
    expect(go).toHaveBeenCalledWith('/home');
    const auth = TestBed.inject(Auth);
    expect(auth.name()).toBe('Asha');
    expect(auth.isDemo()).toBe(true);
    expect(auth.demoEndsAt()).toBe('2026-10-08T20:00:00Z');
    expect(auth.demoSession()).toBe('ds-1');
  });

  it('asks for a name before asking the sandbox', async () => {
    const { f, ctl, el } = await open();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await tick();
    f.detectChanges();
    ctl.expectNone('/api/sandbox/v3/demo-sessions');
    expect(el.textContent).toContain('what to call you');
  });

  it('says so, and offers another try, when no account is ready yet without retryAfter', async () => {
    const { f, ctl, el } = await open({ ready: false, endsAfterMinutes: 120 });
    expect(el.textContent).toContain('being set up');
    type(el, 'Asha');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    ctl.expectOne('/api/sandbox/v3/demo-sessions').flush(
      { title: 'Temporarily unavailable', status: 503, code: 'UPSTREAM_UNAVAILABLE', detail: 'No demo account is ready yet; a new one is getting set up. Try again in a few minutes.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await tick();
    f.detectChanges();
    expect(el.textContent).toContain('Try again in a few minutes');
    expect(TestBed.inject(Auth).signedIn()).toBe(false);
  });

  it('shows next in line countdown on 503 with retryAfterSeconds and retries automatically', async () => {
    vi.useFakeTimers();
    try {
      const f = TestBed.createComponent(Landing);
      const ctl = TestBed.inject(HttpTestingController);
      const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      f.detectChanges();
      ctl.expectOne('/api/sandbox/v3/demo').flush(ready);
      await vi.advanceTimersByTimeAsync(0);
      f.detectChanges();

      const el = f.nativeElement as HTMLElement;
      type(el, 'Asha');
      (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

      // 503 with retryAfterSeconds = 3
      ctl.expectOne('/api/sandbox/v3/demo-sessions').flush(
        { title: 'All in use', status: 503, code: 'UPSTREAM_BUSY', retryAfterSeconds: 3 },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await vi.advanceTimersByTimeAsync(0);
      f.detectChanges();

      expect(el.textContent).toContain("Every demo account is in use right now - you're next in line");
      expect(el.textContent).toContain('3s');

      // Countdown advances 1s -> 2s
      await vi.advanceTimersByTimeAsync(1000);
      f.detectChanges();
      expect(el.textContent).toContain('2s');

      // Countdown advances 2s -> 0s -> triggers retry
      await vi.advanceTimersByTimeAsync(2000);
      const retryReq = ctl.expectOne('/api/sandbox/v3/demo-sessions');
      expect(retryReq.request.body).toEqual({ name: 'Asha' });

      // Retry succeeds
      retryReq.flush({ name: 'Asha', sessionsLived: 120, endsAt: '2026-10-08T20:00:00Z', accessToken: 'a', tokenType: 'Bearer', expiresIn: 900, refreshToken: 'r', demoSession: 'ds-retry' });
      await vi.advanceTimersByTimeAsync(0);
      f.detectChanges();
      expect(go).toHaveBeenCalledWith('/home');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels retry countdown when cancel button is clicked', async () => {
    vi.useFakeTimers();
    try {
      const f = TestBed.createComponent(Landing);
      const ctl = TestBed.inject(HttpTestingController);
      f.detectChanges();
      ctl.expectOne('/api/sandbox/v3/demo').flush(ready);
      await vi.advanceTimersByTimeAsync(0);
      f.detectChanges();

      const el = f.nativeElement as HTMLElement;
      type(el, 'Asha');
      (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

      ctl.expectOne('/api/sandbox/v3/demo-sessions').flush(
        { title: 'All in use', status: 503, code: 'UPSTREAM_BUSY', retryAfterSeconds: 5 },
        { status: 503, statusText: 'Service Unavailable' },
      );
      await vi.advanceTimersByTimeAsync(0);
      f.detectChanges();

      expect(el.textContent).toContain("Every demo account is in use right now - you're next in line");

      // Click cancel
      const cancelBtn = el.querySelector('button.quiet') as HTMLButtonElement;
      cancelBtn.click();
      await vi.advanceTimersByTimeAsync(0);
      f.detectChanges();

      expect(el.textContent).not.toContain("Every demo account is in use right now - you're next in line");

      // Advance 10s: no retry request is made
      await vi.advanceTimersByTimeAsync(10_000);
      ctl.expectNone('/api/sandbox/v3/demo-sessions');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows demo ended notice when visitor was signed out due to inactivity', async () => {
    const presence = TestBed.inject(Presence);
    presence.notice.set(DEMO_ENDED_MESSAGE);

    const { el } = await open();
    expect(el.textContent).toContain(DEMO_ENDED_MESSAGE);
  });

  it('hides the demo where there is no sandbox, without an error', async () => {
    const f = TestBed.createComponent(Landing);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/sandbox/v3/demo').flush({}, { status: 404, statusText: 'Not Found' });
    await tick();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.choose')).toBeNull();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Sign in');
  });
});
