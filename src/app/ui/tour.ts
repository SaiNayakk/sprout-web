import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  route?: string;
  targetSelector: string;
  statusLink?: boolean;
  docsLink?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'account',
    title: 'Your demo account',
    text: 'You have ₹1,00,000 and a month of simulated history to explore Sprout without real money.',
    route: '/home',
    targetSelector: '[data-tour="balance"]',
  },
  {
    id: 'buy',
    title: 'Buy a stock',
    text: 'Choose a share from the market and place a buy order to test the execution engine.',
    route: '/markets',
    targetSelector: '[data-tour="buy-stock"]',
  },
  {
    id: 'pipeline',
    title: 'Watch it travel',
    text: 'When you place an order, the live trade pipeline traces it across services: gateway, OMS, accounts, exchange, and ledger.',
    route: '/orders',
    targetSelector: '[data-tour="pipeline"]',
  },
  {
    id: 'portfolio',
    title: 'Your portfolio',
    text: 'Your investments and live valuations show here on home, updating with real-time price feeds.',
    route: '/home',
    targetSelector: '[data-tour="portfolio"]',
  },
  {
    id: 'region',
    title: 'Which region served you',
    text: 'See which active region processed your request—phone (Region A) or laptop (Region B)—with instant failover.',
    route: '/home',
    targetSelector: '[data-tour="status-strip"]',
  },
  {
    id: 'resilience',
    title: 'How it stays up',
    text: 'Sprout runs dual-region active-active with witness heartbeats outside both regions. Learn how it stays resilient.',
    route: '/status',
    targetSelector: '[data-tour="system-status"]',
    statusLink: true,
    docsLink: true,
  },
];

const TOUR_STORAGE_KEY = 'sprout.demo_tour_dismissed';

export function isTourDismissed(): boolean {
  try {
    return sessionStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTourDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      sessionStorage.setItem(TOUR_STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(TOUR_STORAGE_KEY);
    }
  } catch {
    // Ignore in sandboxed or private browsing environments
  }
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);

  readonly steps = TOUR_STEPS;
  readonly active = signal(false);
  readonly currentStepIndex = signal(0);
  readonly placedOrderId = signal<string | null>(null);

  readonly currentStep = computed(() => this.steps[this.currentStepIndex()]);
  readonly totalSteps = computed(() => this.steps.length);
  readonly isFirst = computed(() => this.currentStepIndex() === 0);
  readonly isLast = computed(() => this.currentStepIndex() === this.steps.length - 1);

  readonly stepText = computed(() => {
    const step = this.currentStep();
    if (step.id === 'pipeline' && !this.placedOrderId()) {
      return "You haven't placed an order yet. Buy a share on the Markets page to see the live trade pipeline in action.";
    }
    return step.text;
  });

  readonly stepTargetSelector = computed(() => {
    const step = this.currentStep();
    if (step.id === 'pipeline' && !this.placedOrderId()) {
      return '';
    }
    return step.targetSelector;
  });

  recordOrder(orderId: string): void {
    this.placedOrderId.set(orderId);
  }

  isDismissed(): boolean {
    return isTourDismissed();
  }

  async start(stepIndex = 0): Promise<void> {
    setTourDismissed(false);
    this.active.set(true);
    await this.goTo(stepIndex);
  }

  async next(): Promise<void> {
    if (this.isLast()) {
      this.finish();
      return;
    }
    await this.goTo(this.currentStepIndex() + 1);
  }

  async back(): Promise<void> {
    if (this.isFirst()) {
      return;
    }
    await this.goTo(this.currentStepIndex() - 1);
  }

  skip(): void {
    this.dismiss();
  }

  finish(): void {
    this.dismiss();
  }

  dismiss(): void {
    this.active.set(false);
    setTourDismissed(true);
  }

  async goTo(index: number): Promise<void> {
    if (index < 0 || index >= this.steps.length) {
      this.dismiss();
      return;
    }

    const step = this.steps[index];
    if (step.route) {
      const currentUrl = this.router.url.split('?')[0];
      const targetMatches = currentUrl === step.route || currentUrl.startsWith(step.route + '/');
      if (!targetMatches) {
        await this.router.navigateByUrl(step.route);
        // Short pause for component DOM to be mounted
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    this.currentStepIndex.set(index);
  }
}

/**
 * Overlay component for guided walkthrough.
 * Displays a dimmed backdrop with highlighted target element and accessible card.
 */
@Component({
  selector: 'app-tour',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    .tour-backdrop {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--ink) 65%, transparent);
      z-index: 9998;
      backdrop-filter: blur(2px);
    }
    .tour-spotlight {
      position: fixed;
      z-index: 9999;
      box-shadow: 0 0 0 9999px color-mix(in srgb, var(--ink) 65%, transparent);
      border: 2px solid var(--leaf);
      border-radius: var(--radius-lg);
      pointer-events: none;
      transition: top var(--duration-moderate) var(--ease-out),
                  left var(--duration-moderate) var(--ease-out),
                  width var(--duration-moderate) var(--ease-out),
                  height var(--duration-moderate) var(--ease-out);
    }
    .tour-card {
      position: fixed;
      z-index: 10000;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: var(--space-4) var(--space-5);
      box-shadow: 0 10px 32px color-mix(in srgb, var(--ink) 35%, transparent);
      width: min(calc(100vw - 32px), 360px);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      transform-origin: center;
      opacity: 1;
      transform: scale(1);
      transition: opacity var(--duration-normal) var(--ease-out),
                  transform var(--duration-normal) var(--ease-out),
                  top var(--duration-moderate) var(--ease-out),
                  left var(--duration-moderate) var(--ease-out),
                  bottom var(--duration-moderate) var(--ease-out);
    }
    @starting-style {
      .tour-card {
        opacity: 0;
        transform: scale(0.96);
      }
    }
    .tour-card:focus {
      outline: none;
    }
    .tour-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-2);
    }
    .tour-title {
      margin: 0;
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--ink);
    }
    .tour-body {
      font-size: var(--text-sm);
      color: var(--ink-soft);
      line-height: 1.45;
      margin: 0;
    }
    .tour-links {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: var(--text-sm);
    }
    .tour-dots {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot-btn {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      border: none;
      background: var(--line);
      padding: 0;
      cursor: pointer;
      touch-action: manipulation;
      transition: background var(--duration-fast) ease, transform var(--duration-fast) var(--ease-out);
    }
    .dot-btn:active {
      transform: scale(1.15);
    }
    @media (hover: hover) and (pointer: fine) {
      .dot-btn:hover:not(.active) {
        background: color-mix(in srgb, var(--ink-soft) 50%, var(--line));
      }
    }
    .dot-btn.active {
      background: var(--leaf);
      transform: scale(1.3);
    }
    .tour-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--space-1);
      padding-top: var(--space-2);
      border-top: 1px solid var(--line);
    }
    .btn-group {
      display: flex;
      gap: var(--space-1);
    }
    @media (max-width: 360px) {
      .tour-card {
        padding: var(--space-3);
        width: calc(100vw - 24px);
        left: 12px !important;
      }
    }
  `,
  template: `
    @if (tour.active()) {
      <!-- Dimmed backdrop if no target is highlighted -->
      @if (!spotlightRect()) {
        <div class="tour-backdrop" (click)="tour.skip()" aria-hidden="true"></div>
      }

      <!-- Spotlight cutout around targeted element -->
      @if (spotlightRect(); as rect) {
        <div
          class="tour-spotlight"
          [style.top.px]="rect.top"
          [style.left.px]="rect.left"
          [style.width.px]="rect.width"
          [style.height.px]="rect.height"
          aria-hidden="true"
        ></div>
      }

      <!-- Tour dialog card -->
      <div
        #card
        class="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-card-title"
        aria-describedby="tour-card-desc"
        tabindex="-1"
        [style.top]="cardPosition().top"
        [style.bottom]="cardPosition().bottom"
        [style.left]="cardPosition().left"
        (keydown)="onKeydown($event)"
      >
        <div class="tour-header">
          <div>
            <span class="label" style="font-size:var(--text-xs)">
              Step <span class="num">{{ tour.currentStepIndex() + 1 }}</span> of <span class="num">{{ tour.totalSteps() }}</span>
            </span>
            <h2 id="tour-card-title" class="tour-title">{{ tour.currentStep().title }}</h2>
          </div>
          <button
            class="btn quiet small"
            type="button"
            aria-label="Skip tour"
            style="min-height:28px; padding:0.2rem 0.5rem"
            (click)="tour.skip()"
          >
            ✕
          </button>
        </div>

        <p id="tour-card-desc" class="tour-body">
          {{ tour.stepText() }}
        </p>

        @if (tour.currentStep().statusLink || tour.currentStep().docsLink) {
          <div class="tour-links">
            @if (tour.currentStep().statusLink) {
              <a routerLink="/status" (click)="tour.finish()">Check system status →</a>
            }
            @if (tour.currentStep().docsLink) {
              <a
                href="https://github.com/SaiNayakk/sprout-platform"
                target="_blank"
                rel="noopener noreferrer"
              >
                Platform docs & architecture ↗
              </a>
            }
          </div>
        }

        <div class="tour-footer">
          <div class="tour-dots" role="tablist" aria-label="Tour progress">
            @for (step of tour.steps; track step.id; let i = $index) {
              <button
                type="button"
                class="dot-btn"
                [class.active]="i === tour.currentStepIndex()"
                [attr.aria-current]="i === tour.currentStepIndex() ? 'step' : null"
                [attr.aria-label]="'Go to step ' + (i + 1) + ': ' + step.title"
                (click)="tour.goTo(i)"
              ></button>
            }
          </div>

          <div class="btn-group">
            <button
              class="btn secondary small"
              type="button"
              [disabled]="tour.isFirst()"
              (click)="tour.back()"
            >
              Back
            </button>
            <button
              #nextBtn
              class="btn small tour-next-btn"
              type="button"
              (click)="tour.next()"
            >
              {{ tour.isLast() ? 'Finish' : 'Next' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Tour {
  protected readonly tour = inject(TourService);
  private readonly cardEl = viewChild<ElementRef<HTMLElement>>('card');
  private readonly nextBtnEl = viewChild<ElementRef<HTMLButtonElement>>('nextBtn');

  protected readonly spotlightRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);
  protected readonly cardPosition = signal<{ top?: string; bottom?: string; left?: string }>({
    top: '20%',
    left: 'calc(50% - 180px)',
  });

  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.tour.active()) {
        const step = this.tour.currentStep();
        if (typeof document !== 'undefined') {
          this.previousActiveElement ??= document.activeElement as HTMLElement | null;
          this.recalculateTarget(this.tour.stepTargetSelector());
        }
      } else {
        this.spotlightRect.set(null);
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          this.previousActiveElement.focus();
        }
        this.previousActiveElement = null;
      }
    });

    if (typeof window !== 'undefined') {
      const update = () => {
        if (this.tour.active()) {
          this.recalculateTarget(this.tour.stepTargetSelector());
        }
      };
      window.addEventListener('resize', update, { passive: true });
      window.addEventListener('scroll', update, { passive: true });
    }
  }

  private recalculateTarget(selector: string): void {
    if (typeof document === 'undefined') return;

    // Retry finding element if not immediately in DOM
    const findAndPosition = () => {
      let target: HTMLElement | null = null;
      if (selector) {
        try {
          target = document.querySelector(selector);
        } catch {
          target = null;
        }
      }

      if (!target) {
        this.spotlightRect.set(null);
        this.cardPosition.set({
          top: '25%',
          left: 'max(16px, calc(50% - 180px))',
        });
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const rect = target.getBoundingClientRect();
      const pad = 6;
      this.spotlightRect.set({
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });

      const cardWidth = Math.min(window.innerWidth - 32, 360);
      const cardHeight = 250;
      let top: string | undefined;
      let bottom: string | undefined;
      const left = `${Math.max(16, Math.min(rect.left, window.innerWidth - cardWidth - 16))}px`;

      if (rect.bottom + cardHeight + 20 < window.innerHeight) {
        top = `${rect.bottom + 12}px`;
      } else if (rect.top - cardHeight - 20 > 0) {
        top = `${Math.max(16, rect.top - cardHeight - 12)}px`;
      } else {
        bottom = 'calc(65px + env(safe-area-inset-bottom, 0px))';
      }

      this.cardPosition.set({ top, bottom, left });
    };

    findAndPosition();
    // Run second check shortly after in case of route transition
    setTimeout(findAndPosition, 120);
    setTimeout(() => this.nextBtnEl()?.nativeElement?.focus(), 150);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.tour.skip();
      return;
    }

    if (event.key === 'Tab') {
      const container = this.cardEl()?.nativeElement;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
