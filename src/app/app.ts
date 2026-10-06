import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastArea } from './ui/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastArea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toasts />`,
})
export class App {}
