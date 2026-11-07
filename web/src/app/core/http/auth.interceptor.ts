import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  return from(auth.accessToken()).pipe(
    switchMap((token) =>
      token
        ? next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
        : next(request),
    ),
  );
};
