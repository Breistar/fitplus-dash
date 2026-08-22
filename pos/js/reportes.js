/* Reportes (administración): ventas por día, asesora, sucursal, pago y producto; metas mensuales. */
import { sb, S, $, $$, esc, dinero, dineroCorto, fecha, periodo, diaLocal, hoyISO, todo, CANAL_TXT, METODOS, DESTINOS, ESTADO_TXT, toast, nombrePerfil, descargarCSV } from './nucleo.js'

let cont, mes = periodo()
const VENDIDO = ['pagado', 'preparacion', 'enviado', 'entregado']

export async function render (c) {
  cont = c
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Reportes</h1><p>Lo vendido en el sistema, sin cortes manuales.</p></div>
    <div class="acciones-cab"><input type="month" id="rep-mes" value="${mes}"><button class="btn" id="rep-csv">Exportar tickets</button></div></div>
  <div id="rep-cuerpo"><p class="vacio">Cargando…</p></div>`
  $('#rep-mes').onchange = e => { mes = e.target.value; cargar() }
  await cargar()
}

let tickets = []
async function cargar () {
  const ini = new Date(mes + '-01T00:00:00'); const fin = new Date(ini); fin.setMonth(fin.getMonth() + 1)
  const [data, { data: metas }] = await Promise.all([
    todo(() => sb.from('pos_tickets').select('*, pos_ticket_items(nombre,cantidad,importe,producto_id), pos_clientes(nombre,tipo)').gte('creado', ini.toISOString()).lt('creado', fin.toISOString()).order('creado')),
    sb.from('pos_metas').select('*').eq('periodo', mes)
  ])
  tickets = data
  $('#rep-csv').onclick = () => descargarCSV(`tickets_${mes}.csv`, tickets.map(t => ({ folio: t.folio, fecha: t.creado, estado: ESTADO_TXT[t.estado], clienta: t.pos_clientes?.nombre, tipo: t.pos_clientes?.tipo, canal: CANAL_TXT[t.canal], asesora: nombrePerfil(t.asesora_id), sucursal: S.sucursales.find(s => s.id === t.sucursal_id)?.nombre, pago: t.metodo_pago, destino: t.destino, subtotal: t.subtotal, envio: t.envio, descuento: t.descuento, total: t.total })))
  const v = tickets.filter(t => VENDIDO.includes(t.estado))
  const porCobrar = tickets.filter(t => t.estado === 'capturado')
  const total = v.reduce((s, t) => s + Number(t.total), 0)
  const hoy = hoyISO()
  const vHoy = v.filter(t => diaLocal(t.creado) === hoy)
  const metaNeg = metas?.find(m => !m.asesora_id)?.meta
  const dias = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate()
  const porDia = Array.from({ length: dias }, (_, i) => v.filter(t => Number(diaLocal(t.creado).slice(8, 10)) === i + 1).reduce((s, t) => s + Number(t.total), 0))
  const maxDia = Math.max(...porDia, 1)
  const grupo = (fn) => { const m = {}; for (const t of v) { const k = fn(t); const g = (m[k] ||= { n: 0, m: 0 }); g.n++; g.m += Number(t.total) } return Object.entries(m).sort((a, b) => b[1].m - a[1].m) }
  const asesoras = S.perfiles.filter(p => p.rol === 'asesora')
  const prods = {}
  for (const t of v) for (const i of t.pos_ticket_items || []) { const g = (prods[i.nombre] ||= { c: 0, m: 0 }); g.c += Number(i.cantidad); g.m += Number(i.importe) }

  $('#rep-cuerpo').innerHTML = `
  <div class="cuadricula c4" style="margin-bottom:14px">
    <div class="metrica oscura"><div class="cap">Vendido en ${nombreMes(mes)}</div><div class="val num">${dinero(total)}</div><div class="sub">${v.length} tickets · promedio ${dineroCorto(v.length ? total / v.length : 0)}</div>
      ${metaNeg ? `<div class="progreso"><i style="width:${Math.min(100, total / metaNeg * 100)}%"></i></div><div class="sub">${Math.round(total / metaNeg * 100)}% de la meta ${dineroCorto(metaNeg)}</div>` : ''}</div>
    <div class="metrica"><div class="cap">Hoy</div><div class="val num">${dinero(vHoy.reduce((s, t) => s + Number(t.total), 0))}</div><div class="sub">${vHoy.length} tickets</div></div>
    <div class="metrica"><div class="cap">Por cobrar</div><div class="val num">${dinero(porCobrar.reduce((s, t) => s + Number(t.total), 0))}</div><div class="sub">${porCobrar.length} tickets guardados sin pago</div></div>
    <div class="metrica"><div class="cap">Mayoreo vs menudeo</div><div class="val num" style="font-size:16px">${dineroCorto(v.filter(t => t.pos_clientes?.tipo === 'mayorista').reduce((s, t) => s + Number(t.total), 0))} · ${dineroCorto(v.filter(t => t.pos_clientes?.tipo !== 'mayorista').reduce((s, t) => s + Number(t.total), 0))}</div></div>
  </div>
  <div class="tarjeta"><h2>Ventas por día</h2><div class="barras">${porDia.map((m, i) => `<div style="height:${m / maxDia * 100}%" class="${mes + '-' + String(i + 1).padStart(2, '0') === hoy ? 'hoy' : ''}" title="${i + 1}: ${dinero(m)}">${(i + 1) % 5 === 0 || i === 0 ? `<span>${i + 1}</span>` : ''}</div>`).join('')}</div><div style="height:18px"></div></div>
  <div class="cuadricula c2" style="margin-top:14px">
    <div class="tarjeta"><h2>Por asesora · metas de ${nombreMes(mes)}</h2>
      <div class="tabla-env"><table><thead><tr><th>Asesora</th><th class="der">Tickets</th><th class="der">Vendido</th><th class="der">Meta</th><th>Avance</th></tr></thead><tbody>
      ${asesoras.map(a => { const g = v.filter(t => t.asesora_id === a.id); const m = g.reduce((s, t) => s + Number(t.total), 0); const meta = metas?.find(x => x.asesora_id === a.id)?.meta
        return `<tr><td><b>${esc(a.nombre)}</b></td><td class="der num">${g.length}</td><td class="der num">${dinero(m)}</td>
          <td class="der"><input type="number" class="num" data-meta="${a.id}" value="${meta ?? ''}" placeholder="—" style="width:110px;padding:5px 8px;text-align:right"></td>
          <td>${meta ? `<div class="progreso" style="margin:0"><i style="width:${Math.min(100, m / meta * 100)}%"></i></div><span class="chico suave">${Math.round(m / meta * 100)}%</span>` : '<span class="suave chico">sin meta</span>'}</td></tr>` }).join('')}
      <tr><td><b>Negocio</b></td><td class="der num">${v.length}</td><td class="der num">${dinero(total)}</td><td class="der"><input type="number" class="num" data-meta="" value="${metaNeg ?? ''}" placeholder="—" style="width:110px;padding:5px 8px;text-align:right"></td><td></td></tr>
      </tbody></table></div><p class="chico suave" style="margin-top:6px">Edita la meta y sal del campo para guardarla.</p></div>
    <div class="tarjeta"><h2>Productos más vendidos</h2>
      <div class="tabla-env"><table><thead><tr><th>Producto</th><th class="der">Pzas</th><th class="der">Importe</th></tr></thead><tbody>
      ${Object.entries(prods).sort((a, b) => b[1].m - a[1].m).slice(0, 15).map(([n, g]) => `<tr><td>${esc(n)}</td><td class="der num">${g.c}</td><td class="der num">${dinero(g.m)}</td></tr>`).join('') || '<tr><td colspan="3" class="vacio">Sin ventas en el mes.</td></tr>'}
      </tbody></table></div></div>
    <div class="tarjeta"><h2>Por canal</h2>${tabla(grupo(t => CANAL_TXT[t.canal] || t.canal))}</div>
    <div class="tarjeta"><h2>Por sucursal</h2>${tabla(grupo(t => S.sucursales.find(s => s.id === t.sucursal_id)?.nombre || '—'))}</div>
    <div class="tarjeta"><h2>Por forma de pago</h2>${tabla(grupo(t => METODOS[t.metodo_pago] || t.metodo_pago || '—'))}</div>
    <div class="tarjeta"><h2>Por tipo de entrega</h2>${tabla(grupo(t => DESTINOS[t.destino] || t.destino))}</div>
    <div class="tarjeta"><h2>Clientas del mes</h2>${tabla(grupo(t => t.pos_clientes?.nombre || '—').slice(0, 12))}</div>
  </div>`
  $$('[data-meta]', cont).forEach(inp => inp.onchange = async () => {
    const meta = Number(inp.value); const asesora_id = inp.dataset.meta || null
    if (!meta) { await sb.from('pos_metas').delete().eq('periodo', mes).is('asesora_id', asesora_id); return toast('Meta eliminada') }
    const q = asesora_id ? sb.from('pos_metas').upsert({ asesora_id, periodo: mes, meta }, { onConflict: 'asesora_id,periodo' })
      : sb.from('pos_metas').delete().eq('periodo', mes).is('asesora_id', null).then(() => sb.from('pos_metas').insert({ asesora_id: null, periodo: mes, meta }))
    const { error } = await q
    if (error) return toast(error.message)
    toast('Meta guardada'); cargar()
  })
}
const tabla = filas => `<div class="tabla-env"><table><thead><tr><th></th><th class="der">Tickets</th><th class="der">Vendido</th></tr></thead><tbody>${filas.map(([k, g]) => `<tr><td>${esc(k)}</td><td class="der num">${g.n}</td><td class="der num">${dinero(g.m)}</td></tr>`).join('') || '<tr><td colspan="3" class="vacio">—</td></tr>'}</tbody></table></div>`
const nombreMes = m => new Date(m + '-01T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
