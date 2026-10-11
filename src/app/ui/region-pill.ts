import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Regions } from '../core/regions';

/** A small note on every page: are both regions up? It links to the status page. Nothing is shown until the witness has answered. */
@Component({
  selector: 'app-region-pill',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { position: fixed; left: 12px; bottom: 12px; z-index: 5; }
    @media (max-width: 720px) { :host { bottom: calc(env(safe-area-inset-bottom) + 68px); } }
    a { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; font-size: 0.78rem;
        background: var(--card); color: var(--ink-soft); border: 1px solid var(--line); box-shadow: var(--shadow); text-decoration: none; }
    a:hover { color: var(--ink); }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--line); display: inline-block; }
    .up { background: var(--leaf); }
    .degraded { background: var(--marigold); }
    .down { background: var(--loss); }
  `,
  template: `
    @if (regions.status(); as s) {
      <a routerLink="/status" [attr.aria-label]="'System status: ' + s.summary">
        @for (r of s.regions; track r.id) {
          <span [class]="'dot ' + r.status" aria-hidden="true"></span>
        }
        <span>{{ s.overall === 'up' ? 'All systems normal' : s.summary }}</span>
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
