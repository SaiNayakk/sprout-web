import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A gold coin that sprouts: a green stem and two leaves, the right one rising like a growth arrow. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 48 48" role="img" aria-label="Sprout">
      <circle cx="22" cy="30" r="15" fill="var(--marigold)" />
      <circle cx="22" cy="30" r="10.5" fill="none" stroke="#c4801a" stroke-width="1.5" opacity=".55" />
      <path d="M22 16V8" stroke="var(--leaf)" stroke-width="3" stroke-linecap="round" fill="none" />
      <path d="M22 12C15 12 10.5 9 9.5 4.5 16.5 4.5 21 7.5 22 12Z" fill="var(--leaf)" />
      <path d="M22 10C27.5 10 32.5 6.5 36 .5 37 7 31 12.5 22 13.5Z" fill="var(--leaf)" />
    </svg>
  `,
  styles: ':host { display: inline-flex; }',
})
export class Logo {
  readonly size = input(34);
}
