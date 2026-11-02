import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Api } from '../core/api';
import { Order } from '../core/types';
import { Orders } from './orders';

const order = (id: string, extra: Partial<Order> = {}): Order => ({
  id,
  symbol: 'INKWELL',
  side: 'BUY',
  quantity: 1,
  orderType: 'MARKET',
  product: 'CNC',
  variety: 'REGULAR',
  status: 'FILLED',
  blocked: '0',
  price: '100.00',
  value: '100.00',
  createdAt: '2026-11-02T07:00:00Z',
  updatedAt: '2026-11-02T07:00:00Z',
  ...extra,
});

describe('Orders', () => {
  async function render(orders: Order[]) {
    const api = {
      get: vi.fn().mockResolvedValue({ orders }),
      getWithHeaders: vi.fn().mockResolvedValue({
        body: { orderId: 'x', complete: true, steps: [] },
        headers: new HttpHeaders(),
      }),
    };
    TestBed.configureTestingModule({
      imports: [Orders],
      providers: [provideRouter([]), { provide: Api, useValue: api }],
    });
    const fixture = TestBed.createComponent(Orders);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve)); // the page's loader settles
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, update: () => fixture.detectChanges() };
  }

  it('keeps one pipeline open when another opens, so nothing above moves', async () => {
    const { el, update } = await render([order('a-1'), order('b-2')]);
    const toggles = () => Array.from(el.querySelectorAll<HTMLButtonElement>('button.toggle'));
    const expanded = () => toggles().map((t) => t.getAttribute('aria-expanded'));

    toggles()[0].click();
    update();
    toggles()[1].click();
    update();
    expect(expanded()).toEqual(['true', 'true']);
    expect(el.querySelectorAll('app-pipeline').length).toBe(2);

    toggles()[0].click();
    update();
    expect(expanded()).toEqual(['false', 'true']);
    expect(el.querySelectorAll('app-pipeline').length).toBe(1);
  });

  it('separates the symbol from what was ordered, and says where a plan order came from', async () => {
    const { el } = await render([order('a-1', { quantity: 3, tag: 'sip:plan-1' })]);
    expect(el.querySelector('.sym')?.textContent?.trim()).toBe('INKWELL');
    expect(el.querySelector('.side')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Buy 3 shares');
    expect(el.querySelector('.meta')?.textContent).toContain('Market · Delivery · From a plan · ');
  });
});
