import { parseStatus } from './regions';

const good = {
  overall: 'degraded',
  customers_served: true,
  summary: 'A region is down; its customers are being served by the other',
  regions: [
    { id: 'a', name: 'Region A', status: 'degraded', detail: 'served by Region B', last_seen_s: 12 },
    { id: 'b', name: 'Region B', status: 'up', detail: 'serving normally', last_seen_s: 3 },
  ],
  events: [
    { at: 1, text: 'Region B is serving the other region' },
    { at: 'x', text: 'bad' },
  ],
  updated: 100,
};

describe('parseStatus', () => {
  it('reads what the witness says', () => {
    const s = parseStatus(good)!;
    expect(s.overall).toBe('degraded');
    expect(s.customersServed).toBe(true);
    expect(s.regions.map((r) => r.status)).toEqual(['degraded', 'up']);
    expect(s.regions[0].lastSeenSeconds).toBe(12);
  });

  it('drops events that are not well formed', () => {
    expect(parseStatus(good)!.events.length).toBe(1);
  });

  it('refuses anything else, so the page shows nothing rather than something wrong', () => {
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus({})).toBeNull();
    expect(parseStatus({ ...good, overall: 'fine' })).toBeNull();
    expect(parseStatus({ ...good, regions: [{ id: 'a', name: 'A', status: 'great' }] })).toBeNull();
  });
});
