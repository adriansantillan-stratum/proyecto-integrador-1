import type { RouteEfficiency } from '../services/analyticsTypes';
import { downloadBlob, operationDate } from '../utils/operation';
import { efficiencyCsv, gpsQualityMessages, routeGpsMetrics } from '../utils/analytics';
export function EfficiencyTable({ rows }: { rows: RouteEfficiency[] }) {
  return <section className="card"><div className="operation-toolbar"><h3>Eficiencia por ruta</h3><button disabled={!rows.length} onClick={() => downloadBlob(new Blob([efficiencyCsv(rows)], { type: 'text/csv;charset=utf-8' }), `eficiencia_rutas_${operationDate()}.csv`)}>Exportar CSV de rutas</button></div>
    <p>GPS: distancia Haversine entre muestras que pasaron los controles configurados; no acredita movimiento real ni sensor verificado. El plan se muestra por separado y no sustituye GPS no evaluable. Min/parada: tiempo total de operación dividido entre entregas + fallidos + devueltos; no mide tiempo de atención. Un valor ausente se conserva vacío en CSV.</p>
    <div className="table-scroll"><table className="operation-table"><thead><tr>{['Ruta', 'Pedidos', 'Km plan', 'Km GPS', 'Min operación', 'Km/entrega', 'Min/parada terminal', 'Fuente distancia GPS', 'Calidad GPS'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
      {rows.map(r => {
        const gps = routeGpsMetrics(r);
        return <tr key={r.routeId}><td>{r.label || `Ruta #${r.routeId}`}</td><td>{r.orderCount}</td>{[r.plannedDistanceKm, gps.actualGpsDistanceKm, r.operationMinutes, gps.kmPerDelivery, r.timePerStopMin].map((value, i) => <td key={i}>{value == null ? (i === 1 || i === 3 ? 'No evaluable' : 'No disponible') : value.toLocaleString('es-PE', { maximumFractionDigits: 2 })}</td>)}<td>{gps.distanceSource === 'GPS_HAVERSINE' ? 'GPS Haversine con controles' : 'No evaluable'}</td><td>{gpsQualityMessages(r).map(message => <p key={message}>{message}</p>)}</td></tr>;
      })}
    </tbody></table>{!rows.length && <p>Sin rutas para estos filtros.</p>}</div>
  </section>;
}
