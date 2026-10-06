import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toasts } from '../core/toast';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-area" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="toast" [class.bad]="t.bad" role="status">{{ t.text }}</div>
      }
    </div>
  `,
})
export class ToastArea {
  protected readonly toasts = inject(Toasts);
}
