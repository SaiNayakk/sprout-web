import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** What to show while something loads or if it failed: never a blank page, always a way to try again. */
@Component({
  selector: 'app-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <div class="card warn" role="alert">
        <p>{{ error() }}</p>
        <button class="btn secondary small" type="button" (click)="retry.emit()">Try again</button>
      </div>
    } @else if (loading()) {
      <p class="muted" role="status">Loading…</p>
    }
  `,
})
export class Status {
  readonly loading = input(false);
  readonly error = input('');
  readonly retry = output<void>();
}
