import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Api } from '../core/api';
import { CELL_HEADER } from '../core/cells';
import { Pipeline, PipelineTrace } from './pipeline';

describe('Pipeline', () => {
  let fixture: ComponentFixture<Pipeline>;
  let component: Pipeline;
  let mockApi: { get: ReturnType<typeof vi.fn>; getWithHeaders: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = {
      get: vi.fn(),
      getWithHeaders: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [Pipeline],
      providers: [{ provide: Api, useValue: mockApi }],
    });

    fixture = TestBed.createComponent(Pipeline);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.stop();
    vi.useRealTimers();
  });

  it('polls /oms/v1/orders/{orderId}/trace and keeps polling on 404 for at most 3 s', async () => {
    mockApi.getWithHeaders
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce({
        body: {
          orderId: 'ord-123',
          complete: false,
          steps: [
            { service: 'oms', step: 'Order received', at: '2026-10-30T00:00:00Z', status: 'ok' },
          ],
        } as PipelineTrace,
        headers: new HttpHeaders({ [CELL_HEADER]: 'a' }),
      })
      .mockResolvedValueOnce({
        body: {
          orderId: 'ord-123',
          complete: true,
          steps: [
            { service: 'oms', step: 'Order received', at: '2026-10-30T00:00:00Z', status: 'ok' },
            { service: 'ledger', step: 'Funds held', at: '2026-10-30T00:00:00.010Z', durationMs: 10, status: 'ok' },
          ],
        } as PipelineTrace,
        headers: new HttpHeaders({ [CELL_HEADER]: 'a' }),
      });

    fixture.componentRef.setInput('orderId', 'ord-123');
    fixture.detectChanges();
    expect(component.polling()).toBe(true);

    // Initial tick (404)
    await vi.advanceTimersByTimeAsync(0);
    expect(mockApi.getWithHeaders).toHaveBeenCalledTimes(1);
    expect(mockApi.getWithHeaders).toHaveBeenCalledWith('/oms/v1/orders/ord-123/trace');
    expect(component.polling()).toBe(true);

    // Advance 400ms -> second tick (partial)
    await vi.advanceTimersByTimeAsync(400);
    expect(mockApi.getWithHeaders).toHaveBeenCalledTimes(2);
    expect(component.polling()).toBe(true);
    expect(component.trace()?.steps.length).toBe(1);

    // Advance 400ms -> third tick (complete=true)
    await vi.advanceTimersByTimeAsync(400);
    expect(mockApi.getWithHeaders).toHaveBeenCalledTimes(3);
    expect(component.polling()).toBe(false);
    expect(component.trace()?.complete).toBe(true);
    expect(component.trace()?.steps.length).toBe(2);
  });

  it('stops polling immediately when complete is true', async () => {
    mockApi.getWithHeaders.mockResolvedValueOnce({
      body: {
        orderId: 'ord-456',
        complete: true,
        steps: [
          { service: 'oms', step: 'Order received', at: '2026-10-30T00:00:00Z', status: 'ok' },
          { service: 'exchange', step: 'Matched on the exchange at ₹158.20', at: '2026-10-30T00:00:00.012Z', durationMs: 12, status: 'ok' },
        ],
      } as PipelineTrace,
      headers: new HttpHeaders({ [CELL_HEADER]: 'b' }),
    });

    fixture.componentRef.setInput('orderId', 'ord-456');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(component.polling()).toBe(false);
    expect(component.trace()?.complete).toBe(true);
    expect(mockApi.getWithHeaders).toHaveBeenCalledTimes(1);
  });

  it('stops polling when a step has status failed and records detail', async () => {
    mockApi.getWithHeaders.mockResolvedValueOnce({
      body: {
        orderId: 'ord-fail',
        complete: false,
        steps: [
          { service: 'oms', step: 'Accepted', at: '2026-10-30T00:00:00Z', status: 'ok' },
          { service: 'ledger', step: 'Funds hold', at: '2026-10-30T00:00:00.010Z', durationMs: 10, status: 'failed', detail: 'Insufficient margin' },
        ],
      } as PipelineTrace,
      headers: new HttpHeaders({ [CELL_HEADER]: 'a' }),
    });

    fixture.componentRef.setInput('orderId', 'ord-fail');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(component.polling()).toBe(false);
    expect(component.trace()?.steps[1].status).toBe('failed');
    expect(component.trace()?.steps[1].detail).toBe('Insufficient margin');
  });

  it('stops polling after 15 seconds pass and marks timedOut', async () => {
    mockApi.getWithHeaders.mockResolvedValue({
      body: {
        orderId: 'ord-slow',
        complete: false,
        steps: [
          { service: 'oms', step: 'Pending', at: '2026-10-30T00:00:00Z', status: 'pending' },
        ],
      } as PipelineTrace,
      headers: new HttpHeaders({ [CELL_HEADER]: 'a' }),
    });

    fixture.componentRef.setInput('orderId', 'ord-slow');
    fixture.detectChanges();

    // Run until 15s elapsed
    await vi.advanceTimersByTimeAsync(15_100);

    expect(component.polling()).toBe(false);
    expect(component.timedOut()).toBe(true);
  });

  it('formats total duration, maps service labels, and displays Served by <region name> from X-Sprout-Cell header', async () => {
    mockApi.getWithHeaders.mockResolvedValueOnce({
      body: {
        orderId: 'ord-region-a',
        complete: true,
        steps: [
          { service: 'oms', step: 'Accepted', at: '2026-10-30T00:00:00.000Z', status: 'ok' },
          { service: 'exchange', step: 'Placed', at: '2026-10-30T00:00:00.015Z', durationMs: 40, status: 'ok' },
        ],
      } as PipelineTrace,
      headers: new HttpHeaders({ [CELL_HEADER]: 'a' }),
    });

    fixture.componentRef.setInput('orderId', 'ord-region-a');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(component.regionLabel()).toBe('Served by Region A');
    expect(component.totalTime()).toBe('40 ms');

    // Friendly labels for oms -> Orders, exchange -> Exchange
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Orders');
    expect(fixture.nativeElement.textContent).toContain('Exchange');

    // Test Region B and portfolio -> Portfolio
    mockApi.getWithHeaders.mockResolvedValueOnce({
      body: {
        orderId: 'ord-region-b',
        complete: true,
        steps: [
          { service: 'portfolio', step: 'Holding credited', at: '2026-10-30T00:00:00.000Z', durationMs: 1050, status: 'ok' },
        ],
      } as PipelineTrace,
      headers: new HttpHeaders({ [CELL_HEADER]: 'b' }),
    });

    fixture.componentRef.setInput('orderId', 'ord-region-b');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(component.regionLabel()).toBe('Served by Region B');
    expect(component.totalTime()).toBe('1.05 s');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Portfolio');
  });

  it('stops polling on 404 after 3 seconds and shows quiet not found state', async () => {
    mockApi.getWithHeaders.mockRejectedValue(
      new HttpErrorResponse({ status: 404, statusText: 'Not Found' }),
    );

    fixture.componentRef.setInput('orderId', 'ord-missing');
    fixture.detectChanges();

    // Advance beyond 3 seconds of 404s
    await vi.advanceTimersByTimeAsync(3200);

    expect(component.polling()).toBe(false);
    expect(component.notFound()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Couldn't follow this order");
  });
});
