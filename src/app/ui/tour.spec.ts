import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  Tour,
  TourService,
  isTourDismissed,
  setTourDismissed,
} from './tour';

describe('TourService', () => {
  let service: TourService;
  let mockRouter: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionStorage.clear();
    mockRouter = {
      url: '/home',
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        TourService,
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(TourService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('starts at step 0 and advances through steps sequentially', async () => {
    await service.start();
    expect(service.active()).toBe(true);
    expect(service.currentStepIndex()).toBe(0);
    expect(service.currentStep().title).toBe('Your demo account');
    expect(service.isFirst()).toBe(true);
    expect(service.isLast()).toBe(false);

    // Advance to step 1 (Buy a stock, route: /markets)
    await service.next();
    expect(service.currentStepIndex()).toBe(1);
    expect(service.currentStep().title).toBe('Buy a stock');
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/markets');

    // Go back to step 0
    mockRouter.url = '/markets';
    await service.back();
    expect(service.currentStepIndex()).toBe(0);
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('navigates route before activating step if target is on another page', async () => {
    mockRouter.url = '/home';
    await service.start(5); // step 5: "How it stays up", route: /status
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/status');
    expect(service.currentStepIndex()).toBe(5);
    expect(service.currentStep().title).toBe('How it stays up');
    expect(service.isLast()).toBe(true);
  });

  it('shows short note and points at nothing for step 3 if visitor skipped buying', async () => {
    await service.start(2); // step 2 = "Watch it travel"
    expect(service.currentStep().id).toBe('pipeline');
    expect(service.stepTargetSelector()).toBe('');
    expect(service.stepText()).toContain("haven't placed an order yet");
  });

  it('opens and targets pipeline for step 3 when visitor placed an order', async () => {
    service.recordOrder('ord-demo-123');
    await service.start(2); // step 2 = "Watch it travel"
    expect(service.currentStep().id).toBe('pipeline');
    expect(service.stepTargetSelector()).toBe('[data-tour="pipeline"]');
    expect(service.stepText()).toBe(service.currentStep().text);
  });

  it('records dismissal in sessionStorage on skip() or finish()', async () => {
    await service.start();
    expect(service.active()).toBe(true);

    service.skip();
    expect(service.active()).toBe(false);
    expect(isTourDismissed()).toBe(true);
    expect(sessionStorage.getItem('sprout.demo_tour_dismissed')).toBe('true');
  });

  it('restarts tour from step 0 when explicitly started, clearing dismissal flag', async () => {
    setTourDismissed(true);
    expect(isTourDismissed()).toBe(true);

    await service.start(0);
    expect(service.active()).toBe(true);
    expect(service.currentStepIndex()).toBe(0);
    expect(isTourDismissed()).toBe(false);
  });

  it('gracefully handles sessionStorage failure without throwing', () => {
    const originalGetItem = sessionStorage.getItem;
    const originalSetItem = sessionStorage.setItem;

    try {
      sessionStorage.getItem = () => {
        throw new Error('Access denied');
      };
      sessionStorage.setItem = () => {
        throw new Error('Quota exceeded');
      };

      expect(() => isTourDismissed()).not.toThrow();
      expect(isTourDismissed()).toBe(false);

      expect(() => setTourDismissed(true)).not.toThrow();
    } finally {
      sessionStorage.getItem = originalGetItem;
      sessionStorage.setItem = originalSetItem;
    }
  });
});

describe('Tour Component', () => {
  let fixture: ComponentFixture<Tour>;
  let component: Tour;
  let service: TourService;

  beforeEach(() => {
    sessionStorage.clear();
    const mockRouter = {
      url: '/home',
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      imports: [Tour],
      providers: [
        TourService,
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(TourService);
    fixture = TestBed.createComponent(Tour);
    component = fixture.componentInstance;
  });

  it('closes when Escape key is pressed', async () => {
    await service.start();
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    const skipSpy = vi.spyOn(service, 'skip');

    component['onKeydown'](event);
    expect(skipSpy).toHaveBeenCalled();
  });
});
