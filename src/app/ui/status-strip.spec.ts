import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Regions, SystemStatus } from '../core/regions';
import { StatusStrip } from './status-strip';

describe('StatusStrip', () => {
  let fixture: ComponentFixture<StatusStrip>;
  let component: StatusStrip;
  let mockStatusSignal: ReturnType<typeof signal<SystemStatus | null>>;

  beforeEach(() => {
    mockStatusSignal = signal<SystemStatus | null>(null);

    const mockRegions = {
      status: mockStatusSignal,
      watch: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [StatusStrip],
      providers: [
        provideRouter([]),
        { provide: Regions, useValue: mockRegions },
      ],
    });

    fixture = TestBed.createComponent(StatusStrip);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders default up status and copies in sync when status is null', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Region A: phone ✓');
    expect(text).toContain('Region B: laptop ✓');
    expect(text).toContain('copies in sync');
  });

  it('reflects degraded or down state from regions service', () => {
    mockStatusSignal.set({
      overall: 'degraded',
      customersServed: true,
      summary: 'Failover in progress',
      regions: [
        { id: 'a', name: 'Region A', status: 'degraded', detail: '', lastSeenSeconds: 10 },
        { id: 'b', name: 'Region B', status: 'down', detail: '', lastSeenSeconds: null },
      ],
      events: [],
      updated: 100,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Region A: phone ⚠');
    expect(text).toContain('Region B: laptop ✗');
    expect(text).toContain('copies syncing');
  });

  it('links to /status and has accessibility data-tour attribute', () => {
    const link = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('href')).toBe('/status');
    expect(link.getAttribute('data-tour')).toBe('status-strip');
  });
});
