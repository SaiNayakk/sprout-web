import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UpiPay } from './upi-pay';

const tick = () => new Promise((r) => setTimeout(r, 0));

async function open() {
  const f = TestBed.createComponent(UpiPay);
  const ctl = TestBed.inject(HttpTestingController);
  f.detectChanges();
  ctl.expectOne('/api/bank/v1/merchants').flush({ merchants: [{ vpa: 'chai@shop', name: 'Chai Point', category: 'Food' }] });
  await tick();
  f.detectChanges();
  return { f, ctl, el: f.nativeElement as HTMLElement };
}

function fill(el: HTMLElement, id: string, v: string, event = 'input') {
  const input = el.querySelector('#' + id) as HTMLInputElement | HTMLSelectElement;
  input.value = v;
  input.dispatchEvent(new Event(event));
}

async function pay(el: HTMLElement, f: { detectChanges(): void }) {
  fill(el, 'ppin', '1234');
  f.detectChanges();
  (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  await tick();
}

describe('UpiPay', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends an Idempotency-Key, keeps it after a 503 and takes a new one after a success', async () => {
    const { f, ctl, el } = await open();
    fill(el, 'who', 'chai@shop', 'change');
    fill(el, 'pamount', '46');
    f.detectChanges();

    await pay(el, f);
    const first = ctl.expectOne('/api/bank/v1/payments');
    const key = first.request.headers.get('Idempotency-Key');
    expect(key).toBeTruthy();
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    await tick();
    f.detectChanges();

    await pay(el, f);
    const retry = ctl.expectOne('/api/bank/v1/payments');
    expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
    retry.flush({ id: 't1' }, { status: 201, statusText: 'Created' });
    await tick();
    f.detectChanges();

    fill(el, 'pamount', '46');
    await pay(el, f);
    const next = ctl.expectOne('/api/bank/v1/payments');
    expect(next.request.headers.get('Idempotency-Key')).not.toBe(key);
    next.flush({ id: 't2' }, { status: 201, statusText: 'Created' });
    await tick();
  });

  it('takes a new key after a refusal and when the amount changes', async () => {
    const { f, ctl, el } = await open();
    fill(el, 'who', 'chai@shop', 'change');
    fill(el, 'pamount', '46');
    f.detectChanges();

    await pay(el, f);
    const first = ctl.expectOne('/api/bank/v1/payments');
    const key = first.request.headers.get('Idempotency-Key');
    first.flush({ code: 'INVALID_PIN', title: 'Wrong PIN' }, { status: 403, statusText: 'Forbidden' });
    await tick();
    f.detectChanges();

    await pay(el, f);
    const second = ctl.expectOne('/api/bank/v1/payments');
    const key2 = second.request.headers.get('Idempotency-Key');
    expect(key2).not.toBe(key);
    second.flush({}, { status: 503, statusText: 'Unavailable' });
    await tick();
    f.detectChanges();

    fill(el, 'pamount', '50');
    await pay(el, f);
    const third = ctl.expectOne('/api/bank/v1/payments');
    expect(third.request.headers.get('Idempotency-Key')).not.toBe(key2);
    third.flush({}, { status: 503, statusText: 'Unavailable' });
    await tick();
  });
});
