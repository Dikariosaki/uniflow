import { inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../http/api.service';
import { ConnectivityService } from '../connectivity/connectivity.service';
import { UiState } from './ui-state.service';
import { PAGE_PATHS } from '../navigation/page-paths';
import { DisplayFormats } from '../../shared/presentation/display-formats';
import { HttpErrorResponse } from '@angular/common/http';
import { ClientErrorLogger } from '../logging/client-error-logger';

// A feature owns its fields and publishes completed async changes to its view.
// Components read view(), so Angular's zoneless rendering tracks that feature only.
export abstract class FeatureStore extends DisplayFormats {
  private readonly revision = signal(0);
  protected readonly api = inject(ApiService);
  protected readonly router = inject(Router);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly ui = inject(UiState);
  private readonly clientLogger = inject(ClientErrorLogger);
  isBusy = false;
  view(): this {
    this.revision();
    return this;
  }
  protected notifyChange() {
    this.revision.update((value) => value + 1);
  }
  get message() {
    return this.ui.message();
  }
  set message(value: string) {
    this.ui.message.set(value);
  }
  get isOnline() {
    return this.connectivity.online();
  }
  set isOnline(value: boolean) {
    this.connectivity.online.set(value);
  }
  go(page: string) {
    this.message = '';
    void this.router.navigateByUrl(PAGE_PATHS[page] ?? '/');
  }
  protected errorText(error: unknown, fallback: string) {
    this.clientLogger.error('interfaz', error);
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { detail?: unknown; traceId?: unknown } | null;
      const detail = typeof body?.detail === 'string' ? body.detail.trim() : '';
      if (error.status === 0) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
      if (error.status === 401) return 'Tu sesión venció. Inicia sesión de nuevo.';
      if (error.status === 403) return 'No tienes permiso para realizar esta acción.';
      if (error.status === 404) return 'No encontramos lo que buscas. Actualiza la página e inténtalo de nuevo.';
      if (error.status === 409 || error.status === 422 || error.status === 400) return detail || fallback;
      if (error.status === 429) return 'Hay muchas solicitudes en este momento. Espera un poco e inténtalo de nuevo.';
      if (error.status >= 500) {
        return typeof body?.traceId === 'string' && body.traceId
          ? `No pudimos completar esto ahora. Inténtalo de nuevo. Si continúa, comparte este código con el equipo: ${body.traceId}.`
          : 'No pudimos completar esto ahora. Inténtalo de nuevo más tarde.';
      }
      return fallback;
    }
    if (error instanceof Error) {
      const authError = error as Error & { code?: string };
      if (authError.code === 'over_email_send_rate_limit' || /email rate limit exceeded/i.test(error.message))
        return 'No podemos enviar más correos en este momento. Intenta de nuevo más tarde o contacta al administrador.';
      if (authError.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message))
        return 'El correo o la contraseña no son correctos.';
      if (authError.code === 'weak_password' || /password should be at least/i.test(error.message))
        return 'Elige una contraseña más segura, de al menos 8 caracteres.';
      if (/fetch failed|network request failed/i.test(error.message))
        return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
      return fallback;
    }
    return fallback;
  }
  protected logError(area: string, error: unknown) {
    this.clientLogger.error(area, error);
  }
}
