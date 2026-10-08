import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';
import { Logo } from './logo';

interface Link {
  path: string;
  label: string;
  icon: string;
}

/** The signed-in frame: header and navigation (a tab bar on phones), around whichever page is showing. */
@Component({
  selector: 'app-shell',
  imports: [DatePipe, RouterOutlet, RouterLink, RouterLinkActive, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <a routerLink="/home" class="brand" aria-label="Sprout home"><app-logo [size]="30" /><span>Sprout</span></a>
      <nav class="desk" aria-label="Main">
        @for (l of links; track l.path) {
          <a [routerLink]="l.path" routerLinkActive="on">{{ l.label }}</a>
        }
      </nav>
      <div class="who">
        @if (auth.isDemo()) {
          <span class="chip plain" title="You are trying Sprout with a demo account">Demo</span>
        }
        <button class="btn quiet small" type="button" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-controls="more">
          {{ auth.name() || 'Menu' }} ▾
        </button>
      </div>
    </header>

    @if (menu()) {
      <div class="sheet card" id="more">
        @if (auth.isDemo()) {
          <p class="small muted">
            This is your own demo account
            @if (auth.demoEndsAt(); as ends) { , yours until {{ ends | date: 'shortTime' }}, when it is closed and cleared away }.
            Time runs fast in the demo market, so months of history build up in hours.
          </p>
        }
        <div class="more-links" (click)="menu.set(false)" (keydown.escape)="menu.set(false)" tabindex="-1">
          @for (l of all; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="on">{{ l.label }}</a>
          }
        </div>
        <button class="btn secondary small" type="button" (click)="signOut()">Sign out</button>
      </div>
    }

    <main><router-outlet /></main>

    <nav class="tabs" aria-label="Main">
      @for (l of tabs; track l.path) {
        <a [routerLink]="l.path" routerLinkActive="on"><span aria-hidden="true">{{ l.icon }}</span>{{ l.label }}</a>
      }
    </nav>
  `,
  styles: `
    .top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 1rem; padding: .55rem 16px;
      background: color-mix(in srgb, var(--chalk) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
    .brand { display: inline-flex; align-items: center; gap: .5rem; font: 700 1.25rem var(--display); color: var(--ink); text-decoration: none; }
    .desk { display: none; gap: .25rem; margin-left: .5rem; flex: 1; }
    .desk a, .more-links a { padding: .4rem .7rem; border-radius: 999px; color: var(--ink-soft); text-decoration: none; font-weight: 600; font-size: .95rem; }
    .desk a.on, .more-links a.on { background: var(--leaf-soft); color: var(--leaf-text); }
    .who { margin-left: auto; display: flex; gap: .5rem; align-items: center; }
    .sheet { position: fixed; right: 12px; top: 56px; z-index: 30; width: min(92vw, 380px); }
    .more-links { display: flex; flex-wrap: wrap; gap: .25rem; margin: .5rem 0 .9rem; }
    .tabs { position: fixed; inset: auto 0 0 0; z-index: 20; display: grid; grid-template-columns: repeat(5, 1fr);
      background: var(--card); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
    .tabs a { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: .5rem 0 .45rem; font-size: .72rem;
      font-weight: 600; color: var(--ink-soft); text-decoration: none; }
    .tabs a span { font-size: 1.25rem; line-height: 1; }
    .tabs a.on { color: var(--leaf-text); }
    @media (min-width: 860px) { .desk { display: flex; } .tabs { display: none; } .sheet { top: 60px; } }
  `,
})
export class Shell {
  protected readonly auth = inject(Auth);
  protected readonly menu = signal(false);

  protected readonly all: Link[] = [
    { path: '/home', label: 'Home', icon: '⌂' },
    { path: '/markets', label: 'Markets', icon: '↗' },
    { path: '/money', label: 'Money', icon: '₹' },
    { path: '/goals', label: 'Goals', icon: '◎' },
    { path: '/habits', label: 'Habits', icon: '🌱' },
    { path: '/plans', label: 'Plans', icon: '↻' },
    { path: '/orders', label: 'Orders', icon: '≡' },
    { path: '/rewards', label: 'Rewards', icon: '★' },
    { path: '/statements', label: 'Statements', icon: '▤' },
  ];
  protected readonly links = this.all;
  protected readonly tabs = this.all.slice(0, 5);

  protected signOut(): void {
    this.menu.set(false);
    void this.auth.signOut();
  }
}
