import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Header that names a cell: sent on requests, and answered with by the web server. */
export const CELL_HEADER = 'X-Sprout-Cell';

export interface Cell {
  id: string;
  weight: number;
}

let loaded: Promise<Cell[] | null> | null = null;

/**
 * The cells Sprout runs in, from /cells.json, read once. Null when the file is missing or unusable:
 * that is a single deployment and nothing here applies.
 */
export function loadCells(http: HttpClient): Promise<Cell[] | null> {
  loaded ??= firstValueFrom(http.get<{ cells?: Cell[] }>('/cells.json')).then(
    (body) => (Array.isArray(body?.cells) && body.cells.length > 0 ? body.cells : null),
    () => null,
  );
  return loaded;
}

/** Forgets the cached cells. For tests. */
export function forgetCells(): void {
  loaded = null;
}

/** FNV-1a, 32 bit: the same on every browser, unlike anything seeded or random. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The cell an email belongs to: a stable pick, weighted by each cell's capacity. */
export function cellFor(email: string, cells: Cell[]): string {
  const total = cells.reduce((sum, c) => sum + c.weight, 0);
  let n = fnv1a(email.trim().toLowerCase()) % total;
  for (const c of cells) {
    if (n < c.weight) {
      return c.id;
    }
    n -= c.weight;
  }
  return cells[cells.length - 1].id;
}
