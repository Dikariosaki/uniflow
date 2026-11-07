import { Injectable, inject } from '@angular/core';

import { FeatureStore } from '../../../core/state/feature-store';
import { AuthService } from '../../../core/auth/auth.service';
import { runtimeConfig } from '../../../core/config/runtime-config';
import { Slot } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class OperationsAdminStore extends FeatureStore {
  private loadVersion = 0;
  isLoading = false;
  private readonly auth = inject(AuthService);
  report: Record<string, number | string> | null = null;
  adminSlots: Slot[] = [];
  slotDraft = { startsAt: '', endsAt: '', capacity: 0 };
  settings = { name: 'Cafetería Bloque B', ordersPaused: false, minimumNoticeMinutes: 0 };
  weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  openingHours = this.weekdays.map((_, weekday) => ({
    weekday,
    opensAt: '',
    closesAt: '',
    closed: false,
  }));
  exceptionDraft = { date: '', opensAt: '08:00', closesAt: '17:00', closed: false };
  exceptions: Array<{
    weekday: null;
    date: string;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }> = [];
  staffMembers: Array<{ userId: string; email: string | null; role: string; active: boolean }> = [];
  auditEvents: Array<{
    id: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: string;
    createdAt: string;
  }> = [];
  staffDraft = { email: '', role: 'operator' };

  async loadReport() {
    const version = ++this.loadVersion;
    this.isLoading = true;
    this.notifyChange();
    try {
      try {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
          new Date(),
        );
        const [report, members, schedule, slots, auditEvents] = await Promise.all([
          this.api.get<Record<string, number | string>>('/admin/reports/daily'),
          this.api.get<Array<{ userId: string; email: string | null; role: string; active: boolean }>>('/admin/staff'),
          this.api.get<{
            settings: { name: string; ordersPaused: boolean; minimumNoticeMinutes: number } | null;
            hours: Array<{
              weekday: number | null;
              date: string | null;
              opensAt: string;
              closesAt: string;
              closed: boolean;
            }>;
          }>('/admin/schedule'),
          this.api.get<Slot[]>('/admin/pickup-slots', { date }),
          this.api.get<
            Array<{
              id: string;
              actorId: string;
              action: string;
              entityType: string;
              entityId?: string;
              details?: string;
              createdAt: string;
            }>
          >('/admin/audit'),
        ]);
        if (version !== this.loadVersion) return;
        this.report = report;
        this.staffMembers = members;
        this.adminSlots = slots;
        this.auditEvents = auditEvents;
        if (schedule.settings) this.settings = { ...this.settings, ...schedule.settings };
        this.openingHours = this.weekdays.map((_, weekday) => {
          const hour = schedule.hours.find((x) => x.weekday === weekday && x.date === null);
          return hour
            ? {
                weekday,
                opensAt: hour.opensAt.slice(0, 5),
                closesAt: hour.closesAt.slice(0, 5),
                closed: hour.closed,
              }
            : { weekday, opensAt: '', closesAt: '', closed: false };
        });
        this.exceptions = schedule.hours
          .filter((x) => x.date !== null)
          .map((h) => ({
            weekday: null,
            date: h.date!,
            opensAt: h.opensAt.slice(0, 5),
            closesAt: h.closesAt.slice(0, 5),
            closed: h.closed,
          }));
      } catch (e) {
        if (version !== this.loadVersion) return;
        this.message = this.errorText(e, 'No se pudo consultar el reporte.');
      }
    } finally {
      if (version === this.loadVersion) this.isLoading = false;
      this.notifyChange();
    }
  }
  async downloadReport() {
    try {
      try {
        const response = await fetch(
          `${runtimeConfig.apiBaseUrl.replace(/\/$/, '')}/v1/admin/reports/orders.csv`,
          { headers: { Authorization: `Bearer ${(await this.auth.accessToken()) ?? ''}` } },
        );
        if (!response.ok) throw new Error('No se pudo exportar el CSV.');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'uniflow-orders.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo descargar el reporte.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async saveSettings() {
    try {
      try {
        await this.api.put('/admin/settings', this.settings);
        this.message = 'Configuración guardada.';
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo guardar la configuración.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async saveSchedule() {
    try {
      const hours = [
        ...this.openingHours
          .filter((h) => h.closed || (h.opensAt && h.closesAt))
          .map((h) => ({
            ...h,
            date: null as string | null,
            opensAt: h.opensAt || '00:00',
            closesAt: h.closesAt || '00:00',
          })),
        ...this.exceptions,
      ];
      try {
        await this.api.put('/admin/schedule', { hours });
        this.message = 'Horario semanal guardado.';
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo guardar el horario.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async addException() {
    try {
      if (!this.exceptionDraft.date) return;
      try {
        const exception = {
          weekday: null,
          date: this.exceptionDraft.date,
          opensAt: this.exceptionDraft.opensAt,
          closesAt: this.exceptionDraft.closesAt,
          closed: this.exceptionDraft.closed,
        };
        const hours = [
          ...this.openingHours
            .filter((h) => h.closed || (h.opensAt && h.closesAt))
            .map((h) => ({
              ...h,
              date: null as string | null,
              opensAt: h.opensAt || '00:00',
              closesAt: h.closesAt || '00:00',
            })),
          ...this.exceptions.filter((x) => x.date !== exception.date),
          exception,
        ];
        await this.api.put('/admin/schedule', { hours });
        this.exceptions = [...this.exceptions.filter((x) => x.date !== exception.date), exception];
        this.message = 'Excepción de horario guardada.';
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo guardar la excepción.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async createSlot() {
    try {
      // datetime-local fields represent cafeteria time, independent of the staff device timezone.
      const startsAt = new Date(`${this.slotDraft.startsAt}-05:00`).toISOString(),
        endsAt = new Date(`${this.slotDraft.endsAt}-05:00`).toISOString();
      try {
        await this.api.post('/admin/pickup-slots', {
          startsAt,
          endsAt,
          capacity: Number(this.slotDraft.capacity),
        });
        this.message = 'Franja creada.';
        await this.loadReport();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo crear la franja.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async saveSlot(slot: Slot) {
    try {
      try {
        await this.api.put(`/admin/pickup-slots/${slot.id}`, {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          capacity: Number(slot.capacity),
          active: slot.active ?? true,
        });
        this.message = 'Franja actualizada.';
        await this.loadReport();
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo actualizar la franja.');
        await this.loadReport();
      }
    } finally {
      this.notifyChange();
    }
  }
  async inviteStaff() {
    try {
      try {
        await this.api.post('/admin/staff/invitations', this.staffDraft);
        this.message = 'Invitación enviada al correo.';
        this.staffDraft = { email: '', role: 'operator' };
      } catch (e) {
        this.message = this.errorText(e, 'No se pudo invitar al usuario.');
      }
    } finally {
      this.notifyChange();
    }
  }
  async updateStaffRole(member: { userId: string; role: string; active: boolean }) {
    try {
      try {
        await this.api.put(`/admin/staff/${encodeURIComponent(member.userId)}/role`, {
          role: member.role,
          active: member.active,
        });
        this.message = 'Permisos actualizados.';
      } catch (e) {
        this.message = this.errorText(e, 'No se pudieron actualizar los permisos.');
        await this.loadReport();
      }
    } finally {
      this.notifyChange();
    }
  }

  auditActionLabel(action: string) {
    const labels: Record<string, string> = {
      'staff.invited': 'Invitación enviada',
      'staff_role.updated': 'Acceso del personal actualizado',
      'schedule.updated': 'Horario semanal actualizado',
      'business_settings.updated': 'Configuración actualizada',
      'pickup_slot.created': 'Horario de recogida creado',
      'pickup_slot.updated': 'Horario de recogida actualizado',
      'category.created': 'Categoría creada',
      'category.updated': 'Categoría actualizada',
      'product.created': 'Producto creado',
      'product.updated': 'Producto actualizado',
      'product.image_upload_issued': 'Foto del producto preparada',
      'product.image_updated': 'Foto del producto actualizada',
    };
    return labels[action] ?? 'Cambio registrado';
  }

  auditEntityLabel(entityType: string) {
    const labels: Record<string, string> = {
      staff_role: 'Personal',
      schedule: 'Horario',
      business_settings: 'Configuración',
      pickup_slot: 'Recogida',
      category: 'Categoría',
      product: 'Producto',
    };
    return labels[entityType] ?? 'Cafetería';
  }

  auditSummary(details?: string) {
    if (!details) return '';
    const fields = new Map<string, string>();
    for (const part of details.split(';')) {
      const separator = part.indexOf('=');
      fields.set(
        separator < 0 ? part.trim() : part.slice(0, separator).trim(),
        separator < 0 ? '' : part.slice(separator + 1).trim(),
      );
    }
    const roleName = (role: string) =>
      role === 'administrator' ? 'Administrador' : role === 'operator' ? 'Operador' : role;
    if (fields.has('role')) return `Rol asignado: ${roleName(fields.get('role')!)}`;
    if (fields.has('to')) return `Nuevo rol: ${roleName(fields.get('to')!)}`;
    if (fields.has('capacity')) return `Capacidad: ${fields.get('capacity')} pedidos`;
    if (fields.has('entries')) return 'Se guardaron los días y excepciones de atención.';
    if (fields.has('paused')) return fields.get('paused') === 'true' ? 'Pedidos pausados.' : 'Pedidos habilitados.';
    if (fields.has('notice_minutes')) return `Aviso mínimo: ${fields.get('notice_minutes')} minutos.`;
    if (fields.has('price_cop')) {
      const price = Number(fields.get('price_cop'));
      return Number.isFinite(price) ? `Precio actualizado: ${price.toLocaleString('es-CO')} COP.` : 'Producto actualizado.';
    }
    if (fields.has('active')) return fields.get('active') === 'true' ? 'Elemento activado.' : 'Elemento desactivado.';
    if (fields.size === 1 && fields.has(details.trim())) return `Nombre: ${details.trim()}`;
    return 'Se actualizaron los datos.';
  }
}
