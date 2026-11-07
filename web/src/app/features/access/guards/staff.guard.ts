import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StaffSession } from '../data-access/staff-session.store';

export const staffGuard: CanActivateFn = async (route, state) => {
  const session = inject(StaffSession);
  const router = inject(Router);
  const fragment = location.hash.slice(1);
  if (/type=(invite|recovery)/.test(fragment))
    return router.createUrlTree(['/personal/login'], { fragment });
  if (!(await session.ensureSession()))
    return router.createUrlTree(['/personal/login'], { queryParams: { returnUrl: state.url } });
  if (
    state.url.split(/[?#]/, 1)[0] === '/personal' &&
    /(?:access_token=|type=magiclink)/.test(fragment) &&
    session.role === 'administrator'
  )
    return router.createUrlTree(['/personal/inventory']);
  if (route.data['administrator'] && session.role !== 'administrator')
    return router.createUrlTree(['/personal']);
  return true;
};
