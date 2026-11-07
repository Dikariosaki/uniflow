import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { runtimeConfig } from '../config/runtime-config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = `${runtimeConfig.apiBaseUrl.replace(/\/$/, '')}/v1`;
  constructor(private http: HttpClient) {}
  get<T>(path: string, params?: Record<string, string>) {
    return firstValueFrom(
      this.http.get<T>(`${this.base}${path}`, {
        params: new HttpParams({ fromObject: params ?? {} }),
      }),
    );
  }
  async getPage<T>(path: string, params: Record<string, string>) {
    const response = await firstValueFrom(
      this.http.get<T[]>(`${this.base}${path}`, {
        params: new HttpParams({ fromObject: params }),
        observe: 'response',
      }),
    );
    return {
      items: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
    };
  }
  post<T>(path: string, body: unknown, headers?: HttpHeaders) {
    return firstValueFrom(this.http.post<T>(`${this.base}${path}`, body, { headers }));
  }
  put<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.put<T>(`${this.base}${path}`, body));
  }
  patch<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>(`${this.base}${path}`, body));
  }
}
