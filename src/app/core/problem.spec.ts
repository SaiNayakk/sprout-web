import { HttpErrorResponse } from '@angular/common/http';
import { codeOf, messageOf } from './problem';

describe('problem', () => {
  it('shows the service’s own plain-English detail', () => {
    const e = new HttpErrorResponse({ status: 422, error: { title: 'Wrong UPI PIN', detail: 'That UPI PIN is wrong.', status: 422, code: 'INVALID_PIN' } });
    expect(messageOf(e)).toBe('That UPI PIN is wrong.');
    expect(codeOf(e)).toBe('INVALID_PIN');
  });

  it('falls back to the title when there is no detail', () => {
    const e = new HttpErrorResponse({ status: 409, error: { title: 'Too many open pots', status: 409, code: 'TOO_MANY_POTS' } });
    expect(messageOf(e)).toBe('Too many open pots');
  });

  it('is honest about the network, throttling and outages', () => {
    expect(messageOf(new HttpErrorResponse({ status: 0 }))).toContain("Can't reach Sprout");
    expect(messageOf(new HttpErrorResponse({ status: 429 }))).toContain('Too many tries');
    expect(messageOf(new HttpErrorResponse({ status: 502 }))).toContain('Nothing was changed');
    expect(messageOf(new Error('x'))).toBe('Something went wrong. Try again.');
    expect(codeOf(new Error('x'))).toBe('');
  });
});
