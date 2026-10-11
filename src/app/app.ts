import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RegionPill } from './ui/region-pill';
import { ToastArea } from './ui/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastArea, RegionPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toasts /><app-region-pill />`,
})
export class App {}
