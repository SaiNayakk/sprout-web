import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Auth } from '../core/auth';
import { Landing } from './landing';

const personas = {
  groups: [
    { code: 'WOMEN', label: 'A woman' },
    { code: 'MEN', label: 'A man' },
    { code: 'NON_BINARY_AND_OTHER', label: 'Non-binary or another gender' },
    { code: 'ANY', label: 'No preference' },
  ],
  personas: [
    { id: 'meera', name: 'Meera Iyer', pronouns: 'she/her', group: 'WOMEN', city: 'Chennai', story: 'A physiotherapist.', style: 'STEADY_PLANS' },
    { id: 'kiran', name: 'Kiran Joshi', pronouns: 'they/them', group: 'NON_BINARY_AND_OTHER', city: 'Dehradun', story: 'A photographer.', style: 'ROUND_UPS' },
  ],
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('offers the four ways in the sandbox gives, and the people behind them', async () => {
    const f = TestBed.createComponent(Landing);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/sandbox/v1/personas').flush(personas);
    await tick();
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent!;
    for (const label of ['A woman', 'A man', 'Non-binary or another gender', 'No preference']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('Meera Iyer');
    expect(text).toContain('they/them');
    expect(text).toContain('Round-ups into a goal');
    expect((f.nativeElement as HTMLElement).querySelectorAll('.groups button')).toHaveLength(4);
  });

  it('starts a demo for the group chosen, keeps the session and goes home', async () => {
    const f = TestBed.createComponent(Landing);
    const ctl = TestBed.inject(HttpTestingController);
    f.detectChanges();
    ctl.expectOne('/api/sandbox/v1/personas').flush(personas);
    await tick();
    f.detectChanges();
    const go = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    ((f.nativeElement as HTMLElement).querySelectorAll('.groups button')[2] as HTMLButtonElement).click();
    const req = ctl.expectOne('/api/sandbox/v1/demo-sessions');
    expect(req.request.body).toEqual({ group: 'NON_BINARY_AND_OTHER' });
    req.flush({ accessToken: 'a', tokenType: 'Bearer', expiresIn: 900, refreshToken: 'r', persona: personas.personas[1] });
    await tick();
    expect(go).toHaveBeenCalledWith('/home');
    expect(TestBed.inject(Auth).name()).toBe('Kiran Joshi');
  });

  it('says so, and offers another try, when nobody can be signed in yet', async () => {
    const f = TestBed.createComponent(Landing);
    const ctl = TestBed.inject(HttpTestingController);
    f.detectChanges();
    ctl.expectOne('/api/sandbox/v1/personas').flush(personas);
    await tick();
    f.detectChanges();
    ((f.nativeElement as HTMLElement).querySelectorAll('.groups button')[0] as HTMLButtonElement).click();
    ctl.expectOne('/api/sandbox/v1/demo-sessions').flush(
      { title: 'Temporarily unavailable', status: 503, code: 'UPSTREAM_UNAVAILABLE', detail: 'Everyone in that group is still being set up, or busy. Try again in a minute.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await tick();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('still being set up');
    expect(TestBed.inject(Auth).signedIn()).toBe(false);
  });

  it('hides the chooser where there is no sandbox, without an error', async () => {
    const f = TestBed.createComponent(Landing);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/sandbox/v1/personas').flush({}, { status: 404, statusText: 'Not Found' });
    await tick();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.choose')).toBeNull();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Sign in');
  });
});
