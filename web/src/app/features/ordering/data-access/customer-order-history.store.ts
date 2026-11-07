import { Injectable } from '@angular/core';
import { FeatureStore } from '../../../core/state/feature-store';
import { Order } from '../../../shared/models';

const STORAGE_KEY = 'uniflow-customer-orders-v1';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SavedCustomerOrder extends Order {
  token: string;
  customerAlias: string;
}

interface OrderConfirmation {
  orderId: string;
  code: string;
  status: string;
  totalCop: number;
  token: string;
  slot: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerOrderHistoryStore extends FeatureStore {
  orders: SavedCustomerOrder[] = this.readOrders();
  isLoading = false;

  constructor() {
    super();
    this.pruneExpired();
  }

  saveConfirmation(
    confirmation: OrderConfirmation,
    customerAlias: string,
    items: SavedCustomerOrder['items'],
  ) {
    if (!confirmation.token) return;
    const order: SavedCustomerOrder = {
      id: confirmation.orderId,
      pickupCode: confirmation.code,
      status: confirmation.status,
      totalCop: confirmation.totalCop,
      slot: confirmation.slot,
      createdAt: new Date().toISOString(),
      customerAlias,
      token: confirmation.token,
      items,
    };
    this.orders = [order, ...this.orders.filter((saved) => saved.id !== order.id)];
    this.persist();
    this.notifyChange();
  }

  rememberTrackedOrder(order: Order, token: string) {
    if (!token || !order.id || !order.createdAt) return;
    const previous = this.orders.find((saved) => saved.id === order.id);
    const saved: SavedCustomerOrder = {
      ...previous,
      ...order,
      token,
      customerAlias: previous?.customerAlias ?? 'Mi pedido',
      items: order.items,
    };
    this.orders = [saved, ...this.orders.filter((item) => item.id !== saved.id)];
    this.pruneExpired();
    this.notifyChange();
  }

  async refreshOrders() {
    this.pruneExpired();
    if (!this.isOnline || !this.orders.some((order) => this.isActive(order.status))) return;
    this.isLoading = true;
    this.notifyChange();
    try {
      this.orders = await Promise.all(
        this.orders.map(async (saved) => {
          if (!this.isActive(saved.status)) return saved;
          try {
            const latest = await this.api.post<Order>('/orders/track', { token: saved.token });
            return { ...saved, ...latest, token: saved.token, customerAlias: saved.customerAlias };
          } catch {
            // Keep the cached receipt available when offline or when the tracking link has expired.
            return saved;
          }
        }),
      );
      this.persist();
    } finally {
      this.isLoading = false;
      this.notifyChange();
    }
  }

  openTracking(order: SavedCustomerOrder) {
    void this.router.navigate(['/seguimiento'], { fragment: order.token });
  }

  removeOrder(order: SavedCustomerOrder) {
    this.orders = this.orders.filter((saved) => saved.id !== order.id);
    this.persist();
    this.notifyChange();
  }

  private isActive(status: string) {
    return ['CONFIRMADO', 'EN_PREPARACION', 'LISTO'].includes(status);
  }

  private pruneExpired() {
    const cutoff = Date.now() - RETENTION_MS;
    this.orders = this.orders.filter((order) => {
      const createdAt = Date.parse(order.createdAt ?? '');
      return Boolean(order.token) && Number.isFinite(createdAt) && createdAt >= cutoff;
    });
    this.persist();
  }

  private readOrders(): SavedCustomerOrder[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (order): order is SavedCustomerOrder =>
          typeof order === 'object' &&
          order !== null &&
          typeof order.token === 'string' &&
          typeof order.id === 'string' &&
          typeof order.createdAt === 'string' &&
          Array.isArray(order.items),
      );
    } catch {
      return [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orders));
    } catch {
      this.message = 'El navegador no permitió guardar el historial de pedidos en este dispositivo.';
    }
  }
}
