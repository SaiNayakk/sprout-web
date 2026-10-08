import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { Auth, PUBLIC } from './auth';
import { CELL_HEADER } from './cells';

/** Adds the access token to Sprout calls, and on a 401 refreshes once and tries the call again. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }
  const auth = inject(Auth);
  // the customer's cell goes on every call, public ones too: a refresh must reach the cell that holds the session
  const cell = auth.cell();
  if (cell && !req.headers.has(CELL_HEADER)) {
    req = req.clone({ setHeaders: { [CELL_HEADER]: cell } });
  }
  if (req.context.get(PUBLIC)) {
    return next(req);
  }
  const used = auth.accessToken();
  const withToken = (r: HttpRequest<unknown>, token: string | null) =>
    token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;
  return next(withToken(req, used)).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && used !== null) {
        return from(auth.refreshAfter(used)).pipe(
          switchMap((fresh) => (fresh ? next(withToken(req, fresh)) : throwError(() => error))),
        );
      }
      return throwError(() => error);
    }),
  );
};
