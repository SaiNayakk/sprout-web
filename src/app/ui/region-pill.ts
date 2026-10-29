import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Regions } from '../core/regions';

/**
 * A small floating pill on every page: are both regions up? Links to the status page.
 * Nothing is shown until the witness has answered.
 *
 * Tab-bar height (shell.ts):
 *   .tabs a: padding .5rem top + .45rem bottom + icon 1.25rem lh1 + gap 2px + label .72rem lh1.5
 *   ≈ 8 + 20 + 2 + 17.25 + 7.2 = ~55 px + env(safe-area-inset-bottom).
 *   The tab bar disappears at ≥860 px (shell breakpoint: @media (min-width: 860px) { .tabs { display: none } }).
 */
@Component({
  selector: 'app-region-pill',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { position: fixed; left: 12px; bottom: 12px; z-index: 5; }

    /* Lift clear of the signed-in tab bar (≈55 px) + 12 px gap.
       The tab bar disappears at 860 px (shell breakpoint). */
    @media (max-width: 859px) {
      :host { bottom: calc(55px + env(safe-area-inset-bottom) + 12px); }
    }

    a {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 12px; border-radius: 999px; font-size: 0.78rem;
      background: var(--card); color: var(--ink-soft);
      border: 1px solid var(--line); box-shadow: var(--shadow);
      text-decoration: none;
    }
    a:hover { color: var(--ink); }

    /* position: relative so the .sr-only child (position: absolute) stays contained */
    .dot {
      width: 9px; height: 9px; border-radius: 50%; background: var(--line);
      display: inline-block; flex-shrink: 0; position: relative;
    }
    .dot.up       { background: var(--leaf); }
    .dot.degraded { background: var(--marigold); }
    .dot.down     { background: var(--loss); }

    /* On very narrow screens (<360 px) collapse to the short label when all is normal */
    @media (max-width: 359px) {
      .label-full   { display: none; }
      .label-narrow { display: inline; }
    }
    @media (min-width: 360px) {
      .label-narrow { display: none; }
    }
  `,
  template: `
    @if (regions.status(); as s) {
      <a routerLink="/status" data-tour="region-pill" [attr.aria-label]="'System status: ' + s.summary">
        @for (r of s.regions; track r.id) {
          <span [class]="'dot ' + r.status">
            <!-- Visually hidden: gives each dot a text label for screen readers -->
            <span class="sr-only">{{ r.name }}: {{ r.status }}</span>
          </span>
        }
        <!-- Narrow (<360 px): shorten to "Systems normal" when everything is up -->
        <span class="label-narrow" aria-hidden="true">
          {{ s.overall === 'up' ? 'Systems normal' : s.summary }}
        </span>
        <span class="label-full">
          {{ s.overall === 'up' ? 'All systems normal' : s.summary }}
        </span>
      </a>
    }
  `,
})
export class RegionPill {
  protected readonly regions = inject(Regions);

  constructor() {
    this.regions.watch();
  }
}
