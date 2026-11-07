import { Injectable, inject, DestroyRef } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

import { FeatureStore } from '../../../core/state/feature-store';

import { Product, Order, Slot } from '../../../shared/models';
import { CatalogStore } from '../../catalog';
import { pageFromUrl } from '../../../core/navigation/page-paths';
import { CustomerOrderHistoryStore } from './customer-order-history.store';
type CartLine = { product: Product; quantity: number };

@Injectable({ providedIn: 'root' })
export class OrderingStore extends FeatureStore {
  selectedMode: 'ready' | 'scheduled' = 'ready';
  selectedSlot = '';
  cart: CartLine[] = [];
  order: Order | null = null;
  alias = '';
  phone = '';
  isRefreshing = false;
  isReserving = false;
  reservationExpiresAt: string | null = null;
  slotsFresh = false;
  slots: Slot[] = [];
  private readonly catalog = inject(CatalogStore);
  private readonly customerOrderHistory = inject(CustomerOrderHistoryStore);
  private reservationTimer?: number;
  private reservationSyncTimer?: number;
  private reservationSyncChain: Promise<void> = Promise.resolve();
  private reservationVersion = 0;
  private confirmedCart: CartLine[] = [];
  private confirmedReservationExpiry: string | null = null;
  private cartTokenValue = '';
  private cartCountValue = 0;
  private cartTotalValue = 0;
  page = 'cart';
  menuCartOpen = false;
  get catalogFresh() {
    return this.catalog.view().catalogFresh;
  }
  get products() {
    return this.catalog.view().products;
  }
  loadMenu() {
    return this.catalog.loadMenu();
  }
  constructor() {
    super();
    const subscription = this.connectivity.changes$.subscribe((online) => {
      if (!online) {
        this.catalog.invalidate();
        this.slotsFresh = false;
        this.notifyChange();
      } else if (['menu', 'cart', 'checkout'].includes(pageFromUrl(this.router.url)))
        void this.refreshOrderingData();
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      if (this.reservationTimer && typeof window !== 'undefined') window.clearTimeout(this.reservationTimer);
      if (this.reservationSyncTimer && typeof window !== 'undefined') window.clearTimeout(this.reservationSyncTimer);
    });
  }
  get cartCount() {
    return this.cartCountValue;
  }
  get cartTotal() {
    return this.cartTotalValue;
  }
  get cartHasUnavailable() {
    return this.cart.some((item) => !item.product.available);
  }
  quantityFor(productId: string) {
    return this.cart.find((item) => item.product.id === productId)?.quantity ?? 0;
  }
  get reservationExpired() {
    return !this.isReserving && this.cart.length > 0 && (!this.reservationExpiresAt || Date.parse(this.reservationExpiresAt) <= Date.now());
  }
  private setCart(cart: CartLine[]) {
    this.cart = cart;
    this.cartCountValue = cart.reduce((sum, item) => sum + item.quantity, 0);
    this.cartTotalValue = cart.reduce((sum, item) => sum + item.product.priceCop * item.quantity, 0);
  }
  private scheduleReservationExpiry() {
    if (typeof window === 'undefined') return;
    if (this.reservationTimer) window.clearTimeout(this.reservationTimer);
    if (!this.reservationExpiresAt) {
      this.reservationTimer = undefined;
      return;
    }
    const delay = Math.max(0, Date.parse(this.reservationExpiresAt) - Date.now());
    this.reservationTimer = window.setTimeout(() => this.notifyChange(), delay);
  }
  private async refreshOrderingData() {
    try {
      this.isRefreshing = true;
      try {
        await this.loadMenu();
        await this.loadSlots();
        this.setCart(this.cart.map((line) => ({
          ...line,
          product: this.products.find((p) => p.id === line.product.id) ?? {
            ...line.product,
            available: false,
          },
        })));
      } finally {
        this.isRefreshing = false;
      }
    } finally {
      this.notifyChange();
    }
  }
  async loadSlots() {
    try {
      this.slotsFresh = false;
      try {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
          new Date(),
        );
        this.slots = await this.api.get<Slot[]>('/pickup-slots', { date });
        this.slotsFresh = true;
      } catch (e) {
        this.message = this.errorText(e, 'No se pudieron consultar los horarios.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async submitOrder() {
    try {
      if (
        this.isBusy ||
        this.isRefreshing ||
        this.cartHasUnavailable ||
        this.reservationExpired ||
        this.isReserving ||
        !this.catalogFresh ||
        !this.slotsFresh
      )
        return;
      if (!this.isOnline) {
        this.message = 'Necesitas conexión a internet para confirmar el pedido.';
        return;
      }
      if (this.reservationExpired) {
        this.message = 'La reserva de tu carrito venció. Vuelve a reservar los productos para continuar.';
        return;
      }
      if (
        !this.cart.length ||
        !this.alias.trim() ||
        !this.phone.trim() ||
        (this.selectedMode === 'scheduled' && !this.selectedSlot)
      ) {
        this.message = 'Completa tu nombre, teléfono y modalidad de recogida.';
        return;
      }
      this.isBusy = true;
      this.message = '';
      const storageKey = 'uniflow-idempotency-key';
      const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      try {
        const result = await this.api.post<{
          orderId: string;
          code: string;
          status: string;
          totalCop: number;
          token: string;
          slot: string;
        }>(
          '/orders',
          {
            alias: this.alias,
            phone: this.phone,
            pickupMode: this.selectedMode,
            slotId: this.selectedMode === 'scheduled' ? this.selectedSlot : null,
            items: this.cart.map((x) => ({
              productId: x.product.id,
              quantity: x.quantity,
              expectedPriceCop: x.product.priceCop,
            })),
            cartToken: this.getCartToken(),
          },
          new HttpHeaders({ 'Idempotency-Key': key }),
        );
        sessionStorage.removeItem(storageKey);
        this.customerOrderHistory.saveConfirmation(
          result,
          this.alias.trim(),
          this.cart.map((line) => ({
            nameSnapshot: line.product.name,
            quantity: line.quantity,
            unitPriceCop: line.product.priceCop,
          })),
        );
        this.setCart([]);
        this.reservationExpiresAt = null;
        this.confirmedCart = [];
        this.confirmedReservationExpiry = null;
        this.scheduleReservationExpiry();
        this.clearCartToken();
        location.assign(`/seguimiento#${encodeURIComponent(result.token)}`);
      } catch (e) {
        await this.loadMenu();
        await this.loadSlots();
        this.setCart(this.cart.map((line) => ({
          ...line,
          product: this.products.find((p) => p.id === line.product.id) ?? {
            ...line.product,
            available: false,
          },
        })));
        const body = (e as { error?: { priceChanged?: boolean } }).error;
        this.message = body?.priceChanged
          ? 'El precio de uno o más productos cambió. Revisa el nuevo total y confirma nuevamente.'
          : this.errorText(e, 'No fue posible confirmar el pedido.');
      } finally {
        this.isBusy = false;
      }
    } finally {
      this.notifyChange();
    }
  }
  async add(product: Product) {
    const line = this.cart.find((item) => item.product.id === product.id);
    // A product already in this cart may appear unavailable after a catalog refresh
    // because its remaining stock is held by this cart's own reservation.
    if ((!product.available && !line) || !this.isOnline) return;
    if (line && line.quantity >= 20) return;
    const nextCart = line
      ? this.cart.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item)
      : [...this.cart, { product, quantity: 1 }];
    await this.replaceCartReservation(nextCart);
  }
  async changeQuantity(productId: string, delta: number) {
    if (!this.isOnline) return;
    const nextCart = this.cart
      .map((x) =>
        x.product.id === productId ? { ...x, quantity: Math.min(20, x.quantity + delta) } : x,
      )
      .filter((x) => x.quantity > 0);
    if (nextCart.length === this.cart.length && nextCart.every((line, index) => line.quantity === this.cart[index].quantity)) return;
    await this.replaceCartReservation(nextCart);
  }
  async renewCartReservation() {
    if (!this.cart.length || this.isReserving) return;
    await this.replaceCartReservation([...this.cart]);
  }
  private replaceCartReservation(nextCart: CartLine[]) {
    if (!this.isOnline) {
      this.message = 'Conéctate a internet para reservar el inventario de tu carrito.';
      return;
    }
    this.isReserving = true;
    this.message = '';
    const version = ++this.reservationVersion;
    this.setCart(nextCart);
    this.notifyChange();
    if (this.reservationSyncTimer && typeof window !== 'undefined') window.clearTimeout(this.reservationSyncTimer);
    const enqueue = () => {
      this.reservationSyncChain = this.reservationSyncChain.then(() => this.syncCartReservation(version));
    };
    if (typeof window === 'undefined') enqueue();
    else this.reservationSyncTimer = window.setTimeout(enqueue, 140);
  }

  private async syncCartReservation(version: number) {
    if (version !== this.reservationVersion) return;
    const requestedCart = this.cart.map((line) => ({ ...line }));
    try {
      const result = await this.api.post<{ expiresAt: string | null }>(
        '/orders/reservations',
        {
          cartToken: this.getCartToken(),
          items: requestedCart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        },
      );
      if (version !== this.reservationVersion) return;
      this.confirmedCart = requestedCart;
      this.confirmedReservationExpiry = result.expiresAt;
      this.reservationExpiresAt = result.expiresAt;
      this.scheduleReservationExpiry();
    } catch (error) {
      if (version === this.reservationVersion) {
        this.setCart(this.confirmedCart);
        this.reservationExpiresAt = this.confirmedReservationExpiry;
        this.scheduleReservationExpiry();
        this.message = this.errorText(error, 'No se pudo reservar el inventario.');
      }
    } finally {
      if (version === this.reservationVersion) this.isReserving = false;
      this.notifyChange();
    }
  }
  toggleMenuCart() {
    this.menuCartOpen = !this.menuCartOpen;
    this.notifyChange();
  }
  closeMenuCart() {
    this.menuCartOpen = false;
    this.notifyChange();
  }
  goToCart() {
    this.menuCartOpen = false;
    this.go('cart');
  }
  private getCartToken() {
    if (this.cartTokenValue) return this.cartTokenValue;
    const key = 'uniflow-cart-reservation-token-v1';
    try {
      const stored = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
      this.cartTokenValue = stored && /^[0-9a-f-]{36}$/i.test(stored) ? stored : crypto.randomUUID();
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, this.cartTokenValue);
    } catch {
      this.cartTokenValue = crypto.randomUUID();
    }
    return this.cartTokenValue;
  }
  private clearCartToken() {
    this.cartTokenValue = '';
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('uniflow-cart-reservation-token-v1');
    } catch {
      // A fresh in-memory token is enough if browser storage is disabled.
    }
  }
}
