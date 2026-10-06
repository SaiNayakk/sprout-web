import { SseParser } from './sse';

describe('SseParser', () => {
  it('reads whole events', () => {
    const p = new SseParser();
    expect(p.push('event: tick\ndata: {"a":1}\n\nevent: market\ndata: {"b":2}\n\n')).toEqual([
      { event: 'tick', data: '{"a":1}' },
      { event: 'market', data: '{"b":2}' },
    ]);
  });

  it('keeps a half-finished event until the rest arrives', () => {
    const p = new SseParser();
    expect(p.push('event: tick\ndata: {"pr')).toEqual([]);
    expect(p.push('ice":1}\n')).toEqual([]);
    expect(p.push('\n')).toEqual([{ event: 'tick', data: '{"price":1}' }]);
  });

  it('drops heartbeat comments and understands CRLF', () => {
    const p = new SseParser();
    expect(p.push(': heartbeat\n\n')).toEqual([]);
    expect(p.push('event: quote\r\ndata: x\r\n\r\n')).toEqual([{ event: 'quote', data: 'x' }]);
  });

  it('joins multi-line data and defaults the event name', () => {
    const p = new SseParser();
    expect(p.push('data: one\ndata: two\n\n')).toEqual([{ event: 'message', data: 'one\ntwo' }]);
  });
});
