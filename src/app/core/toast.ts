import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  bad: boolean;
}

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private next = 1;

  show(text: string, bad = false): void {
    const t = { id: this.next++, text, bad };
    this.items.update((l) => [...l, t]);
    setTimeout(() => this.items.update((l) => l.filter((x) => x.id !== t.id)), bad ? 6000 : 3500);
  }

  fail(text: string): void {
    this.show(text, true);
  }
}
