export class DisplayFormats {
  get todayLabel() {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'America/Bogota' })
      .format(new Date())
      .toLocaleUpperCase('es-CO');
  }
  money(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  time(value?: string) {
    return value
      ? new Intl.DateTimeFormat('es-CO', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Bogota',
        }).format(new Date(value))
      : 'Por asignar';
  }
  num(value: unknown) {
    return Number(value ?? 0);
  }
  orderNumber(id?: string) {
    return id ? id.replaceAll('-', '').slice(0, 12).toUpperCase() : '—';
  }
  dateLabel(value?: string) {
    return value
      ? new Intl.DateTimeFormat('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'America/Bogota',
        }).format(new Date(value))
      : '';
  }
  statusLabel(status: string) {
    return (
      (
        {
          CONFIRMADO: 'Confirmado',
          EN_PREPARACION: 'En preparación',
          LISTO: 'Listo para recoger',
          ENTREGADO: 'Entregado',
          CANCELADO: 'Cancelado',
          RECHAZADO: 'Rechazado',
        } as Record<string, string>
      )[status] ?? status
    );
  }
  statusClass(status: string) {
    return status.toLowerCase().replace('_', '-');
  }
}
