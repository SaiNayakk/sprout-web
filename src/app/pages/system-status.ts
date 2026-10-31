import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Regions, RegionState, relativeTime } from '../core/regions';
import { Logo } from '../ui/logo';
import { Status } from '../ui/status';

const STATE_LABEL: Record<RegionState, string> = {
  up: 'Up',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

/** Public: how the two regions are doing right now, and what they did lately. Read from the witness, which sits outside both. */
@Component({
  selector: 'app-system-status',
  imports: [RouterLink, Logo, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    header.bar {
      padding: calc(var(--space-3) + env(safe-area-inset-top, 0px))
               calc(var(--space-3) + env(safe-area-inset-right, 0px))
               var(--space-3)
               calc(var(--space-3) + env(safe-area-inset-left, 0px));
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
    }
    a.brand {
      text-decoration: none;
      color: var(--ink);
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font: 700 var(--text-lg) var(--display);
    }
    .regions {
      display: grid;
      gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      margin: var(--space-4) 0 var(--space-6);
    }
    .region { padding: var(--space-4); }
    .region h2 {
      margin: 0 0 var(--space-1);
      font-size: var(--text-base);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* Status dot — colour is a secondary signal only; the text label carries the meaning */
    .dot {
      width: 10px;
      height: 10px;
      border-radius: var(--radius-full);
      background: var(--line);
      display: inline-block;
      flex-shrink: 0;
    }
    .dot.up       { background: var(--leaf); }
    .dot.degraded { background: var(--marigold); }
    .dot.down     { background: var(--loss); }

    /* State label colours — always text-on-card safe (WCAG AA) */
    .state-label {
      font-size: var(--text-xs);
      font-weight: 600;
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
    }
    .state-label.up       { background: var(--leaf-soft);     color: var(--leaf-text); }
    .state-label.degraded { background: var(--marigold-soft); color: var(--marigold-text); }
    .state-label.down     { background: var(--danger-soft);   color: var(--loss); }
    .state-label.unknown  { background: transparent; border: 1px solid var(--line); color: var(--ink-soft); }

    ul.events { list-style: none; padding: 0; margin: var(--space-2) 0 0; }
    ul.events li { display: flex; gap: var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--line); }
    ul.events time { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 5.5rem; }

    .updated { color: var(--ink-soft); font-size: var(--text-xs); margin-bottom: var(--space-1); }

    /* ── Skeleton ── */
    @keyframes shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }
    .skel {
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--line) 25%, color-mix(in srgb, var(--line) 55%, var(--card)) 50%, var(--line) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .skel { animation: none; background: var(--line); }
    }
    .skel-card { padding: var(--space-4); min-height: 90px; }
    .skel-line { height: 14px; margin: var(--space-2) 0; }
    .skel-line.w60 { width: 60%; }
    .skel-line.w40 { width: 40%; }
    .skel-event { height: 36px; border-top: 1px solid var(--line); }
  `,
  template: `
    <header class="bar">
      <a routerLink="/" class="brand"><app-logo [size]="32" /> Sprout</a>
    </header>
    <main class="page" data-tour="system-status">
      <h1>System status</h1>

      @if (loading()) {
        <!-- Skeleton: two region cards + three event rows -->
        <div class="regions">
          <section class="card region skel-card" aria-hidden="true">
            <div class="skel skel-line w60"></div>
            <div class="skel skel-line w40"></div>
          </section>
          <section class="card region skel-card" aria-hidden="true">
            <div class="skel skel-line w60"></div>
            <div class="skel skel-line w40"></div>
          </section>
        </div>
        <h2>What happened lately</h2>
        <ul class="events" aria-hidden="true">
          <li><div class="skel skel-event" style="width:100%"></div></li>
          <li><div class="skel skel-event" style="width:100%"></div></li>
          <li><div class="skel skel-event" style="width:100%"></div></li>
        </ul>
      } @else if (regions.status(); as s) {
        <p class="lede" role="status">{{ s.summary }}</p>

        @if (updatedLabel()) {
          <p class="updated" aria-live="polite">{{ updatedLabel() }}</p>
        }

        <div class="regions">
          @for (r of s.regions; track r.id) {
            <section class="card region" [attr.aria-label]="r.name">
              <h2>
                <span [class]="'dot ' + r.status" aria-hidden="true"></span>
                {{ r.name }}
                <span [class]="'state-label ' + r.status">{{ label(r.status) }}</span>
              </h2>
              <p class="muted small">
                {{ r.detail }}@if (r.lastSeenSeconds !== null) { · last heard <span class="num">{{ r.lastSeenSeconds }}</span> s ago }
              </p>
            </section>
          }
        </div>

        <h2>What happened lately</h2>
        @if (s.events.length === 0) {
          <p class="muted">Nothing yet.</p>
        } @else {
          <ul class="events">
            @for (e of s.events; track e.at + e.text) {
              <li>
                <time
                  class="num"
                  [attr.datetime]="isoDate(e.at)"
                  [attr.title]="localDate(e.at)"
                  >{{ relative(e.at) }}</time
                ><span>{{ e.text }}</span>
              </li>
            }
          </ul>
        }
        <p class="muted small">
          Two regions each serve their own customers and each keeps a copy of the other's, so one can serve both. A small service outside
          both watches their heartbeats; this page reads it every 30 seconds.
        </p>
      } @else {
        <app-status
          error="The status service cannot be reached right now."
          (retry)="onRetry()"
        />
      }
    </main>
  `,
})
export class SystemStatus implements OnDestroy {
  protected readonly regions = inject(Regions);

  /** Ticks every second so the "updated N s ago" line stays live. */
  private readonly nowSeconds = signal(Date.now() / 1000);
  private readonly ticker = setInterval(() => this.nowSeconds.set(Date.now() / 1000), 1000);

  /** True only while the very first fetch is in flight (status is still null and no error yet). */
  protected readonly loading = signal(true);

  protected readonly updatedLabel = computed(() => {
    const s = this.regions.status();
    if (!s) return '';
    const diff = Math.max(0, this.nowSeconds() - s.updated);
    if (diff < 5) return 'Updated just now';
    if (diff < 60) return `Updated ${Math.floor(diff)} s ago`;
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)} min ago`;
    return `Updated ${Math.floor(diff / 3600)} h ago`;
  });

  constructor() {
    // Mark loading done as soon as the first answer arrives (status goes non-null OR stays null after first fetch)
    this.regions.watch();
    void this.regions.refresh().then(() => this.loading.set(false));
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }

  protected label(s: RegionState): string {
    return STATE_LABEL[s];
  }

  protected relative(unixSeconds: number): string {
    return relativeTime(unixSeconds, this.nowSeconds());
  }

  protected isoDate(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString();
  }

  protected localDate(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleString();
  }

  protected onRetry(): void {
    this.loading.set(true);
    void this.regions.refresh().then(() => this.loading.set(false));
  }
}
