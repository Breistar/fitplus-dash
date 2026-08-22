/* CRM: base de clientas, segmentación por recompra, historial y ficha editable. */
import { sb, S, $, $$, esc, dinero, fecha, fechaHora, diasDesde, todo, statsClientas, segmento, tagTipo, tagEstado, toast, hoja, cabHoja, cerrarHoja, whatsapp, nombrePerfil, esAdmin, telBonito, telLimpio, descargarCSV } from './nucleo.js'

let cont, q = '', fAsesora = '', fSeg = '', fTipo = '', stats = {}, cache = []

export async function render (c, p = {}) {
  cont = c
  const asesoras = S.perfiles.filter(x => x.rol === 'asesora')
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Clientas</h1><p>La base se alimenta sola con cada venta. Aquí ves a quién le toca recompra.</p></div>
    <div class="acciones-cab"><button class="btn" id="cli-csv">Exportar</button><button class="btn btn-p" id="cli-nueva">Nueva clienta</button></div></div>
  <div class="cuadricula c4" id="cli-metricas" style="margin-bottom:14px"></div>
  <div class="tarjeta">
    <div class="fila">
      <input id="cli-q" type="search" placeholder="Nombre o teléfono" value="${esc(q)}">
      ${esAdmin() ? `<select id="cli-asesora"><option value="">Todas las asesoras</option>${asesoras.map(a => `<option value="${a.id}" ${fAsesora === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select>` : ''}
      <select id="cli-seg"><option value="">Todos los segmentos</option>
        ${['campeona', 'activa', 'recompra', 'riesgo', 'dormida', 'sin_registro'].map(s => `<option value="${s}" ${fSeg === s ? 'selected' : ''}>${segmento(s === 'sin_registro' ? null : { compras: s === 'campeona' ? 4 : 1, ultima: fechaPara(s) }).txt}</option>`).join('')}
      </select>
      <select id="cli-tipo"><option value="">Minoristas y mayoristas</option><option value="minorista" ${fTipo === 'minorista' ? 'selected' : ''}>Minoristas</option><option value="mayorista" ${fTipo === 'mayorista' ? 'selected' : ''}>Mayoristas</option></select>
    </div>
    <div class="tabla-env" style="margin-top:12px"><table><thead><tr><th>Clienta</th><th>Teléfono</th><th>Tipo</th><th>Asesora</th><th>Ubicación</th><th>Segmento</th><th class="der">Compras</th><th class="der">Total</th><th>Última</th></tr></thead><tbody id="cli-tbody"></tbody></table></div>
    <p class="chico suave" id="cli-pie" style="margin-top:8px"></p>
  </div>`
  $('#cli-q').oninput = e => { q = e.target.value; pintar() }
  $('#cli-asesora')?.addEventListener('change', e => { fAsesora = e.target.value; pintar() })
  $('#cli-seg').onchange = e => { fSeg = e.target.value; pintar() }
  $('#cli-tipo').onchange = e => { fTipo = e.target.value; pintar() }
  $('#cli-nueva').onclick = () => ficha(null)
  $('#cli-csv').onclick = () => descargarCSV('clientas.csv', filtradas().map(c => ({ nombre: c.nombre, telefono: c.telefono, tipo: c.tipo, asesora: c.asesora_nombre, estado: c.estado, ciudad: c.ciudad, estatus_lista: c.estatus_lista, segmento: segmento(stats[c.id]).txt, compras: stats[c.id]?.compras || 0, total: stats[c.id]?.total || 0, ultima: stats[c.id]?.ultima || '' })))
  await cargar()
  if (p.id) { const c = cache.find(x => x.id === Number(p.id)); if (c) ficha(c) }
}
function fechaPara (seg) {
  const d = new Date(); d.setDate(d.getDate() - ({ campeona: 10, activa: 10, recompra: 45, riesgo: 90, dormida: 200 }[seg] || 0)); return d.toISOString()
}

async function cargar () {
  const [data, st] = await Promise.all([todo(() => sb.from('pos_clientes').select('*').order('nombre')), statsClientas()])
  cache = data; stats = st
  pintar()
}
function filtradas () {
  const qq = q.trim().toLowerCase(); const dig = qq.replace(/\D/g, '')
  return cache.filter(c =>
    (!qq || c.nombre.toLowerCase().includes(qq) || (dig.length >= 4 && c.telefono.includes(dig))) &&
    (!fAsesora || c.asesora_id === fAsesora) && (!fTipo || c.tipo === fTipo) &&
    (!fSeg || segmento(stats[c.id]).clave === fSeg))
}
function pintar () {
  const lista = filtradas()
  const segs = {}
  for (const c of cache) { const s = segmento(stats[c.id]).clave; segs[s] = (segs[s] || 0) + 1 }
  const conCompra = cache.filter(c => stats[c.id]).length
  $('#cli-metricas').innerHTML = `
    <div class="metrica oscura"><div class="cap">Clientas en la base</div><div class="val num">${cache.length.toLocaleString('es-MX')}</div><div class="sub">${conCompra} con compra registrada en el sistema</div></div>
    <div class="metrica"><div class="cap">Toca recompra</div><div class="val num">${segs.recompra || 0}</div><div class="sub">31–60 días sin comprar</div></div>
    <div class="metrica"><div class="cap">En riesgo</div><div class="val num">${segs.riesgo || 0}</div><div class="sub">61–120 días</div></div>
    <div class="metrica"><div class="cap">Activas y campeonas</div><div class="val num">${(segs.activa || 0) + (segs.campeona || 0)}</div><div class="sub">compraron en los últimos 30 días</div></div>`
  const filas = lista.slice(0, 400)
  $('#cli-tbody').innerHTML = filas.map(c => {
    const s = stats[c.id]; const sg = segmento(s)
    return `<tr class="clic" data-id="${c.id}">
      <td><b>${esc(c.nombre)}</b>${c.estatus_lista ? `<div class="chico suave">${esc(c.estatus_lista)}</div>` : ''}</td>
      <td class="num">${telBonito(c.telefono)}</td><td>${tagTipo(c.tipo)}</td>
      <td>${esc(c.asesora_nombre || nombrePerfil(c.asesora_id))}</td><td>${esc(c.estado || c.ciudad || '—')}</td>
      <td><span class="tag ${sg.clave === 'recompra' ? 'lleno' : sg.clave === 'sin_registro' ? 'tenue' : sg.clave === 'campeona' || sg.clave === 'activa' ? 'medio' : ''}">${sg.txt}</span></td>
      <td class="der num">${s?.compras || 0}</td><td class="der num">${s ? dinero(s.total) : '—'}</td><td>${s ? fecha(s.ultima) : '—'}</td></tr>`
  }).join('') || '<tr><td colspan="9" class="vacio">Sin clientas con esos filtros.</td></tr>'
  $('#cli-pie').textContent = `${lista.length} clientas${lista.length > 400 ? ' · se muestran las primeras 400; afina la búsqueda' : ''}`
  $('#cli-tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) ficha(cache.find(c => c.id === Number(tr.dataset.id))) }
}

export async function ficha (c) {
  const nuevo = !c
  let tickets = []
  if (!nuevo) tickets = (await sb.from('pos_tickets').select('id,folio,estado,total,creado, pos_ticket_items(nombre,cantidad)').eq('cliente_id', c.id).order('creado', { ascending: false }).limit(30)).data || []
  const st = nuevo ? null : stats[c.id]; const sg = segmento(st)
  const asesoras = S.perfiles.filter(x => x.rol === 'asesora')
  const h = hoja(cabHoja(nuevo ? 'Nueva clienta' : esc(c.nombre), nuevo ? '' : `<span class="tag ${sg.clave === 'recompra' ? 'lleno' : ''}">${sg.txt}</span>`) + `
    ${nuevo ? '' : `<div class="cuadricula c3" style="margin-bottom:12px">
      <div class="metrica"><div class="cap">Compras</div><div class="val num">${st?.compras || 0}</div></div>
      <div class="metrica"><div class="cap">Total</div><div class="val num">${dinero(st?.total || 0)}</div></div>
      <div class="metrica"><div class="cap">Última compra</div><div class="val" style="font-size:16px">${st ? fecha(st.ultima) + ` <span class="suave chico">hace ${diasDesde(st.ultima)} d</span>` : '—'}</div></div>
    </div>
    <div class="acc" style="margin-bottom:14px">
      <a class="btn btn-p" href="#/venta?tel=${esc(c.telefono)}">Nueva venta</a>
      <button class="btn" id="f-wa">WhatsApp</button>
      <a class="btn" href="#/leads?nuevo=1&tel=${esc(c.telefono)}&nombre=${encodeURIComponent(c.nombre)}">Crear lead</a>
    </div>`}
    <div class="campos c2">
      <label>Nombre<input id="f-nombre" value="${esc(c?.nombre || '')}"></label>
      <label>Teléfono<input id="f-tel" inputmode="numeric" maxlength="10" value="${esc(c?.telefono || '')}"></label>
      <label>Tipo<select id="f-tipo"><option value="minorista" ${c?.tipo !== 'mayorista' ? 'selected' : ''}>Minorista</option><option value="mayorista" ${c?.tipo === 'mayorista' ? 'selected' : ''}>Mayorista</option></select></label>
      <label>Asesora<select id="f-asesora">${asesoras.map(a => `<option value="${a.id}" ${(c ? c.asesora_id : S.usuario.id) === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}${asesoras.some(a => a.id === S.usuario.id) ? '' : `<option value="${S.usuario.id}" ${!c || c.asesora_id === S.usuario.id ? 'selected' : ''}>${esc(S.perfil.nombre)}</option>`}</select></label>
      <label>Ciudad<input id="f-ciudad" value="${esc(c?.ciudad || '')}"></label>
      <label>Estado<input id="f-estado" value="${esc(c?.estado || '')}"></label>
      <label>Correo<input id="f-email" type="email" value="${esc(c?.email || '')}"></label>
      <label>Origen<input id="f-origen" value="${esc(c?.origen || '')}" placeholder="pauta, referida, sucursal…"></label>
    </div>
    <label>Notas<textarea id="f-notas">${esc(c?.notas || '')}</textarea></label>
    ${c?.estatus_lista ? `<p class="chico suave">Estatus en la lista de la asesora: ${esc(c.estatus_lista)}</p>` : ''}
    <div class="fila" style="margin-top:12px"><button class="btn btn-p" id="f-guardar">${nuevo ? 'Dar de alta' : 'Guardar cambios'}</button></div>
    <p id="f-error" class="error" hidden></p>
    ${nuevo ? '' : `<h3>Historial de compras</h3>
    <div class="lista">${tickets.map(t => `<div class="item"><div class="cab"><span><b>${esc(t.folio)}</b> <span class="suave chico">· ${fechaHora(t.creado)}</span></span>${tagEstado(t.estado)}</div>
      <div class="prods">${(t.pos_ticket_items || []).map(i => `${i.cantidad}× ${esc(i.nombre)}`).join(' · ')}</div><div class="meta"><b class="num">${dinero(t.total)}</b></div></div>`).join('') || '<p class="vacio">Sin compras registradas en el sistema todavía.</p>'}</div>`}`)
  $('#f-wa', h)?.addEventListener('click', () => whatsapp(c.telefono, `Hola ${c.nombre.split(' ')[0]}, te saluda ${S.perfil.nombre} de Fit Plus. `))
  $('#f-guardar', h).onclick = async () => {
    const tel = telLimpio($('#f-tel', h).value); const nombre = $('#f-nombre', h).value.trim()
    const err = $('#f-error', h); err.hidden = true
    if (!nombre || tel.length !== 10) { err.textContent = 'Nombre y teléfono de 10 dígitos son obligatorios.'; err.hidden = false; return }
    const fila = { nombre, telefono: tel, tipo: $('#f-tipo', h).value, asesora_id: $('#f-asesora', h).value,
      asesora_nombre: S.perfiles.find(p => p.id === $('#f-asesora', h).value)?.nombre || null,
      ciudad: $('#f-ciudad', h).value.trim() || null, estado: $('#f-estado', h).value.trim() || null,
      email: $('#f-email', h).value.trim() || null, origen: $('#f-origen', h).value.trim() || null,
      notas: $('#f-notas', h).value.trim() || null, actualizado: new Date().toISOString() }
    const r = nuevo ? await sb.from('pos_clientes').insert(fila) : await sb.from('pos_clientes').update(fila).eq('id', c.id)
    if (r.error) { err.textContent = r.error.code === '23505' ? 'Ese teléfono ya está registrado con otra clienta.' : r.error.message; err.hidden = false; return }
    toast(nuevo ? 'Clienta dada de alta' : 'Cambios guardados'); cerrarHoja(); cargar()
  }
}
