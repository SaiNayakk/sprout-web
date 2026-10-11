import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Regions, RegionState } from '../core/regions';
import { Logo } from '../ui/logo';

const LABEL: Record<RegionState, string> = { up: 'Up', degraded: 'Degraded', down: 'Down', unknown: 'Unknown' };

/** Public: how the two regions are doing right now, and what they did lately. Read from the witness, which sits outside both. */
@Component({
  selector: 'app-system-status',
  imports: [DatePipe, RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    a.brand { text-decoration: none; color: var(--ink); }
    .regions { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin: 18px 0 28px; }
    .region { padding: 16px 18px; }
    .region h2 { margin: 0 0 4px; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--line); display: inline-block; }
    .up { background: var(--leaf); }
    .degraded { background: var(--marigold); }
    .down { background: var(--loss); }
    ul.events { list-style: none; padding: 0; margin: 8px 0 0; }
    ul.events li { display: flex; gap: 14px; padding: 9px 0; border-top: 1px solid var(--line); }
    ul.events time { color: var(--ink-soft); font-variant-numeric: tabular-nums; min-width: 4.5rem; }
  `,
  template: `
    <header class="bar">
      <a routerLink="/" class="brand"><app-logo [size]="32" /> Sprout</a>
    </header>
    <main class="page">
      <h1>System status</h1>
      @if (regions.status(); as s) {
        <p class="lede" role="status">{{ s.summary }}</p>
        <div class="regions">
          @for (r of s.regions; track r.id) {
            <section class="card region" [attr.aria-label]="r.name">
              <h2><span [class]="'dot ' + r.status" aria-hidden="true"></span>{{ r.name }} · {{ label(r.status) }}</h2>
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
              <li><time>{{ e.at * 1000 | date: 'HH:mm:ss' }}</time><span>{{ e.text }}</span></li>
            }
          </ul>
        }
        <p class="muted small">
          Two regions each serve their own customers and each keeps a copy of the other's, so one can serve both. A small service outside
          both watches their heartbeats; this page reads it every 30 seconds.
        </p>
      } @else {
        <p class="muted" role="status">The status service cannot be reached right now.</p>
      }
    </main>
  `,
})
export class SystemStatus {
  protected readonly regions = inject(Regions);

  constructor() {
    this.regions.watch();
    void this.regions.refresh();
  }

  protected label(s: RegionState): string {
    return LABEL[s];
  }
}
