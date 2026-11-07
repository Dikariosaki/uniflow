import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ClientErrorLogger {
  error(area: string, error: unknown) {
    const diagnostic: Record<string, unknown> = {
      area,
      screen: window.location.pathname,
      at: new Date().toISOString(),
    };
    if (error instanceof HttpErrorResponse) {
      diagnostic['kind'] = 'http';
      diagnostic['status'] = error.status;
      diagnostic['path'] = this.safePath(error.url);
      const body = error.error as { code?: unknown; traceId?: unknown } | null;
      if (typeof body?.code === 'string') diagnostic['code'] = body.code;
      const reference = body?.traceId ?? error.headers.get('X-Request-ID');
      if (typeof reference === 'string') diagnostic['reference'] = reference;
    } else if (error instanceof Error) {
      diagnostic['kind'] = error.name;
      const details = error as Error & { code?: unknown; status?: unknown };
      if (typeof details.code === 'string') diagnostic['code'] = details.code;
      if (typeof details.status === 'number') diagnostic['status'] = details.status;
      diagnostic['message'] = this.redact(details.message);
      if (details.stack) diagnostic['stack'] = this.redact(details.stack, 1200);
    } else {
      diagnostic['kind'] = 'unknown';
    }
    console.error('[UniFlow] Fallo de aplicación', diagnostic);
  }

  private safePath(url: string | null) {
    if (!url) return undefined;
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return undefined;
    }
  }

  private redact(message: string, maxLength = 240) {
    return message
      .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redactado]')
      .replace(/(access_token|refresh_token|token)=([^&#\s]+)/gi, '$1=[redactado]')
      .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[token redactado]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[correo]')
      .slice(0, maxLength);
  }
}

@Injectable()
export class ClientGlobalErrorHandler extends ErrorHandler {
  private readonly logger = inject(ClientErrorLogger);

  override handleError(error: unknown) {
    this.logger.error('error no controlado', error);
  }
}
