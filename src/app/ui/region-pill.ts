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
    :host {
      position: fixed;
      left: calc(var(--space-3) + env(safe-area-inset-left, 0px));
      bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
      z-index: 25;
    }

    /* Lift clear of the signed-in tab bar (≈55 px) + gap.
       The tab bar disappears at 860 px (shell breakpoint). */
    @media (max-width: 859px) {
      :host {
        bottom: calc(55px + env(safe-area-inset-bottom, 0px) + var(--space-3));
      }
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: 6px var(--space-3);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      background: var(--card);
      color: var(--ink-soft);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      text-decoration: none;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      transition: color var(--duration-fast) ease, border-color var(--duration-fast) ease, transform var(--duration-fast) var(--ease-out);
    }
    a:active {
      transform: scale(0.97);
    }
    @media (hover: hover) and (pointer: fine) {
      a:hover {
        color: var(--ink);
        border-color: color-mix(in srgb, var(--ink-soft) 35%, var(--line));
      }
    }

    /* position: relative so the .sr-only child (position: absolute) stays contained */
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--line);
      display: inline-block;
      flex-shrink: 0;
      position: relative;
    }
    .dot.up       { background: var(--leaf); }
    .dot.degraded { background: var(--marigold); }
    .dot.down     { background: var(--loss); }

    /* On a phone the words would sit over the page's text, so only the dots float; the status page has the words.
       The tap target stays 44 px around the small chip. */
    @media (max-width: 639px) {
      .label { display: none; }
      a { padding: var(--space-2); position: relative; }
      a::before { content: ''; position: absolute; inset: -10px; }
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
        <span class="label">{{ s.overall === 'up' ? 'All systems normal' : s.summary }}</span>
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
