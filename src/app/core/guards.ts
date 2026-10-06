import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api } from './api';
import { Auth } from './auth';

/** Only signed-in people get past; everyone else is sent to the front page. */
export const signedIn: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.signedIn() ? true : inject(Router).parseUrl('/');
};

/** The front page, sign-in and sign-up aren't for people already signed in. */
export const signedOut: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.signedIn() ? inject(Router).parseUrl('/home') : true;
};

/** Having a bank account and a Sprout account is what makes the rest of the app work: until then, onboarding. */
export const setUp: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    await inject(Api).get('/accounts/v1/accounts/me');
    return true;
  } catch (e) {
    if (e instanceof HttpErrorResponse && e.status === 404) {
      return router.parseUrl('/welcome');
    }
    return true;   // can't tell right now (an outage): let the page show its own error
  }
};
