/* Inicio: panel según rol. Asesora: su día, su meta, sus recompras y leads. Admin: el negocio completo. Inventario: qué preparar y qué falta. */
import { sb, S, $, $$, esc, dinero, dineroCorto, fecha, fechaHora, diasDesde, periodo, hoyISO, hoy0, mesIni, todo, ESTADO_TXT, tagEstado, tagEtapa, statsClientas, segmento, nombrePerfil, esAdmin, esInv, whatsapp, telBonito } from './nucleo.js'

const VENDIDO = ['pagado', 'preparacion', 'enviado', 'entregado']

export async function render (c) {
  const rol = S.perfil.rol
  c.innerHTML = `<div class="cabecera"><div><h1>${saludo()}, ${esc(S.perfil.nombre.split(' ')[0])}</h1><p>${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
    <div class="acciones-cab"><a class="btn btn-p" href="#/venta">Nueva venta</a><a class="btn" href="#/leads?nuevo=1">Nuevo lead</a></div></div>
    <div id="ini-cuerpo"><p class="vacio">Cargando…</p></div>`
  if (rol === 'inventario') return panelInventario($('#ini-cuerpo'))
  return panelVentas($('#ini-cuerpo'), rol === 'admin')
}
const saludo = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches' }

async function panelVentas (c, admin) {
  const mes = periodo()
  const [{ data: tk }, { data: leads }, { data: metas }, st, clientas] = await Promise.all([
    sb.from('pos_tickets').select('*, pos_clientes(nombre,telefono), pos_ticket_items(nombre,cantidad)').gte('creado', mesIni().toISOString()).order('creado', { ascending: false }),
    sb.from('pos_leads').select('*').not('etapa', 'in', '("ganado","perdido")').order('siguiente_accion', { ascending: true, nullsFirst: false }).limit(200),
    sb.from('pos_metas').select('*').eq('periodo', mes),
    statsClientas(),
    todo(() => sb.from('pos_clientes').select('id,nombre,telefono,tipo,asesora_id,asesora_nombre').order('id'))
  ])
  const mios = t => admin || t.asesora_id === S.usuario.id
  const v = (tk || []).filter(t => VENDIDO.includes(t.estado) && mios(t))
  const hoy = hoy0().toISOString()
  const vHoy = v.filter(t => t.creado >= hoy)
  const totalMes = v.reduce((s, t) => s + Number(t.total), 0)
  const meta = metas?.find(m => admin ? !m.asesora_id : m.asesora_id === S.usuario.id)?.meta
  const porCobrar = (tk || []).filter(t => t.estado === 'capturado' && mios(t))
  const enProceso = (tk || []).filter(t => ['pagado', 'preparacion'].includes(t.estado) && mios(t))
  const misLeads = (leads || []).filter(l => admin || l.asesora_id === S.usuario.id)
  const hoyStr = hoyISO()
  const recompra = (clientas || []).filter(cl => (admin || cl.asesora_id === S.usuario.id) && ['recompra', 'riesgo'].includes(segmento(st[cl.id]).clave))
    .map(cl => ({ ...cl, st: st[cl.id] })).sort((a, b) => diasDesde(b.st.ultima) - diasDesde(a.st.ultima)).slice(0, 12)
  const diasMes = new Date().getDate(); const diasTot = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const ritmo = meta ? totalMes / diasMes * diasTot : null
  const asesoras = S.perfiles.filter(p => p.rol === 'asesora')

  c.innerHTML = `
  <div class="cuadricula c4">
    <div class="metrica oscura"><div class="cap">${admin ? 'Vendido este mes' : 'Mi venta del mes'}</div><div class="val num">${dinero(totalMes)}</div>
      ${meta ? `<div class="progreso"><i style="width:${Math.min(100, totalMes / meta * 100)}%"></i></div><div class="sub">${Math.round(totalMes / meta * 100)}% de ${dineroCorto(meta)} · al ritmo actual cierras en ${dineroCorto(ritmo)}</div>` : `<div class="sub">${v.length} tickets · sin meta definida</div>`}</div>
    <div class="metrica"><div class="cap">Hoy</div><div class="val num">${dinero(vHoy.reduce((s, t) => s + Number(t.total), 0))}</div><div class="sub">${vHoy.length} tickets</div></div>
    <div class="metrica"><div class="cap">Por cobrar</div><div class="val num">${porCobrar.length}</div><div class="sub">${dineroCorto(porCobrar.reduce((s, t) => s + Number(t.total), 0))} guardados sin pago</div></div>
    <div class="metrica"><div class="cap">Leads abiertos</div><div class="val num">${misLeads.length}</div><div class="sub">${misLeads.filter(l => l.siguiente_accion && l.siguiente_accion <= hoyStr).length} con acción para hoy o vencida</div></div>
  </div>
  ${admin ? `<div class="tarjeta" style="margin-top:14px"><h2>Asesoras este mes</h2><div class="tabla-env"><table><thead><tr><th>Asesora</th><th class="der">Tickets</th><th class="der">Vendido</th><th class="der">Hoy</th><th>Meta</th></tr></thead><tbody>
    ${asesoras.map(a => { const g = v.filter(t => t.asesora_id === a.id); const m = g.reduce((s, t) => s + Number(t.total), 0); const mt = metas?.find(x => x.asesora_id === a.id)?.meta; const h = g.filter(t => t.creado >= hoy).reduce((s, t) => s + Number(t.total), 0)
      return `<tr><td><b>${esc(a.nombre)}</b></td><td class="der num">${g.length}</td><td class="der num">${dinero(m)}</td><td class="der num">${dinero(h)}</td><td>${mt ? `<div class="progreso" style="margin:0"><i style="width:${Math.min(100, m / mt * 100)}%"></i></div><span class="chico suave">${Math.round(m / mt * 100)}% de ${dineroCorto(mt)}</span>` : '<span class="chico suave">sin meta</span>'}</td></tr>` }).join('')}
    </tbody></table></div></div>` : ''}
  <div class="cuadricula c2" style="margin-top:14px">
    <div class="tarjeta"><h2>Toca recompra</h2><p class="chico suave" style="margin-top:-6px;margin-bottom:10px">Clientas con 31 a 120 días desde su última compra. Un mensaje hoy vale más que un anuncio.</p>
      <div class="lista">${recompra.map(cl => `<div class="item" style="padding:9px 12px"><div class="cab"><span><b>${esc(cl.nombre)}</b><div class="chico suave">última compra hace ${diasDesde(cl.st.ultima)} días · ${cl.st.compras} compras · ${dineroCorto(cl.st.total)}${admin && cl.asesora_nombre ? ' · ' + esc(cl.asesora_nombre) : ''}</div></span>
        <div class="acc" style="margin:0"><button class="btn btn-chico" data-wa="${esc(cl.telefono)}" data-nombre="${esc(cl.nombre)}">WhatsApp</button><a class="btn btn-chico btn-fantasma" href="#/clientas?id=${cl.id}">Ficha</a></div></div></div>`).join('') || '<p class="vacio">Nadie pendiente de recompra por ahora. Conforme se registren ventas, esta lista se llena sola.</p>'}</div></div>
    <div class="tarjeta"><h2>Pedidos en proceso</h2>
      <div class="lista">${[...porCobrar, ...enProceso].slice(0, 10).map(t => `<div class="item" style="padding:9px 12px"><div class="cab"><span><b>${esc(t.folio)}</b> · ${esc(t.pos_clientes?.nombre || '')}<div class="chico suave">${fechaHora(t.creado)} · ${dineroCorto(t.total)} · ${(t.pos_ticket_items || []).map(i => i.cantidad + '× ' + i.nombre).join(', ').slice(0, 70)}</div></span>${tagEstado(t.estado)}</div></div>`).join('') || '<p class="vacio">Sin pedidos pendientes.</p>'}
      </div>${porCobrar.length + enProceso.length > 10 ? '<p class="chico suave" style="margin-top:8px"><a href="#/pedidos">Ver todos los pedidos</a></p>' : ''}</div>
    <div class="tarjeta"><h2>Leads para hoy</h2>
      <div class="lista">${misLeads.filter(l => !l.siguiente_accion || l.siguiente_accion <= hoyStr).slice(0, 8).map(l => `<div class="item" style="padding:9px 12px"><div class="cab"><span><b>${esc(l.nombre)}</b><div class="chico suave">${esc(l.interes || '')}${l.siguiente_accion ? ' · acción ' + fecha(l.siguiente_accion + 'T12:00:00') : ' · sin fecha'}</div></span><div class="acc" style="margin:0">${tagEtapa(l.etapa)}<a class="btn btn-chico btn-fantasma" href="#/leads?id=${l.id}">Abrir</a></div></div></div>`).join('') || '<p class="vacio">Sin leads pendientes para hoy.</p>'}</div></div>
    <div class="tarjeta"><h2>Últimas ventas</h2>
      <div class="lista">${v.slice(0, 8).map(t => `<div class="item" style="padding:9px 12px"><div class="cab"><span><b>${esc(t.folio)}</b> · ${esc(t.pos_clientes?.nombre || '')}<div class="chico suave">${fechaHora(t.creado)}${admin ? ' · ' + esc(nombrePerfil(t.asesora_id)) : ''}</div></span><b class="num">${dinero(t.total)}</b></div></div>`).join('') || '<p class="vacio">Aún no hay ventas este mes.</p>'}</div></div>
  </div>`
  c.onclick = e => { const b = e.target.closest('[data-wa]'); if (b) whatsapp(b.dataset.wa, `Hola ${b.dataset.nombre.split(' ')[0]}, te saluda ${S.perfil.nombre} de Fit Plus. ¿Cómo te fue con tu último pedido? Ya te toca reabastecerte; si quieres te aparto el tuyo hoy.`) }
}

async function panelInventario (c) {
  const { data: tk } = await sb.from('pos_tickets').select('*, pos_clientes(nombre), pos_ticket_items(nombre,cantidad)').in('estado', ['pagado', 'preparacion']).order('creado')
  const bajo = S.productos.filter(p => p.activo && Number(p.stock) <= Number(p.stock_min)).sort((a, b) => Number(a.stock) - Number(b.stock))
  c.innerHTML = `
  <div class="cuadricula c3">
    <div class="metrica oscura"><div class="cap">Pedidos por preparar</div><div class="val num">${(tk || []).filter(t => t.estado === 'pagado').length}</div><div class="sub">pagados, aún no en preparación</div></div>
    <div class="metrica"><div class="cap">En preparación</div><div class="val num">${(tk || []).filter(t => t.estado === 'preparacion').length}</div></div>
    <div class="metrica"><div class="cap">Bajo mínimo o agotados</div><div class="val num">${bajo.length}</div></div>
  </div>
  <div class="cuadricula c2" style="margin-top:14px">
    <div class="tarjeta"><h2>Cola de preparación</h2><div class="lista">${(tk || []).map(t => `<div class="item" style="padding:9px 12px"><div class="cab"><span><b>${esc(t.folio)}</b> · ${esc(t.pos_clientes?.nombre || '')}<div class="chico suave">${(t.pos_ticket_items || []).map(i => i.cantidad + '× ' + i.nombre).join(' · ')}</div></span><div class="acc" style="margin:0">${tagEstado(t.estado)}<a class="btn btn-chico btn-fantasma" href="#/pedidos?id=${t.id}">Abrir</a></div></div></div>`).join('') || '<p class="vacio">Nada pendiente.</p>'}</div></div>
    <div class="tarjeta"><h2>Reabastecer</h2><div class="lista">${bajo.slice(0, 15).map(p => `<div class="item" style="padding:9px 12px"><div class="cab"><span><b>${esc(p.nombre)}</b><div class="chico suave">mínimo ${Number(p.stock_min)}</div></span><b class="num ${Number(p.stock) <= 0 ? 'stock-bajo' : ''}">${Number(p.stock)}</b></div></div>`).join('') || '<p class="vacio">Todo por encima del mínimo.</p>'}</div></div>
  </div>`
}
