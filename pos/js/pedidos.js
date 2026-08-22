/* Pedidos: tablero por estado, detalle, guía de envío y avisos a la clienta. */
import { sb, S, $, $$, esc, dinero, fechaHora, tagCanal, CANAL_TXT, ESTADOS, ESTADO_TXT, SIGUIENTE, ACCION_TXT, METODOS, DESTINOS, tagEstado, toast, hoja, cabHoja, cerrarHoja, whatsapp, textoTicket, nombrePerfil, esInv, telBonito, descargarCSV } from './nucleo.js'

let cont, filtro = 'activos', q = ''

export async function render (c, p = {}) {
  cont = c
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Pedidos</h1><p>Cada pedido avanza: por cobrar → pagado → en preparación → enviado → entregado.</p></div>
    <div class="acciones-cab"><input id="ped-q" type="search" placeholder="Folio, clienta o guía" style="width:220px"><button class="btn" id="ped-csv">Exportar</button></div></div>
  <div class="chips" id="ped-filtros">
    ${[['activos', 'Activos'], ['capturado', 'Por cobrar'], ['pagado', 'Pagados'], ['preparacion', 'En preparación'], ['enviado', 'Enviados'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']]
      .map(([k, v]) => `<button class="chip ${filtro === k ? 'activo' : ''}" data-f="${k}">${v}</button>`).join('')}
  </div>
  <div id="ped-lista" class="lista" style="margin-top:10px"></div>`
  $('#ped-filtros').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; filtro = b.dataset.f; render(cont) }
  $('#ped-q').value = q
  $('#ped-q').oninput = e => { q = e.target.value; cargar() }
  $('#ped-csv').onclick = exportar
  await cargar()
  if (p.id) abrir(Number(p.id))
}

let cache = []
async function cargar () {
  let s = sb.from('pos_tickets').select('*, pos_clientes(nombre,telefono,tipo,ciudad,estado), pos_ticket_items(nombre,cantidad,importe,precio_unitario)')
    .order('creado', { ascending: false }).limit(300)
  if (filtro === 'activos') s = s.in('estado', ['capturado', 'pagado', 'preparacion', 'enviado'])
  else if (filtro !== 'todos') s = s.eq('estado', filtro)
  const { data, error } = await s
  if (error) { $('#ped-lista').innerHTML = `<p class="error">${esc(error.message)}</p>`; return }
  cache = data || []
  const qq = q.trim().toLowerCase()
  const lista = qq ? cache.filter(t => (t.folio || '').toLowerCase().includes(qq) || (t.pos_clientes?.nombre || '').toLowerCase().includes(qq) || (t.guia || '').toLowerCase().includes(qq)) : cache
  $('#ped-lista').innerHTML = lista.map(t => `
    <div class="item" data-id="${t.id}">
      <div class="cab"><span><span class="folio">${esc(t.folio)}</span> ${tagCanal(t.canal)} <span class="suave chico">· ${fechaHora(t.creado)}</span></span>${tagEstado(t.estado)}</div>
      <div class="meta">${esc(t.pos_clientes?.nombre || 'sin clienta')} · ${DESTINOS[t.destino] || ''}${t.guia ? ' · guía ' + esc(t.guia) : ''} ${t.asesora_id ? ' · ' + esc(nombrePerfil(t.asesora_id)) : ''}</div>
      <div class="prods">${(t.pos_ticket_items || []).map(i => `${i.cantidad}× ${esc(i.nombre)}`).join(' · ')}</div>
      <div class="cab" style="margin-top:8px"><b class="num">${dinero(t.total)}</b>
        <div class="acc" style="margin:0">
          ${SIGUIENTE[t.estado] ? `<button class="btn btn-chico" data-avanzar="${t.id}">${ACCION_TXT[t.estado]}</button>` : ''}
          <button class="btn btn-chico btn-fantasma" data-abrir="${t.id}">Detalle</button>
        </div></div>
    </div>`).join('') || '<p class="vacio">Sin pedidos en este filtro.</p>'
  $('#ped-lista').onclick = e => {
    const a = e.target.closest('[data-avanzar]'); if (a) return avanzar(Number(a.dataset.avanzar))
    const d = e.target.closest('[data-abrir]') || e.target.closest('.item'); if (d) abrir(Number(d.dataset.abrir || d.dataset.id))
  }
}

async function cambiarEstado (id, estado, extra = {}) {
  const { error } = await sb.from('pos_tickets').update({ estado, ...extra }).eq('id', id)
  if (error) { toast('No se pudo actualizar: ' + error.message); return false }
  toast(`Pedido → ${ESTADO_TXT[estado]}`)
  await cargar(); return true
}

async function avanzar (id) {
  const t = cache.find(x => x.id === id); if (!t) return
  const sig = SIGUIENTE[t.estado]; if (!sig) return
  if (sig === 'enviado' && t.destino !== 'sucursal') return pedirGuia(t)
  await cambiarEstado(id, sig)
}

function pedirGuia (t) {
  const paqs = (S.config.paqueterias || 'DHL,FedEx,Estafeta,Otro').split(',')
  const h = hoja(cabHoja('Marcar enviado · ' + esc(t.folio)) + `
    <p class="suave chico">Captura la guía para que la clienta reciba el aviso con su número de rastreo.</p>
    <div class="campos" style="margin-top:12px">
      <label>Paquetería<select id="g-paq">${paqs.map(p => `<option ${p === t.paqueteria ? 'selected' : ''}>${esc(p.trim())}</option>`).join('')}</select></label>
      <label>Número de guía<input id="g-guia" value="${esc(t.guia || '')}" placeholder="Ej. 7834 2210 9911"></label>
    </div>
    <div class="fila" style="margin-top:14px"><button class="btn btn-p" id="g-ok">Guardar y marcar enviado</button><button class="btn" id="g-sin">Sin guía por ahora</button></div>`)
  $('#g-ok', h).onclick = async () => {
    const guia = $('#g-guia', h).value.trim(); if (!guia) return toast('Escribe el número de guía')
    if (await cambiarEstado(t.id, 'enviado', { guia, paqueteria: $('#g-paq', h).value })) {
      cerrarHoja()
      if (t.pos_clientes?.telefono && confirm('¿Avisar a la clienta por WhatsApp con su guía?')) {
        whatsapp(t.pos_clientes.telefono, `Hola ${t.pos_clientes.nombre}, tu pedido *${t.folio}* de Fit Plus ya va en camino por ${$('#g-paq', h).value}.\nGuía: *${guia}*\n¡Gracias por tu compra!`)
      }
    }
  }
  $('#g-sin', h).onclick = async () => { if (await cambiarEstado(t.id, 'enviado')) cerrarHoja() }
}

async function abrir (id) {
  const t = cache.find(x => x.id === id) || (await sb.from('pos_tickets').select('*, pos_clientes(nombre,telefono,tipo,ciudad,estado), pos_ticket_items(nombre,cantidad,importe,precio_unitario)').eq('id', id).single()).data
  if (!t) return
  const { data: ev } = await sb.from('pos_ticket_eventos').select('*').eq('ticket_id', id).order('creado')
  const cli = t.pos_clientes
  const h = hoja(cabHoja(esc(t.folio), tagEstado(t.estado)) + `
    <div class="kv">
      <span>Clienta</span><span><b>${esc(cli?.nombre || '—')}</b> · ${telBonito(cli?.telefono)}</span>
      <span>Fecha</span><span>${fechaHora(t.creado)}</span>
      <span>Canal</span><span>${CANAL_TXT[t.canal] || t.canal}${t.asesora_id ? ' · ' + esc(nombrePerfil(t.asesora_id)) : ''}</span>
      <span>Pago</span><span>${METODOS[t.metodo_pago] || t.metodo_pago || '—'}${t.pagado_en ? ' · ' + fechaHora(t.pagado_en) : ''}</span>
      <span>Entrega</span><span>${DESTINOS[t.destino] || '—'}${t.paqueteria ? ' · ' + esc(t.paqueteria) : ''}${t.guia ? ' · guía <b>' + esc(t.guia) + '</b>' : ''}</span>
      ${t.notas ? `<span>Nota</span><span>${esc(t.notas)}</span>` : ''}
    </div>
    <div class="sep"></div>
    ${(t.pos_ticket_items || []).map(i => `<div class="ticket-linea"><span>${i.cantidad} × ${esc(i.nombre)} <span class="suave chico">@ ${dinero(i.precio_unitario)}</span></span><b class="num">${dinero(i.importe)}</b></div>`).join('')}
    ${Number(t.envio) ? `<div class="ticket-linea"><span>Envío</span><b class="num">${dinero(t.envio)}</b></div>` : ''}
    ${Number(t.descuento) ? `<div class="ticket-linea"><span>Descuento</span><b class="num">− ${dinero(t.descuento)}</b></div>` : ''}
    <div class="ticket-total"><span>Total</span><span class="num">${dinero(t.total)}</span></div>
    <div class="acc" style="margin-top:14px">
      ${SIGUIENTE[t.estado] ? `<button class="btn btn-p" id="d-avanzar">${ACCION_TXT[t.estado]}</button>` : ''}
      ${t.estado === 'enviado' || (t.estado !== 'cancelado' && t.destino !== 'sucursal') ? '<button class="btn" id="d-guia">Guía</button>' : ''}
      <button class="btn" id="d-wa">WhatsApp</button>
      ${t.estado !== 'cancelado' && t.estado !== 'entregado' ? '<button class="btn btn-peligro" id="d-cancelar">Cancelar pedido</button>' : ''}
    </div>
    <h3>Bitácora</h3>
    <div class="bitacora">${(ev || []).map(e => `<div><b>${ESTADO_TXT[e.estado] || e.estado}</b> · ${fechaHora(e.creado)} · ${esc(nombrePerfil(e.usuario_id))}</div>`).join('') || '<div>Sin movimientos</div>'}</div>`)
  $('#d-avanzar', h)?.addEventListener('click', async () => { cerrarHoja(); await avanzar(t.id) })
  $('#d-guia', h)?.addEventListener('click', () => pedirGuia(t))
  $('#d-wa', h).onclick = () => whatsapp(cli?.telefono, textoTicket(t, t.pos_ticket_items, cli) + (t.guia ? `\nGuía ${t.paqueteria || ''}: ${t.guia}` : ''))
  $('#d-cancelar', h)?.addEventListener('click', async () => {
    if (!confirm(`¿Cancelar el pedido ${t.folio}? Si ya estaba cobrado, las existencias regresan al inventario.`)) return
    if (await cambiarEstado(t.id, 'cancelado')) cerrarHoja()
  })
}

function exportar () {
  descargarCSV('pedidos.csv', cache.map(t => ({
    folio: t.folio, fecha: t.creado, estado: ESTADO_TXT[t.estado], clienta: t.pos_clientes?.nombre, telefono: t.pos_clientes?.telefono,
    asesora: nombrePerfil(t.asesora_id), subtotal: t.subtotal, envio: t.envio, descuento: t.descuento, total: t.total,
    pago: t.metodo_pago, destino: t.destino, paqueteria: t.paqueteria, guia: t.guia,
    productos: (t.pos_ticket_items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(' | ')
  })))
}
