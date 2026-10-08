import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth, PUBLIC } from './auth';
import { authInterceptor } from './auth.interceptor';

const KEY = 'sprout.session';
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(saved: object | null) {
  localStorage.clear();
  if (saved) {
    localStorage.setItem(KEY, JSON.stringify(saved));
  }
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
  });
  return { auth: TestBed.inject(Auth), http: TestBed.inject(HttpClient), ctl: TestBed.inject(HttpTestingController) };
}

const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('Auth and the interceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the access token on Sprout calls but not on public ones', async () => {
    const { http, ctl } = setup({ accessToken: 'a1', refreshToken: 'r1' });
    const call = firstValueFrom(http.get('/api/oms/v1/funds'));
    const request = ctl.expectOne('/api/oms/v1/funds');
    expect(request.request.headers.get('Authorization')).toBe('Bearer a1');
    request.flush({});
    await call;
    const pub = firstValueFrom(http.get('/api/sandbox/v3/demo', { context: new HttpContext().set(PUBLIC, true) }));
    const open = ctl.expectOne('/api/sandbox/v3/demo');
    expect(open.request.headers.has('Authorization')).toBe(false);
    open.flush({});
    await pub;
  });

  it('refreshes ONCE when several calls fail together, then retries each with the new token', async () => {
    const { http, ctl } = setup({ accessToken: 'old', refreshToken: 'r1' });
    const a = firstValueFrom(http.get('/api/a'));
    const b = firstValueFrom(http.get('/api/b'));
    ctl.expectOne('/api/a').flush({}, unauthorized);
    ctl.expectOne('/api/b').flush({}, unauthorized);
    await tick();
    // single-use refresh tokens: a second refresh with the same token would end the whole session
    const refresh = ctl.expectOne('/api/identity/v1/tokens/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
    refresh.flush({ accessToken: 'new', tokenType: 'Bearer', expiresIn: 900, refreshToken: 'r2' });
    await tick();
    const retryA = ctl.expectOne('/api/a');
    const retryB = ctl.expectOne('/api/b');
    expect(retryA.request.headers.get('Authorization')).toBe('Bearer new');
    expect(retryB.request.headers.get('Authorization')).toBe('Bearer new');
    retryA.flush({ ok: 'a' });
    retryB.flush({ ok: 'b' });
    expect(await a).toEqual({ ok: 'a' });
    expect(await b).toEqual({ ok: 'b' });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ accessToken: 'new', refreshToken: 'r2' });
  });

  it('takes a newer token another tab already stored instead of refreshing again', async () => {
    const { http, ctl } = setup({ accessToken: 'old', refreshToken: 'r1' });
    const call = firstValueFrom(http.get('/api/x'));
    const first = ctl.expectOne('/api/x');
    // another tab refreshed and saved a new pair while this call was in flight with the old token
    localStorage.setItem(KEY, JSON.stringify({ accessToken: 'from-other-tab', refreshToken: 'r9' }));
    first.flush({}, unauthorized);
    await tick();
    ctl.expectNone('/api/identity/v1/tokens/refresh');
    const retry = ctl.expectOne('/api/x');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer from-other-tab');
    retry.flush({ done: true });
    expect(await call).toEqual({ done: true });
  });

  it('signs out when the refresh itself is refused', async () => {
    const { auth, http, ctl } = setup({ accessToken: 'old', refreshToken: 'dead' });
    const call = firstValueFrom(http.get('/api/x')).catch((e) => e);
    ctl.expectOne('/api/x').flush({}, unauthorized);
    await tick();
    ctl.expectOne('/api/identity/v1/tokens/refresh').flush({ code: 'INVALID_REFRESH_TOKEN' }, unauthorized);
    expect((await call).status).toBe(401);
    expect(auth.signedIn()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('does not try to refresh when nobody is signed in', async () => {
    const { http, ctl } = setup(null);
    const call = firstValueFrom(http.get('/api/x')).catch((e) => e);
    ctl.expectOne('/api/x').flush({}, unauthorized);
    expect((await call).status).toBe(401);
    ctl.expectNone('/api/identity/v1/tokens/refresh');
  });

  it('remembers who is signed in across a reload', () => {
    const { auth } = setup({ accessToken: 'a', refreshToken: 'r', name: 'Asha', demoEndsAt: '2026-10-08T20:00:00Z' });
    expect(auth.signedIn()).toBe(true);
    expect(auth.name()).toBe('Asha');
    expect(auth.isDemo()).toBe(true);
    expect(auth.demoEndsAt()).toBe('2026-10-08T20:00:00Z');
  });

  it('still shows the name of a demo session from before demo accounts of one\'s own', () => {
    const { auth } = setup({ accessToken: 'a', refreshToken: 'r', persona: { name: 'Meera Iyer', pronouns: 'she/her' } });
    expect(auth.name()).toBe('Meera Iyer');
    expect(auth.isDemo()).toBe(true);
  });
});
