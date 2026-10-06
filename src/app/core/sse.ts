export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Splits a Server-Sent Events byte stream into events. Chunks arrive wherever the network cuts them, so
 * a half-finished event is kept until the rest arrives. Comment lines (": heartbeat") are dropped.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): SseEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n');
    const events: SseEvent[] = [];
    let end: number;
    while ((end = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':') || line === '') {
          continue;
        }
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') {
          event = value;
        } else if (field === 'data') {
          data.push(value);
        }
      }
      if (data.length > 0) {
        events.push({ event, data: data.join('\n') });
      }
    }
    return events;
  }
}
