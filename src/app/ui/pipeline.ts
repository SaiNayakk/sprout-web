import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Api } from '../core/api';
import { CELL_HEADER } from '../core/cells';
import { Regions } from '../core/regions';

export type PipelineService = 'oms' | 'ledger' | 'exchange' | 'portfolio';
export type PipelineStepStatus = 'ok' | 'failed' | 'pending';

export interface PipelineStep {
  service: PipelineService | string;
  step: string;
  at: string;
  durationMs?: number;
  status: PipelineStepStatus;
  detail?: string;
}

export interface PipelineTrace {
  orderId: string;
  complete: boolean;
  steps: PipelineStep[];
}

const SERVICE_LABELS: Record<string, string> = {
  oms: 'Orders',
  ledger: 'Ledger',
  exchange: 'Exchange',
  portfolio: 'Portfolio',
};

/**
 * Vertical stepper showing an order travelling through Sprout's distributed services live.
 * Polls GET /api/oms/v1/orders/{orderId}/trace every 400 ms until complete, failure, or 15 s timeout.
 */
@Component({
  selector: 'app-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .pipeline {
      margin: 1rem 0;
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: var(--radius);
      padding: 1.1rem 1.15rem;
      box-shadow: var(--shadow);
    }
    .head {
      margin-bottom: 0.75rem;
    }
    .title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 650;
    }
    .close-btn {
      min-height: 28px;
      padding: 0.2rem 0.5rem;
      font-size: 1rem;
      line-height: 1;
    }
    .pending-init {
      padding: 0.75rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .stepper {
      list-style: none;
      padding: 0;
      margin: 0.75rem 0;
      position: relative;
    }
    .stepper::before {
      content: '';
      position: absolute;
      top: 14px;
      bottom: 14px;
      left: 12px;
      width: 2px;
      background: var(--line);
    }
    .step-row {
      display: flex;
      gap: 0.85rem;
      padding: 0.45rem 0;
      position: relative;
      animation: stepIn 0.3s ease-out;
    }
    @keyframes stepIn {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .step-row {
        animation: none;
      }
    }
    .marker {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid var(--line);
      background: var(--card);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
      z-index: 1;
      color: var(--ink-soft);
    }
    .step-row.ok .marker {
      background: var(--leaf-soft);
      color: var(--leaf-text);
      border-color: var(--leaf);
    }
    .step-row.failed .marker {
      background: var(--danger-soft);
      color: var(--loss);
      border-color: var(--loss);
    }
    .step-row.failed .content .service,
    .step-row.failed .content .desc {
      color: var(--loss);
    }
    .step-row.pending .marker {
      background: var(--line);
      color: var(--ink-soft);
    }
    .content {
      flex: 1;
      min-width: 0;
    }
    .service {
      font-weight: 650;
      font-size: 0.95rem;
    }
    .desc {
      margin: 0.15rem 0 0;
      color: var(--ink-soft);
    }
    .detail.error {
      margin: 0.25rem 0 0;
      font-weight: 600;
      color: var(--loss);
    }
    .pulse-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--leaf);
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from {
        opacity: 0.3;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1.15);
      }
    }
    .foot {
      border-top: 1px solid var(--line);
      padding-top: 0.65rem;
      margin-top: 0.5rem;
    }
    .live-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    @media (max-width: 360px) {
      .pipeline {
        padding: 0.9rem;
      }
      .service {
        font-size: 0.875rem;
      }
    }
  `,
  template: `
    <section class="card pipeline" data-tour="pipeline" aria-label="Trade pipeline">
      <div class="row between head">
        <div>
          <h3 class="title">Trade pipeline</h3>
          <p class="mono small muted">{{ orderId() }}</p>
        </div>
        <div class="row">
          @if (regionLabel(); as reg) {
            <span class="chip plain">{{ reg }}</span>
          }
          <button
            class="btn quiet small close-btn"
            type="button"
            aria-label="Close pipeline"
            (click)="closed.emit()"
          >
            ✕
          </button>
        </div>
      </div>

      @if (notFound()) {
        <p class="small muted" role="status">Couldn't follow this order</p>
      } @else if (polling() && (!trace() || !trace()!.steps.length)) {
        <p class="small muted pending-init" role="status">
          <span class="pulse-dot"></span> Connecting to trade pipeline…
        </p>
      }

      <ol class="stepper" aria-live="polite" aria-label="Pipeline steps">
        @for (step of trace()?.steps ?? []; track step.service + step.step + step.at) {
          <li
            class="step-row"
            [class.ok]="step.status === 'ok'"
            [class.failed]="step.status === 'failed'"
            [class.pending]="step.status === 'pending'"
          >
            <div class="marker" aria-hidden="true">
              @if (step.status === 'ok') {
                ✓
              } @else if (step.status === 'failed') {
                ✗
              } @else {
                ·
              }
            </div>
            <div class="content">
              <div class="row between">
                <span class="service">{{ serviceLabel(step.service) }}</span>
                @if (step.durationMs !== undefined && step.durationMs !== null) {
                  <span class="duration num small muted">{{ step.durationMs }} ms</span>
                }
              </div>
              <p class="desc small">{{ step.step }}</p>
              @if (step.status === 'failed' && step.detail) {
                <p class="detail error small" role="alert">{{ step.detail }}</p>
              }
            </div>
          </li>
        }
      </ol>

      <div class="row between foot">
        <div class="small">
          @if (totalTime(); as t) {
            <span>Total time: <strong class="num">{{ t }}</strong></span>
          }
          @if (timedOut()) {
            <span class="error small">Timed out waiting for completion</span>
          }
        </div>
        @if (polling()) {
          <span class="small muted live-tag"><span class="pulse-dot"></span> Tracing…</span>
        }
      </div>
    </section>
  `,
})
export class Pipeline {
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);
  private readonly regions = inject(Regions, { optional: true });

  readonly orderId = input.required<string>();
  readonly closed = output<void>();

  readonly trace = signal<PipelineTrace | null>(null);
  readonly cell = signal<string | null>(null);
  readonly polling = signal(false);
  readonly timedOut = signal(false);
  readonly notFound = signal(false);

  pollIntervalMs = 400;
  timeoutMs = 15_000;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private pollStartTime = 0;
  private first404Time: number | null = null;

  constructor() {
    // only the order id starts polling: start() reads polling itself, and tracking that would restart it every time it stops
    effect(() => {
      const id = this.orderId();
      untracked(() => (id ? this.start(id) : this.stop()));
    });

    this.destroyRef.onDestroy(() => this.stop());
  }

  protected serviceLabel(service: string): string {
    return SERVICE_LABELS[service.toLowerCase()] ?? service;
  }

  private regionNameFor(cell: string): string {
    const reg = this.regions?.status()?.regions.find(
      (r) => r.id.toLowerCase() === cell.toLowerCase(),
    );
    if (reg) return reg.name;
    const lower = cell.toLowerCase();
    if (lower === 'a') return 'Region A';
    if (lower === 'b') return 'Region B';
    return cell.startsWith('Region ') ? cell : `Region ${cell.toUpperCase()}`;
  }

  readonly totalTime = computed(() => {
    const steps = this.trace()?.steps ?? [];
    const withDuration = steps.filter((s) => typeof s.durationMs === 'number');
    if (withDuration.length > 0) {
      const ms = withDuration.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
      return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
    }
    if (steps.length >= 2 && steps[0].at && steps[steps.length - 1].at) {
      const diff = new Date(steps[steps.length - 1].at).getTime() - new Date(steps[0].at).getTime();
      if (diff >= 0) {
        return diff < 1000 ? `${diff} ms` : `${(diff / 1000).toFixed(2)} s`;
      }
    }
    return null;
  });

  readonly regionLabel = computed(() => {
    const c = this.cell();
    if (!c) return '';
    return `Served by ${this.regionNameFor(c)}`;
  });

  start(orderId: string): void {
    this.stop();
    this.polling.set(true);
    this.timedOut.set(false);
    this.notFound.set(false);
    this.trace.set(null);
    this.cell.set(null);
    this.first404Time = null;
    this.pollStartTime = Date.now();
    // its own timer: checked only between polls, the limit would be up to one interval late
    this.deadline = setTimeout(() => {
      if (this.polling()) {
        this.timedOut.set(true);
        this.stop();
      }
    }, this.timeoutMs);
    void this.tick(orderId);
  }

  stop(): void {
    this.polling.set(false);
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.deadline !== null) {
      clearTimeout(this.deadline);
      this.deadline = null;
    }
  }

  async tick(orderId: string): Promise<void> {
    if (!this.polling()) {
      return;
    }

    if (Date.now() - this.pollStartTime >= this.timeoutMs) {
      this.timedOut.set(true);
      this.stop();
      return;
    }

    try {
      const res = await this.api.getWithHeaders<PipelineTrace>(`/oms/v1/orders/${orderId}/trace`);
      this.trace.set(res.body);
      this.first404Time = null;
      const cellHeader = res.headers.get(CELL_HEADER);
      if (cellHeader) {
        this.cell.set(cellHeader);
      }

      const hasFailed = res.body.steps?.some((s) => s.status === 'failed');
      if (res.body.complete || hasFailed) {
        this.stop();
        return;
      }
    } catch (e: unknown) {
      const is404 =
        e instanceof HttpErrorResponse
          ? e.status === 404
          : (e as { status?: number })?.status === 404 || String(e).includes('404');

      if (is404) {
        if (this.first404Time === null) {
          this.first404Time = Date.now();
        } else if (Date.now() - this.first404Time >= 3000) {
          this.notFound.set(true);
          this.stop();
          return;
        }
      }
    }

    if (this.polling()) {
      this.timer = setTimeout(() => void this.tick(orderId), this.pollIntervalMs);
    }
  }
}
