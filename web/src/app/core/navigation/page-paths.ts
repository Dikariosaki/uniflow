export const PAGE_PATHS: Record<string, string> = {
  menu: '/',
  cart: '/pedido',
  checkout: '/recogida',
  track: '/seguimiento',
  receipt: '/comprobante',
  'my-orders': '/mis-pedidos',
  login: '/personal/login',
  queue: '/personal',
  history: '/personal/history',
  inventory: '/personal/inventory',
  reports: '/personal/reports',
};
export function pageFromUrl(url: string) {
  const path = url.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  return Object.entries(PAGE_PATHS).find(([, value]) => value === path)?.[0] ?? 'menu';
}
