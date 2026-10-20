import { parseStatus, relativeTime } from './regions';

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

describe('relativeTime', () => {
  const now = 1_000_000; // arbitrary fixed "now" in seconds

  it('returns "just now" for 4 s ago (below 5 s threshold)', () => {
    expect(relativeTime(now - 4, now)).toBe('just now');
  });

  it('returns "just now" at 0 s diff', () => {
    expect(relativeTime(now, now)).toBe('just now');
  });

  it('returns seconds at exactly 5 s (threshold boundary)', () => {
    expect(relativeTime(now - 5, now)).toBe('5 s ago');
  });

  it('returns seconds for 59 s ago', () => {
    expect(relativeTime(now - 59, now)).toBe('59 s ago');
  });

  it('returns "1 min ago" at exactly 60 s', () => {
    expect(relativeTime(now - 60, now)).toBe('1 min ago');
  });

  it('returns "59 min ago" at 59 minutes', () => {
    expect(relativeTime(now - 59 * 60, now)).toBe('59 min ago');
  });

  it('returns "1 h ago" at exactly 60 minutes', () => {
    expect(relativeTime(now - 60 * 60, now)).toBe('1 h ago');
  });

  it('returns "23 h ago" at 23 hours', () => {
    expect(relativeTime(now - 23 * 3600, now)).toBe('23 h ago');
  });

  it('returns "1 d ago" at exactly 24 hours', () => {
    expect(relativeTime(now - 24 * 3600, now)).toBe('1 d ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(relativeTime(now + 100, now)).toBe('just now');
  });
});
