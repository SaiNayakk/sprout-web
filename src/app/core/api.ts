import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Calls the gateway. Writes that move money or place orders carry an Idempotency-Key so a retry can't do it twice. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined) {
        p = p.set(k, String(v));
      }
    }
    return firstValueFrom(this.http.get<T>('/api' + path, { params: p }));
  }

  post<T>(path: string, body: unknown = {}, key?: string): Promise<T> {
    return firstValueFrom(this.http.post<T>('/api' + path, body, key ? { headers: { 'Idempotency-Key': key } } : {}));
  }

  put<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.put<T>('/api' + path, body));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>('/api' + path));
  }

  /** A fresh key for one attempt that may be retried: keep it for the retry, make a new one for a new attempt. */
  static key(): string {
    return crypto.randomUUID();
  }
}
