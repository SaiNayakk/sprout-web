import { Routes } from '@angular/router';
import { setUp, signedIn, signedOut } from './core/guards';

/** Pages load on demand, so the first visit downloads only the front page. */
export const routes: Routes = [
  { path: '', canActivate: [signedOut], loadComponent: () => import('./pages/landing').then((m) => m.Landing), title: 'Sprout: grow the habit, not the hype' },
  { path: 'signin', canActivate: [signedOut], loadComponent: () => import('./pages/auth-form').then((m) => m.AuthForm), data: { mode: 'signin' }, title: 'Sign in · Sprout' },
  { path: 'signup', canActivate: [signedOut], loadComponent: () => import('./pages/auth-form').then((m) => m.AuthForm), data: { mode: 'signup' }, title: 'Create your account · Sprout' },
  {
    path: '',
    canActivate: [signedIn],
    loadComponent: () => import('./ui/shell').then((m) => m.Shell),
    children: [
      { path: 'welcome', loadComponent: () => import('./pages/welcome').then((m) => m.Welcome), title: 'Welcome · Sprout' },
      {
        path: '',
        canActivate: [setUp],
        children: [
          { path: 'home', loadComponent: () => import('./pages/home').then((m) => m.Home), title: 'Home · Sprout' },
          { path: 'markets', loadComponent: () => import('./pages/markets').then((m) => m.Markets), title: 'Markets · Sprout' },
          { path: 'markets/:symbol', loadComponent: () => import('./pages/stock').then((m) => m.Stock), title: 'Trade · Sprout' },
          { path: 'orders', loadComponent: () => import('./pages/orders').then((m) => m.Orders), title: 'Orders · Sprout' },
          { path: 'money', loadComponent: () => import('./pages/money').then((m) => m.Money), title: 'Money · Sprout' },
          { path: 'plans', loadComponent: () => import('./pages/plans').then((m) => m.Plans), title: 'Plans · Sprout' },
          { path: 'goals', loadComponent: () => import('./pages/goals').then((m) => m.Goals), title: 'Goals · Sprout' },
          { path: 'habits', loadComponent: () => import('./pages/habits').then((m) => m.HabitsPage), title: 'Habits · Sprout' },
          { path: 'rewards', loadComponent: () => import('./pages/rewards').then((m) => m.Rewards), title: 'Rewards · Sprout' },
          { path: 'statements', loadComponent: () => import('./pages/statements').then((m) => m.Statements), title: 'Statements · Sprout' },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
