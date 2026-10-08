import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { cellFor, forgetCells, loadCells } from './cells';

const cells = [
  { id: 'a', weight: 30 },
  { id: 'b', weight: 70 },
];

describe('cells', () => {
  beforeEach(() => {
    forgetCells();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('picks the same cell for the same email, whatever its case or spacing', () => {
    const first = cellFor('asha@example.com', cells);
    for (let i = 0; i < 5; i++) {
      expect(cellFor('  Asha@Example.COM ', cells)).toBe(first);
    }
  });

  it('is a fixed hash, so every browser agrees', () => {
    // FNV-1a 32 bit of "a" is 0xe40c292c = 3826002220; mod 100 = 20, inside cell a (0 to 29)
    expect(cellFor('a', cells)).toBe('a');
    expect(cellFor('a', [{ id: 'x', weight: 1 }])).toBe('x');
  });

  it('follows the weights, roughly, over many emails', () => {
    let a = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      if (cellFor(`customer${i}@example.com`, cells) === 'a') {
        a++;
      }
    }
    expect(a / n).toBeGreaterThan(0.25);
    expect(a / n).toBeLessThan(0.35);
  });

  it('reads /cells.json once and keeps the answer', async () => {
    const ctl = TestBed.inject(HttpTestingController);
    const http = TestBed.inject(HttpClient);
    const first = loadCells(http);
    const second = loadCells(http);
    ctl.expectOne('/cells.json').flush({ cells });
    expect(await first).toEqual(cells);
    expect(await second).toEqual(cells);
  });

  it('is a single deployment when /cells.json is missing', async () => {
    const ctl = TestBed.inject(HttpTestingController);
    const result = loadCells(TestBed.inject(HttpClient));
    ctl.expectOne('/cells.json').flush('not found', { status: 404, statusText: 'Not Found' });
    expect(await result).toBeNull();
  });

  it('is a single deployment when the file has no cells', async () => {
    const ctl = TestBed.inject(HttpTestingController);
    const result = loadCells(TestBed.inject(HttpClient));
    ctl.expectOne('/cells.json').flush({ cells: [] });
    expect(await result).toBeNull();
  });
});
