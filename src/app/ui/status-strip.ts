import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Regions } from '../core/regions';

/**
 * A thin bar at the top of the shell for demo users:
 * "Region A: phone ✓ · Region B: laptop ✓ · copies in sync"
 * Reuses the existing witness/regions status without duplicate fetching.
 */
@Component({
  selector: 'app-status-strip',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .strip {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-2);
      padding: var(--space-1) calc(var(--space-4) + env(safe-area-inset-right, 0px)) var(--space-1) calc(var(--space-4) + env(safe-area-inset-left, 0px));
      font-size: var(--text-xs);
      font-weight: 600;
      background: var(--leaf-soft);
      color: var(--leaf-text);
      border-bottom: 1px solid var(--line);
      text-decoration: none;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      transition: background var(--duration-fast) ease, color var(--duration-fast) ease;
      text-align: center;
    }
    .strip:active {
      opacity: 0.85;
    }
    @media (hover: hover) and (pointer: fine) {
      .strip:hover {
        background: color-mix(in srgb, var(--leaf-soft) 85%, var(--leaf));
      }
    }
    .dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--leaf);
      margin-right: var(--space-1);
      vertical-align: middle;
    }
    .dot.degraded {
      background: var(--marigold);
    }
    .dot.down {
      background: var(--loss);
    }
    .sep {
      opacity: 0.5;
      font-weight: 400;
    }
    @media (max-width: 360px) {
      .strip {
        font-size: 0.72rem;
        padding-inline: calc(var(--space-2) + env(safe-area-inset-left, 0px));
        gap: 2px var(--space-1);
      }
    }
  `,
  template: `
    <a
      routerLink="/status"
      class="strip"
      data-tour="status-strip"
      [attr.aria-label]="'System status: ' + text()"
    >
      <span><span [class]="'dot ' + statusA()"></span>{{ labelA() }}</span>
      <span class="sep" aria-hidden="true">·</span>
      <span><span [class]="'dot ' + statusB()"></span>{{ labelB() }}</span>
      <span class="sep" aria-hidden="true">·</span>
      <span>{{ syncText() }}</span>
    </a>
  `,
})
export class StatusStrip {
  private readonly regions = inject(Regions);

  constructor() {
    this.regions.watch();
  }

  private readonly system = computed(() => this.regions.status());

  protected readonly statusA = computed(() => {
    const reg = this.system()?.regions.find(
      (r) => r.id.toLowerCase() === 'a' || r.name.toLowerCase().includes('region a'),
    );
    return reg ? reg.status : 'up';
  });

  protected readonly statusB = computed(() => {
    const reg = this.system()?.regions.find(
      (r) => r.id.toLowerCase() === 'b' || r.name.toLowerCase().includes('region b'),
    );
    return reg ? reg.status : 'up';
  });

  protected readonly labelA = computed(() => {
    const s = this.statusA();
    const mark = s === 'down' ? '✗' : s === 'degraded' ? '⚠' : '✓';
    return `Region A: phone ${mark}`;
  });

  protected readonly labelB = computed(() => {
    const s = this.statusB();
    const mark = s === 'down' ? '✗' : s === 'degraded' ? '⚠' : '✓';
    return `Region B: laptop ${mark}`;
  });

  protected readonly syncText = computed(() => {
    const s = this.system();
    if (!s) return 'copies in sync';
    if (s.overall === 'down') return 'replication delayed';
    if (s.overall === 'degraded') return 'copies syncing';
    return 'copies in sync';
  });

  protected readonly text = computed(
    () => `${this.labelA()} · ${this.labelB()} · ${this.syncText()}`,
  );
}
