/* Leads: seguimiento comercial de campañas, redes y referidos hasta convertirse en venta. */
import { sb, S, $, $$, esc, dinero, fecha, fechaHora, diasDesde, hoyISO, ETAPAS, ETAPA_TXT, ORIGEN_TXT, tagEtapa, toast, hoja, cabHoja, cerrarHoja, whatsapp, nombrePerfil, esAdmin, telBonito, telLimpio } from './nucleo.js'

let cont, cache = [], fEtapa = 'abiertos', q = ''

export async function render (c, p = {}) {
  cont = c
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Leads</h1><p>Cada persona que pregunta por pauta, redes o referencia, hasta que compra.</p></div>
    <div class="acciones-cab"><input id="ld-q" type="search" placeholder="Nombre o teléfono" style="width:200px"><button class="btn btn-p" id="ld-nuevo">Nuevo lead</button></div></div>
  <div class="cuadricula c4" id="ld-metricas" style="margin-bottom:14px"></div>
  <div class="chips" id="ld-filtros">
    ${[['abiertos', 'Abiertos'], ['nuevo', 'Nuevos'], ['contactado', 'Contactados'], ['cotizado', 'Cotizados'], ['ganado', 'Ganados'], ['perdido', 'Perdidos'], ['todos', 'Todos']]
      .map(([k, v]) => `<button class="chip ${fEtapa === k ? 'activo' : ''}" data-f="${k}">${v}</button>`).join('')}
  </div>
  <div class="tabla-env" style="margin-top:10px"><table><thead><tr><th>Lead</th><th>Origen</th><th>Interés</th><th>Etapa</th><th>Asesora</th><th>Siguiente acción</th><th class="der">Estimado</th><th>Actualizado</th></tr></thead><tbody id="ld-tbody"></tbody></table></div>`
  $('#ld-filtros').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; fEtapa = b.dataset.f; pintar() }
  $('#ld-q').oninput = e => { q = e.target.value; pintar() }
  $('#ld-nuevo').onclick = () => ficha(null)
  await cargar()
  if (p.nuevo) ficha(null, { telefono: p.tel || '', nombre: p.nombre || '' })
  else if (p.id) { const l = cache.find(x => x.id === Number(p.id)); if (l) ficha(l) }
}

async function cargar () {
  const { data } = await sb.from('pos_leads').select('*').order('actualizado', { ascending: false }).limit(500)
  cache = data || []; pintar()
}
function pintar () {
  const qq = q.trim().toLowerCase()
  const lista = cache.filter(l => (fEtapa === 'todos' || (fEtapa === 'abiertos' ? !['ganado', 'perdido'].includes(l.etapa) : l.etapa === fEtapa)) &&
    (!qq || l.nombre.toLowerCase().includes(qq) || (l.telefono || '').includes(qq.replace(/\D/g, '') || '§')))
  const abiertos = cache.filter(l => !['ganado', 'perdido'].includes(l.etapa))
  const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0)
  const ganados = cache.filter(l => l.etapa === 'ganado' && new Date(l.actualizado) >= mes)
  const cerrados = cache.filter(l => ['ganado', 'perdido'].includes(l.etapa) && new Date(l.actualizado) >= mes)
  const vencidos = abiertos.filter(l => l.siguiente_accion && l.siguiente_accion < hoyISO())
  $('#ld-metricas').innerHTML = `
    <div class="metrica oscura"><div class="cap">Leads abiertos</div><div class="val num">${abiertos.length}</div><div class="sub">${vencidos.length} con acción vencida</div></div>
    <div class="metrica"><div class="cap">Ganados este mes</div><div class="val num">${ganados.length}</div><div class="sub">${dinero(ganados.reduce((s, l) => s + Number(l.monto_estimado || 0), 0))} estimados</div></div>
    <div class="metrica"><div class="cap">Tasa de cierre</div><div class="val num">${cerrados.length ? Math.round(ganados.length / cerrados.length * 100) : 0}%</div><div class="sub">de los leads cerrados este mes</div></div>
    <div class="metrica"><div class="cap">Por origen (abiertos)</div><div class="val" style="font-size:13px;font-weight:500;margin-top:6px">${Object.entries(abiertos.reduce((m, l) => (m[l.origen] = (m[l.origen] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${ORIGEN_TXT[k] || k} ${v}`).join(' · ') || '—'}</div></div>`
  $('#ld-tbody').innerHTML = lista.map(l => `<tr class="clic" data-id="${l.id}">
    <td><b>${esc(l.nombre)}</b><div class="chico suave num">${telBonito(l.telefono)}</div></td>
    <td>${ORIGEN_TXT[l.origen] || l.origen}${l.campana ? `<div class="chico suave">${esc(l.campana)}</div>` : ''}</td>
    <td>${esc(l.interes || '—')}</td><td>${tagEtapa(l.etapa)}</td><td>${esc(nombrePerfil(l.asesora_id))}</td>
    <td>${l.siguiente_accion ? `<span class="${l.siguiente_accion < hoyISO() && !['ganado', 'perdido'].includes(l.etapa) ? 'stock-bajo' : ''}">${fecha(l.siguiente_accion + 'T12:00:00')}</span>` : '—'}</td>
    <td class="der num">${l.monto_estimado ? dinero(l.monto_estimado) : '—'}</td><td class="chico suave">${fechaHora(l.actualizado)}</td></tr>`).join('') ||
    '<tr><td colspan="8" class="vacio">Sin leads en este filtro.</td></tr>'
  $('#ld-tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) ficha(cache.find(l => l.id === Number(tr.dataset.id))) }
}

function ficha (l, pre = {}) {
  const nuevo = !l
  const asesoras = S.perfiles.filter(x => x.rol === 'asesora')
  const h = hoja(cabHoja(nuevo ? 'Nuevo lead' : esc(l.nombre), nuevo ? '' : tagEtapa(l.etapa)) + `
    ${nuevo ? '' : `<div class="acc" style="margin-bottom:14px">
      <button class="btn" id="l-wa">WhatsApp</button>
      ${l.etapa !== 'ganado' ? '<button class="btn btn-p" id="l-ganar">Convertir en venta</button>' : `<a class="btn btn-p" href="#/venta?tel=${esc(l.telefono || '')}">Nueva venta</a>`}
    </div>
    <div class="pill-grupo" id="l-etapas" style="margin-bottom:14px">${ETAPAS.map(e => `<button data-e="${e}" class="${l.etapa === e ? 'activo' : ''}">${ETAPA_TXT[e]}</button>`).join('')}</div>`}
    <div class="campos c2">
      <label>Nombre<input id="l-nombre" value="${esc(l?.nombre || pre.nombre || '')}"></label>
      <label>Teléfono<input id="l-tel" inputmode="numeric" maxlength="10" value="${esc(l?.telefono || pre.telefono || '')}"></label>
      <label>Origen<select id="l-origen">${Object.entries(ORIGEN_TXT).map(([k, v]) => `<option value="${k}" ${(l?.origen || 'whatsapp') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Campaña / anuncio<input id="l-campana" value="${esc(l?.campana || '')}" placeholder="Ej. Café — conversiones sep"></label>
      <label>Interés<input id="l-interes" value="${esc(l?.interes || '')}" placeholder="Producto o kit que preguntó"></label>
      <label>Monto estimado<input id="l-monto" type="number" min="0" step="10" value="${esc(l?.monto_estimado || '')}"></label>
      <label>Asesora<select id="l-asesora">${asesoras.map(a => `<option value="${a.id}" ${(l ? l.asesora_id : S.usuario.id) === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}${asesoras.some(a => a.id === S.usuario.id) ? '' : `<option value="${S.usuario.id}" ${!l || l.asesora_id === S.usuario.id ? 'selected' : ''}>${esc(S.perfil.nombre)}</option>`}</select></label>
      <label>Siguiente acción<input id="l-sig" type="date" value="${esc(l?.siguiente_accion || '')}"></label>
    </div>
    <label>Notas<textarea id="l-notas">${esc(l?.notas || '')}</textarea></label>
    <div class="fila" style="margin-top:12px"><button class="btn btn-p" id="l-guardar">${nuevo ? 'Registrar lead' : 'Guardar'}</button></div>
    <p id="l-error" class="error" hidden></p>`)
  const leer = () => ({
    nombre: $('#l-nombre', h).value.trim(), telefono: telLimpio($('#l-tel', h).value) || null, origen: $('#l-origen', h).value,
    campana: $('#l-campana', h).value.trim() || null, interes: $('#l-interes', h).value.trim() || null,
    monto_estimado: Number($('#l-monto', h).value) || null, asesora_id: $('#l-asesora', h).value,
    siguiente_accion: $('#l-sig', h).value || null, notas: $('#l-notas', h).value.trim() || null, actualizado: new Date().toISOString()
  })
  const guardar = async (extra = {}) => {
    const f = { ...leer(), ...extra }; const err = $('#l-error', h); err.hidden = true
    if (!f.nombre) { err.textContent = 'El nombre es obligatorio.'; err.hidden = false; return null }
    const r = nuevo ? await sb.from('pos_leads').insert(f).select().single() : await sb.from('pos_leads').update(f).eq('id', l.id).select().single()
    if (r.error) { err.textContent = r.error.message; err.hidden = false; return null }
    return r.data
  }
  $('#l-guardar', h).onclick = async () => { if (await guardar()) { toast('Lead guardado'); cerrarHoja(); cargar() } }
  $('#l-etapas', h)?.addEventListener('click', async e => {
    const b = e.target.closest('button[data-e]'); if (!b) return
    if (b.dataset.e === 'ganado') return convertir()
    if (await guardar({ etapa: b.dataset.e })) { toast('Etapa: ' + ETAPA_TXT[b.dataset.e]); cerrarHoja(); cargar() }
  })
  $('#l-wa', h)?.addEventListener('click', () => whatsapp(l.telefono, `Hola ${l.nombre.split(' ')[0]}, te escribe ${S.perfil.nombre} de Fit Plus. `))
  $('#l-ganar', h)?.addEventListener('click', convertir)

  async function convertir () {
    const f = leer()
    if (!f.telefono || f.telefono.length !== 10) { const err = $('#l-error', h); err.textContent = 'Para convertirlo en venta necesita teléfono de 10 dígitos.'; err.hidden = false; return }
    // crea o encuentra la clienta y manda al punto de venta
    let { data: cli } = await sb.from('pos_clientes').select('id').eq('telefono', f.telefono).maybeSingle()
    if (!cli) {
      const r = await sb.from('pos_clientes').insert({ nombre: f.nombre, telefono: f.telefono, tipo: 'minorista', asesora_id: f.asesora_id,
        asesora_nombre: S.perfiles.find(p => p.id === f.asesora_id)?.nombre || null, origen: ORIGEN_TXT[f.origen] || f.origen, notas: f.interes ? 'Interés inicial: ' + f.interes : null }).select('id').single()
      cli = r.data
    }
    const g = await guardar({ etapa: 'ganado', cliente_id: cli?.id || null })
    if (!g) return
    toast('Lead ganado · clienta lista en el punto de venta'); cerrarHoja()
    location.hash = `#/venta?tel=${f.telefono}`
  }
}
