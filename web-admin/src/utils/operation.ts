/** One business calendar for the dispatcher, reports and route planning. */
export function operationDate(date = new Date(), offsetDays = 0): string {
  const current = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Lima', year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  if (!offsetDays) return current;
  const target = new Date(`${current}T12:00:00-05:00`);
  target.setUTCDate(target.getUTCDate()+offsetDays);
  return new Intl.DateTimeFormat('en-CA', {timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(target);
}

export function decodePolyline(encoded: string): [number,number][] {
  let index=0,lat=0,lng=0;
  const points: [number,number][]=[];
  const read=()=>{
    let result=0,shift=0,byte=0;
    do {
      if(index>=encoded.length || shift>30) throw new Error('Geometría de ruta inválida');
      byte=encoded.charCodeAt(index++)-63;
      if(byte<0 || byte>63) throw new Error('Geometría de ruta inválida');
      result|=(byte&31)<<shift;shift+=5;
    }while(byte>=32);
    return result&1 ? ~(result>>1) : result>>1;
  };
  while(index<encoded.length){lat+=read();lng+=read();points.push([lat/1e5,lng/1e5]);}
  return points;
}

export function errorMessage(error: unknown): string {
  if(typeof error==='object' && error && 'response' in error) {
    const response=(error as {response?:{status?:number;data?:unknown}}).response;
    const data = response?.data;
    if (typeof data === 'string' && data.trim() && !data.includes('<html')) return data;
    if (typeof data === 'object' && data) {
      for (const field of ['message', 'detail', 'error'] as const) {
        const value = (data as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.trim()) return value;
      }
    }
    if (response?.status === 503) return 'Servicio no disponible (503). La configuración de la integración puede estar pendiente.';
    return response?.status ? `No se pudo completar la operación (HTTP ${response.status})` : error instanceof Error ? error.message : 'No se pudo completar la operación';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación';
}

export interface ReportFilters { driverId: string; startDate: string; endDate: string }
export function filterQuery(filters: ReportFilters): string {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('Rango de fechas inválido');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params.toString();
}

export function validRuc(value: string): boolean { return value === '' || /^\d{11}$/.test(value); }
export function isTerminal(status: string): boolean { return ['DELIVERED', 'FAILED', 'RETURNED'].includes(status); }
export function manualTransitions(status: string): string[] {
  switch (status) {
    case 'ASSIGNED': return ['PICKED_UP'];
    case 'PICKED_UP': return ['IN_TRANSIT', 'FAILED'];
    case 'IN_TRANSIT': return ['FAILED', 'RETURNED'];
    default: return [];
  }
}
export const failureReasons = ['Cliente ausente', 'Dirección incorrecta', 'Rechazo del destinatario', 'Acceso restringido', 'Mercadería dañada', 'Incidente en ruta', 'Otro motivo documentado'];
export function canAssign(status: string, accepted: boolean, routeStatus: string): boolean {
  return status === 'PENDING' && accepted && routeStatus === 'PLANNED';
}
export function businessConfirmed(data?: { customerAccepted: boolean; addressVerified: boolean; coverageVerified: boolean }): boolean {
  return !!data && data.customerAccepted && data.addressVerified && data.coverageVerified;
}

export function csvContent(rows: readonly (readonly unknown[])[]): string {
  return '\ufeff' + rows.map(row => row.map(value => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text) && typeof value !== 'number') text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
