import { signal } from '@angular/core';
import { messageOf } from './problem';

/** One thing a page shows: loads on creation, says when it is loading or failed, and reloads on demand. */
export class Loader<T> {
  readonly value = signal<T | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private readonly fetcher: () => Promise<T>, load = true) {
    if (load) {
      void this.reload();
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.value.set(await this.fetcher());
      this.error.set('');
    } catch (e) {
      this.error.set(messageOf(e));
    } finally {
      this.loading.set(false);
    }
  }
}
