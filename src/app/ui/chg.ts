import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { direction, signedInr } from '../core/money';

/** A gain or loss: the sign and the arrow always, the colour as well. */
@Component({
  selector: 'app-chg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="num" [class]="dir()">{{ text() }}</span>`,
})
export class Chg {
  readonly amount = input<string | number | null | undefined>(null);
  protected readonly dir = computed(() => direction(this.amount()));
  protected readonly text = computed(() => signedInr(this.amount()));
}
