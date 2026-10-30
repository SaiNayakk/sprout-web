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
    a.brand { text-decoration: none; color: var(--ink); }
    .regions { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin: 18px 0 28px; }
    .region { padding: 16px 18px; }
    .region h2 { margin: 0 0 4px; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }

    /* Status dot — colour is a secondary signal only; the text label carries the meaning */
    .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--line); display: inline-block; flex-shrink: 0; }
    .dot.up       { background: var(--leaf); }
    .dot.degraded { background: var(--marigold); }
    .dot.down     { background: var(--loss); }

    /* State label colours — always text-on-card safe (WCAG AA) */
    .state-label { font-size: .8rem; font-weight: 600; padding: 1px 7px; border-radius: 999px; }
    .state-label.up       { background: var(--leaf-soft);     color: var(--leaf-text); }
    .state-label.degraded { background: var(--marigold-soft); color: var(--marigold-text); }
    .state-label.down     { background: var(--danger-soft);   color: var(--loss); }
    .state-label.unknown  { background: transparent; border: 1px solid var(--line); color: var(--ink-soft); }

    ul.events { list-style: none; padding: 0; margin: 8px 0 0; }
    ul.events li { display: flex; gap: 14px; padding: 9px 0; border-top: 1px solid var(--line); }
    ul.events time { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 5.5rem; }

    .updated { color: var(--ink-soft); font-size: .8rem; margin-bottom: 4px; }

    /* ── Skeleton ── */
    @keyframes shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }
    .skel {
      border-radius: 6px;
      background: linear-gradient(90deg, var(--line) 25%, color-mix(in srgb, var(--line) 55%, var(--card)) 50%, var(--line) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .skel { animation: none; background: var(--line); }
    }
    .skel-card { padding: 16px 18px; min-height: 90px; }
    .skel-line { height: 14px; margin: 8px 0; }
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
                {{ r.detail }}@if (r.lastSeenSeconds !== null) { · last heard {{ r.lastSeenSeconds }} s ago }
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
