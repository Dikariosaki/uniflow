import { Routes } from '@angular/router';
import { staffGuard } from './features/access';
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/catalog/pages/menu-page.component').then((m) => m.MenuPage),
  },
  {
    path: 'pedido',
    loadComponent: () =>
      import('./features/ordering/pages/cart-page.component').then((m) => m.CartPage),
  },
  {
    path: 'recogida',
    loadComponent: () =>
      import('./features/ordering/pages/checkout-page.component').then((m) => m.CheckoutPage),
  },
  {
    path: 'comprobante',
    loadComponent: () =>
      import('./features/ordering/pages/receipt-page.component').then((m) => m.ReceiptPage),
  },
  {
    path: 'mis-pedidos',
    loadComponent: () =>
      import('./features/ordering/pages/customer-orders-page.component').then(
        (m) => m.CustomerOrdersPage,
      ),
  },
  {
    path: 'seguimiento',
    loadComponent: () =>
      import('./features/tracking/pages/tracking-page.component').then((m) => m.TrackingPage),
  },
  {
    path: 'personal/login',
    loadComponent: () =>
      import('./features/access/pages/login-page.component').then((m) => m.LoginPage),
  },
  {
    path: 'personal',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/staff-orders/pages/queue-page.component').then((m) => m.QueuePage),
  },
  {
    path: 'personal/history',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./features/staff-orders/pages/history-page.component').then((m) => m.HistoryPage),
  },
  {
    path: 'personal/inventory',
    canActivate: [staffGuard],
    data: { administrator: true },
    loadComponent: () =>
      import('./features/catalog-admin/pages/catalog-admin-page.component').then(
        (m) => m.CatalogAdminPage,
      ),
  },
  {
    path: 'personal/reports',
    canActivate: [staffGuard],
    data: { administrator: true },
    loadComponent: () =>
      import('./features/operations-admin/pages/operations-admin-page.component').then(
        (m) => m.OperationsAdminPage,
      ),
  },
  { path: '**', redirectTo: '' },
];
