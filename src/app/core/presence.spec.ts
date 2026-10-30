import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Auth } from './auth';
import { DEMO_ENDED_MESSAGE, Presence } from './presence';

describe('Presence', () => {
  let presence: Presence;
  let auth: Auth;
  let router: Router;
  let ctl: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    presence = TestBed.inject(Presence);
    auth = TestBed.inject(Auth);
    router = TestBed.inject(Router);
    ctl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    presence.stop();
    ctl.verify();
    vi.useRealTimers();
  });

  it('sends heartbeats every 30 s with active=false when idle', async () => {
    presence.start('sess-123');

    // Advance 30 s -> first heartbeat
    await vi.advanceTimersByTimeAsync(30_000);

    const req1 = ctl.expectOne('/api/sandbox/v3/demo-sessions/heartbeat');
    expect(req1.request.method).toBe('POST');
    expect(req1.request.body).toEqual({ demoSession: 'sess-123', active: false });
    expect(req1.request.headers.has('Authorization')).toBe(false);
    req1.flush(null, { status: 204, statusText: 'No Content' });

    // Advance another 30 s -> second heartbeat
    await vi.advanceTimersByTimeAsync(30_000);
    const req2 = ctl.expectOne('/api/sandbox/v3/demo-sessions/heartbeat');
    expect(req2.request.body).toEqual({ demoSession: 'sess-123', active: false });
    req2.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sets active=true after visitor interaction and resets it for next tick', async () => {
    presence.start('sess-active');

    // Simulate visitor pressing a key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    // Advance 30 s -> heartbeat should carry active: true
    await vi.advanceTimersByTimeAsync(30_000);

    const req1 = ctl.expectOne('/api/sandbox/v3/demo-sessions/heartbeat');
    expect(req1.request.body).toEqual({ demoSession: 'sess-active', active: true });
    req1.flush(null, { status: 204, statusText: 'No Content' });

    // Advance another 30 s without interaction -> active: false
    await vi.advanceTimersByTimeAsync(30_000);
    const req2 = ctl.expectOne('/api/sandbox/v3/demo-sessions/heartbeat');
    expect(req2.request.body).toEqual({ demoSession: 'sess-active', active: false });
    req2.flush(null, { status: 204, statusText: 'No Content' });

    // Simulate visitor clicking
    window.dispatchEvent(new MouseEvent('click'));
    await vi.advanceTimersByTimeAsync(30_000);
    const req3 = ctl.expectOne('/api/sandbox/v3/demo-sessions/heartbeat');
    expect(req3.request.body).toEqual({ demoSession: 'sess-active', active: true });
    req3.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('stops on 404 DEMO_SESSION_ENDED and signs the visitor out with message', async () => {
    const signOutSpy = vi.spyOn(auth, 'signOut').mockResolvedValue();
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    presence.start('sess-ended');
    await vi.advanceTimersByTimeAsync(30_000);

    const req = ctl.expectOne('/api/sandbox/v3/demo-sessions/heartbeat');
    req.flush(
      { code: 'DEMO_SESSION_ENDED', title: 'Session Ended' },
      { status: 404, statusText: 'Not Found' },
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(signOutSpy).toHaveBeenCalled();
    expect(presence.notice()).toBe(DEMO_ENDED_MESSAGE);

    // Heartbeat timer should have been stopped
    await vi.advanceTimersByTimeAsync(60_000);
    ctl.expectNone('/api/sandbox/v3/demo-sessions/heartbeat');
  });

  it('does not leave on pagehide: a reload fires it too, and must not end the demo', () => {
    const originalSendBeacon = navigator.sendBeacon;
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
      writable: true,
    });

    try {
      presence.start('sess-beacon');
      window.dispatchEvent(new Event('pagehide'));

      expect(sendBeaconSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: originalSendBeacon,
        configurable: true,
        writable: true,
      });
    }
  });

  it('sends beacon on explicit leave() call', () => {
    const originalSendBeacon = navigator.sendBeacon;
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
      writable: true,
    });

    try {
      presence.start('sess-leave');
      presence.leave();

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/sandbox/v3/demo-sessions/leave',
        JSON.stringify({ demoSession: 'sess-leave' }),
      );
    } finally {
      Object.defineProperty(navigator, 'sendBeacon', {
        value: originalSendBeacon,
        configurable: true,
        writable: true,
      });
    }
  });
});
