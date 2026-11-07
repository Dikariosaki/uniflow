import { Injectable, inject } from '@angular/core';

import type { HubConnection } from '@microsoft/signalr';
import { FeatureStore } from '../../../core/state/feature-store';

import { runtimeConfig } from '../../../core/config/runtime-config';
import { Order } from '../../../shared/models';
import { CustomerOrderHistoryStore } from '../../ordering/data-access/customer-order-history.store';

@Injectable({ providedIn: 'root' })
export class TrackingStore extends FeatureStore {
  private readonly customerOrders = inject(CustomerOrderHistoryStore);
  track: Order | null = null;
  trackingToken = '';
  private hub?: HubConnection;
  private poller?: number;
  private generation = 0;
  private refreshFailureLogged = false;
  async initialize(token: string) {
    this.stop();
    this.trackingToken = token;
    this.track = null;
    await this.loadTrack();
  }
  stop() {
    this.generation++;
    if (this.poller) window.clearInterval(this.poller);
    this.poller = undefined;
    void this.hub?.stop();
    this.hub = undefined;
  }
  async loadTrack() {
    const generation = this.generation;
    const token = this.trackingToken;
    try {
      try {
        const order = await this.api.post<Order>('/orders/track', { token });
        if (generation !== this.generation) return;
        this.track = order;
        this.customerOrders.rememberTrackedOrder(order, token);
        void this.connectTrackHub(generation);
      } catch (e) {
        if (generation !== this.generation) return;
        this.message = this.errorText(
          e,
          'No encontramos el pedido. Verifica el enlace de seguimiento.',
        );
      }
      if (generation !== this.generation) return;
      this.poller = window.setInterval(() => {
        if (this.isOnline && generation === this.generation) void this.refreshTrack();
      }, 12000);
    } finally {
      this.notifyChange();
    }
  }
  async refreshTrack() {
    const generation = this.generation;
    const token = this.trackingToken;
    try {
      try {
        const order = await this.api.post<Order>('/orders/track', { token });
        if (generation === this.generation) {
          this.track = order;
          this.customerOrders.rememberTrackedOrder(order, token);
          this.refreshFailureLogged = false;
        }
      } catch (error) {
        if (!this.refreshFailureLogged) this.logError('actualización del seguimiento', error);
        this.refreshFailureLogged = true;
      }
    } finally {
      this.notifyChange();
    }
  }
  private async connectTrackHub(generation: number) {
    try {
      if (!this.trackingToken || this.hub) return;
      const { HubConnectionBuilder, HttpTransportType, LogLevel } =
        await import('@microsoft/signalr');
      if (generation !== this.generation) return;
      const hubUrl = `${runtimeConfig.apiBaseUrl.replace(/\/api\/?$/, '')}/hubs/orders`;
      this.hub = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          transport: HttpTransportType.LongPolling,
          headers: { 'X-Tracking-Token': this.trackingToken },
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();
      this.hub.on('orderChanged', () => {
        if (generation === this.generation) void this.refreshTrack();
      });
      this.hub.start().catch((error) => this.logError('actualización del seguimiento', error));
    } catch (error) {
      this.logError('conexión del seguimiento', error);
    } finally {
      this.notifyChange();
    }
  }
}
