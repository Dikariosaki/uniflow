import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/http/auth.interceptor';
import { ClientGlobalErrorHandler } from './core/logging/client-error-logger';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: ClientGlobalErrorHandler },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
