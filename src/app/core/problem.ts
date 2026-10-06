import { HttpErrorResponse } from '@angular/common/http';
import { Problem } from './types';

/** The RFC 9457 problem a Sprout service answered with, if that is what the error is. */
export function problemOf(error: unknown): Problem | null {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object' && 'code' in error.error) {
    return error.error as Problem;
  }
  return null;
}

/** What to tell a person: the service's own plain-English detail, or something honest about the network. */
export function messageOf(error: unknown): string {
  const problem = problemOf(error);
  if (problem) {
    return problem.detail ?? problem.title;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return "Can't reach Sprout right now. Check your connection and try again.";
    }
    if (error.status === 429) {
      return 'Too many tries in a short time. Wait a moment and try again.';
    }
    if (error.status >= 500) {
      return 'Something on our side is busy. Nothing was changed; try again shortly.';
    }
  }
  return 'Something went wrong. Try again.';
}

export function codeOf(error: unknown): string {
  return problemOf(error)?.code ?? '';
}
