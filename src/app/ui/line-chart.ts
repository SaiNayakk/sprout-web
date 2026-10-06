import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { inr } from '../core/money';

/** A price line with the lowest and highest marked, for a screen reader as well as the eye. */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shape(); as s) {
      <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" [attr.aria-label]="s.label" class="chart">
        <polygon [attr.points]="s.area" [attr.fill]="s.up ? 'var(--gain)' : 'var(--loss)'" opacity=".12" />
        <polyline [attr.points]="s.line" fill="none" [attr.stroke]="s.up ? 'var(--gain)' : 'var(--loss)'" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      </svg>
      <div class="row between small muted"><span>Low <span class="num">{{ s.low }}</span></span><span>High <span class="num">{{ s.high }}</span></span></div>
    } @else {
      <p class="muted small">Not enough history to draw a chart yet.</p>
    }
  `,
  styles: '.chart { width: 100%; height: 180px; display: block; }',
})
export class LineChart {
  readonly points = input<number[]>([]);
  readonly unit = input('');

  protected readonly shape = computed(() => {
    const p = this.points();
    if (p.length < 2) {
      return null;
    }
    const lo = Math.min(...p);
    const hi = Math.max(...p);
    const span = hi - lo || 1;
    const xy = p.map((v, i) => `${((i / (p.length - 1)) * 600).toFixed(1)},${(170 - ((v - lo) / span) * 160).toFixed(1)}`);
    const up = p[p.length - 1] >= p[0];
    return {
      line: xy.join(' '),
      area: `0,180 ${xy.join(' ')} 600,180`,
      up,
      low: inr(lo),
      high: inr(hi),
      label: `Price ${this.unit()} went from ${inr(p[0])} to ${inr(p[p.length - 1])}, between ${inr(lo)} and ${inr(hi)}.`,
    };
  });
}
