export interface DeliveryWindowRequest {
  estimatedDeliveryWindowStart: string;
  estimatedDeliveryWindowEnd: string;
  reason: string;
}

/** datetime-local has no zone: always display and interpret the operation in Lima. */
export function limaDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function offsetDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error('Indique inicio y fin válidos en hora de Lima.');
  const local = value.length === 16 ? `${value}:00` : value;
  const offset = `${local}-05:00`;
  if (limaDateTime(offset) !== local) throw new Error('La fecha u hora de la ventana no es válida.');
  return offset;
}

export function buildDeliveryWindowRequest(start: string, end: string, reason: string, now = new Date()): DeliveryWindowRequest {
  if (reason.trim().length < 5) throw new Error('Describa el motivo del cambio con al menos cinco caracteres.');
  const estimatedDeliveryWindowStart = offsetDateTime(start);
  const estimatedDeliveryWindowEnd = offsetDateTime(end);
  if (Date.parse(estimatedDeliveryWindowEnd) <= Date.parse(estimatedDeliveryWindowStart)) throw new Error('El fin de la ventana debe ser posterior al inicio.');
  if (Date.parse(estimatedDeliveryWindowEnd) <= now.getTime()) throw new Error('El fin de la ventana debe estar en el futuro.');
  return { estimatedDeliveryWindowStart, estimatedDeliveryWindowEnd, reason: reason.trim() };
}

export function canEditDeliveryWindow(status: string, routeId: number | null, routeStatus?: string): boolean {
  return ['PENDING', 'ASSIGNED'].includes(status) && (routeId === null || routeStatus === 'PLANNED');
}
