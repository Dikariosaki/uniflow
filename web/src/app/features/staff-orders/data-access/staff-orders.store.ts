import { Injectable, inject } from '@angular/core';

import type { HubConnection } from '@microsoft/signalr';
import { FeatureStore } from '../../../core/state/feature-store';
import { AuthService } from '../../../core/auth/auth.service';
import { runtimeConfig } from '../../../core/config/runtime-config';
import { Order } from '../../../shared/models';
import { FormDialogConfig } from '../../../shared/components/form-dialog.component';

@Injectable({ providedIn: 'root' })
export class StaffOrdersStore extends FeatureStore {
  orders: Order[] = [];
  historyPage = 1;
  historyDate = '';
  historyStatus = '';
  historyTotal = 0;
  deliveredToday = 0;
  selectedOrder: Order | null = null;
  formDialog: FormDialogConfig | null = null;
  dialogSaving = false;
  dialogError = '';
  private pendingOrderAction: { kind: 'cancel' | 'deliver'; order: Order } | null = null;
  private hub?: HubConnection;
  private poller?: number;
  private generation = 0;
  private readonly auth = inject(AuthService);
  page = 'queue';
  async startQueue() {
    this.stop();
    this.page = 'queue';
    const generation = this.generation;
    await this.loadOrders();
    if (generation === this.generation) void this.connectHub(generation);
  }
  startHistory() {
    this.stop();
    this.page = 'history';
    void this.loadOrders();
  }
  closeOrderDetails() {
    this.selectedOrder = null;
    this.notifyChange();
  }
  stop() {
    this.generation++;
    if (this.poller) window.clearInterval(this.poller);
    this.poller = undefined;
    void this.hub?.stop();
    this.hub = undefined;
    this.selectedOrder = null;
    this.formDialog = null;
    this.pendingOrderAction = null;
    this.notifyChange();
  }
  get activeOrders() {
    return this.orders.filter((o) => !['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(o.status));
  }
  get completedOrders() {
    return this.orders.filter((o) => ['ENTREGADO', 'CANCELADO', 'RECHAZADO'].includes(o.status));
  }
  async loadOrders() {
    const generation = this.generation;
    const page = this.page;
    try {
      try {
        if (page === 'history') {
          const result = await this.api.getPage<Order>('/staff/orders', {
            page: String(this.historyPage),
            pageSize: '25',
            ...(this.historyDate ? { date: this.historyDate } : {}),
            ...(this.historyStatus ? { status: this.historyStatus } : {}),
          });
          if (generation !== this.generation) return;
          this.orders = result.items;
          this.historyTotal = result.total;
        } else {
          const active: Order[] = [];
          let currentPage = 1;
          let total = 0;
          do {
            const result = await this.api.getPage<Order>('/staff/orders', {
              activeOnly: 'true',
              pageSize: '150',
              page: String(currentPage++),
            });
            if (generation !== this.generation) return;
            active.push(...result.items);
            total = result.total;
          } while (active.length < total);
          this.orders = active.sort(
            (a, b) =>
              new Date(a.slot ?? '').getTime() - new Date(b.slot ?? '').getTime() ||
              new Date(a.createdAt ?? '').getTime() - new Date(b.createdAt ?? '').getTime(),
          );
          const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
            new Date(),
          );
          const delivered = await this.api.getPage<Order>('/staff/orders', {
            date,
            status: 'ENTREGADO',
            pageSize: '1',
          });
          if (generation !== this.generation) return;
          this.deliveredToday = delivered.total;
        }
      } catch (e) {
        if (generation !== this.generation) return;
        this.message = this.errorText(e, 'No fue posible cargar los pedidos.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async openOrderDetails(order: Order) {
    const generation = this.generation;
    try {
      try {
        const detail = await this.api.get<Order>(`/staff/orders/${order.id}`);
        if (generation === this.generation) this.selectedOrder = detail;
      } catch (e) {
        if (generation !== this.generation) return;
        this.message = this.errorText(e, 'No se pudo cargar el detalle del pedido.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async advance(order: Order, status: string) {
    if (status === 'CANCELADO') {
      this.dialogError = '';
      this.pendingOrderAction = { kind: 'cancel', order };
      this.formDialog = {
        title: `Cancelar pedido #${this.orderNumber(order.id)}`,
        description: 'Registra el motivo para dejarlo en la bitácora del pedido.',
        confirmLabel: 'Cancelar pedido',
        fields: [
          { key: 'reason', label: 'Motivo', type: 'textarea', required: true, maxLength: 500 },
        ],
      };
      this.notifyChange();
      return;
    }
    await this.updateOrderStatus(order, status);
  }
  async deliver(order: Order) {
    this.dialogError = '';
    this.pendingOrderAction = { kind: 'deliver', order };
    this.formDialog = {
      title: `Verificar entrega · pedido #${this.orderNumber(order.id)}`,
      description: 'Ingresa el código de recogida que presenta el cliente.',
      confirmLabel: 'Confirmar entrega',
      fields: [
        {
          key: 'code',
          label: 'Código de recogida',
          type: 'text',
          placeholder: '000000',
          required: true,
          minLength: 6,
          maxLength: 6,
          pattern: '^\\d{6}$',
          patternMessage: 'El código debe tener exactamente 6 dígitos.',
        },
      ],
    };
    this.notifyChange();
  }
  closeDialog() {
    if (this.dialogSaving) return;
    this.formDialog = null;
    this.dialogError = '';
    this.pendingOrderAction = null;
    this.notifyChange();
  }
  async saveDialog(values: Record<string, string | number>) {
    const action = this.pendingOrderAction;
    if (!action || this.dialogSaving) return;
    this.dialogSaving = true;
    this.dialogError = '';
    this.notifyChange();
    try {
      if (action.kind === 'cancel') {
        await this.api.patch(`/staff/orders/${action.order.id}/status`, {
          status: 'CANCELADO',
          reason: String(values['reason'] ?? '').trim(),
        });
      } else {
        await this.api.post(`/staff/orders/${action.order.id}/deliver`, {
          code: String(values['code'] ?? '').trim(),
        });
      }
      this.formDialog = null;
      this.pendingOrderAction = null;
      await this.loadOrders();
    } catch (e) {
      this.dialogError = this.errorText(
        e,
        action.kind === 'deliver'
          ? 'El código no es válido o no se pudo entregar el pedido.'
          : 'No se pudo cancelar el pedido.',
      );
    } finally {
      this.dialogSaving = false;
      this.notifyChange();
    }
  }
  private async updateOrderStatus(order: Order, status: string) {
    try {
      await this.api.patch(`/staff/orders/${order.id}/status`, { status });
      await this.loadOrders();
    } catch (e) {
      this.message = this.errorText(e, 'No se pudo actualizar el pedido.');
    } finally {
      this.notifyChange();
    }
  }
  private async connectHub(generation: number) {
    try {
      const token = await this.auth.accessToken();
      if (!token || !runtimeConfig.apiBaseUrl || generation !== this.generation) return;
      const { HubConnectionBuilder, HttpTransportType, LogLevel } =
        await import('@microsoft/signalr');
      if (generation !== this.generation) return;
      const hubUrl = `${runtimeConfig.apiBaseUrl.replace(/\/api\/?$/, '')}/hubs/orders`;
      this.hub = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          transport: HttpTransportType.LongPolling,
          accessTokenFactory: () => this.auth.accessToken().then((x) => x ?? ''),
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();
      this.hub.on('orderChanged', () => {
        if (generation === this.generation) void this.loadOrders();
      });
      this.hub.start().catch((error) => this.logError('actualización de pedidos', error));
      this.poller = window.setInterval(() => {
        if (this.isOnline && generation === this.generation) void this.loadOrders();
      }, 30000);
    } catch (error) {
      this.logError('conexión de pedidos', error);
    } finally {
      this.notifyChange();
    }
  }
}
