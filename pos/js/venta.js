/* Punto de venta: clienta por teléfono, catálogo con reglas de precio, envío y ticket. */
import { sb, S, $, $$, esc, dinero, precioUnitario, calcEnvio, DESTINOS, METODOS, tagTipo, toast, hoja, cabHoja, cerrarHoja, whatsapp, textoTicket, fechaHora, esAdmin, telLimpio, telBonito } from './nucleo.js'

let cont, categoria = null, destino = 'sucursal', descuento = 0

export async function render (c, p = {}) {
  cont = c
  S.carrito = S.carrito || []
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Venta</h1><p>El sistema aplica los precios y calcula el envío. Tú sólo eliges productos y clienta.</p></div></div>
  <div class="pos">
    <div>
      <section class="tarjeta">
        <h2>Clienta</h2>
        <div class="fila">
          <input id="cli-q" class="grande" type="search" inputmode="search" placeholder="Teléfono o nombre" autocomplete="off">
          <button class="btn fijo" id="btn-buscar-cli">Buscar</button>
        </div>
        <div id="cli-res"></div>
        <div id="cli-ok" class="cliente-ok" hidden></div>
        <div id="cli-alta" class="alta" hidden>
          <p class="aviso">No está registrada. Se da de alta al guardar la venta.</p>
          <div class="campos c2">
            <input id="cli-nombre" placeholder="Nombre">
            <input id="cli-tel" type="tel" inputmode="numeric" maxlength="10" placeholder="Teléfono (10 dígitos)">
            <select id="cli-tipo"><option value="minorista">Minorista</option><option value="mayorista">Mayorista</option></select>
            <input id="cli-ciudad" placeholder="Ciudad / estado">
          </div>
        </div>
      </section>
      <section class="tarjeta">
        <div class="fila" style="margin-bottom:8px"><h2 style="margin:0">Productos</h2>
          <input id="buscar-prod" type="search" placeholder="Buscar por nombre o SKU" autocomplete="off"></div>
        <div id="chips-cat" class="chips"></div>
        <div id="rejilla" class="rejilla"></div>
      </section>
    </div>
    <section class="tarjeta ticket">
      <h2>Ticket</h2>
      <div id="carrito" class="carrito"></div>
      <div class="totales">
        <div class="tot-fila"><span>Subtotal</span><b id="t-subtotal" class="num">$0.00</b></div>
        <div class="tot-fila" id="fila-ahorro" hidden><span>Ahorro por mayoreo</span><b id="t-ahorro" class="num"></b></div>
        ${esAdmin() ? '<div class="tot-fila"><span>Descuento</span><b><input id="t-desc" type="number" min="0" step="1" value="0" style="width:96px;padding:4px 8px;text-align:right"></b></div>' : ''}
        <div class="tot-fila"><span id="t-envio-txt">Envío</span><b id="t-envio" class="num">$0.00</b></div>
        <div class="tot-fila total"><span>Total</span><b id="t-total" class="num">$0.00</b></div>
      </div>
      <div class="sep"></div>
      <div class="campos">
        <select id="destino">${Object.entries(DESTINOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <div class="fila">
          <select id="metodo-pago">${Object.entries(METODOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select id="sucursal-venta">${S.sucursales.map(s => `<option value="${s.id}" ${s.id === S.perfil.sucursal_id ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>
        </div>
        <input id="nota-venta" placeholder="Nota (opcional)">
      </div>
      <div class="fila" style="margin-top:12px">
        <button class="btn" id="btn-cotizar" title="Envía la cotización por WhatsApp sin registrar venta">Cotizar</button>
        <button class="btn" id="btn-guardar">Guardar</button>
        <button class="btn btn-p" id="btn-cobrar">Cobrar</button>
      </div>
      <p id="venta-error" class="error" hidden></p>
    </section>
  </div>`

  pintarCategorias(); pintarProductos(); pintarCarrito()
  if (p.tel) { $('#cli-q').value = p.tel; await buscarCliente() }

  $('#btn-buscar-cli').onclick = buscarCliente
  $('#cli-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscarCliente() } })
  $('#cli-tipo').onchange = () => { pintarProductos(); pintarCarrito() }
  $('#buscar-prod').oninput = pintarProductos
  $('#chips-cat').onclick = e => { const ch = e.target.closest('.chip'); if (!ch) return; categoria = ch.dataset.cat || null; pintarCategorias(); pintarProductos() }
  $('#rejilla').onclick = e => { const b = e.target.closest('.prod'); if (b) agregar(Number(b.dataset.id)) }
  $('#carrito').onclick = e => {
    const b = e.target.closest('button[data-op]'); if (!b) return
    const id = Number(b.closest('.linea').dataset.id)
    const l = S.carrito.find(x => x.id === id)
    if (b.dataset.op === 'x') S.carrito = S.carrito.filter(x => x.id !== id)
    else { l.cantidad += b.dataset.op === '+' ? 1 : -1; if (l.cantidad <= 0) S.carrito = S.carrito.filter(x => x.id !== id) }
    pintarCarrito()
  }
  $('#destino').onchange = e => { destino = e.target.value; pintarCarrito() }
  $('#t-desc')?.addEventListener('input', e => { descuento = Number(e.target.value) || 0; pintarCarrito() })
  $('#btn-cotizar').onclick = cotizar
  $('#btn-guardar').onclick = () => registrar(false)
  $('#btn-cobrar').onclick = () => registrar(true)
}

/* ---------- Clienta ---------- */
async function buscarCliente () {
  const q = $('#cli-q').value.trim()
  $('#cli-res').innerHTML = ''
  if (!q) return
  const dig = q.replace(/\D/g, '')
  let data = []
  if (dig.length >= 6) {
    const r = await sb.from('pos_clientes').select('*').ilike('telefono', `%${dig}%`).limit(6); data = r.data || []
  } else {
    const r = await sb.from('pos_clientes').select('*').ilike('nombre', `%${q}%`).limit(8); data = r.data || []
  }
  if (data.length === 1) return elegirCliente(data[0])
  if (data.length > 1) {
    $('#cli-res').innerHTML = `<div class="resultados">${data.map(c =>
      `<button data-id="${c.id}"><b>${esc(c.nombre)}</b> · ${telBonito(c.telefono)} <span class="suave">· ${esc(c.estado || '')}</span></button>`).join('')}</div>`
    $('#cli-res').onclick = e => { const b = e.target.closest('button'); if (b) elegirCliente(data.find(c => c.id === Number(b.dataset.id))) }
    return
  }
  S.cliente = null
  $('#cli-ok').hidden = true; $('#cli-alta').hidden = false
  if (dig.length === 10) $('#cli-tel').value = dig; else $('#cli-nombre').value = q
  pintarProductos(); pintarCarrito()
}
function elegirCliente (c) {
  S.cliente = c
  $('#cli-res').innerHTML = ''
  $('#cli-alta').hidden = true
  $('#cli-ok').hidden = false
  $('#cli-ok').innerHTML = `<b>${esc(c.nombre)} ${tagTipo(c.tipo)}</b>
    <span class="chico suave">${telBonito(c.telefono)} · ${esc(c.estado || c.ciudad || 'sin ubicación')}${c.asesora_nombre ? ' · asesora ' + esc(c.asesora_nombre) : ''}</span>
    <div class="fila" style="margin-top:8px"><button class="btn btn-chico" id="btn-cambiar-cli">Cambiar</button></div>`
  $('#btn-cambiar-cli').onclick = () => { S.cliente = null; $('#cli-ok').hidden = true; $('#cli-q').value = ''; $('#cli-q').focus(); pintarProductos(); pintarCarrito() }
  pintarProductos(); pintarCarrito()
}
const tipoActual = () => S.cliente ? S.cliente.tipo : ($('#cli-tipo')?.value || 'minorista')

/* ---------- Catálogo ---------- */
function pintarCategorias () {
  const cats = [...new Set(S.productos.filter(p => p.activo).map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  $('#chips-cat').innerHTML = `<button class="chip ${!categoria ? 'activo' : ''}" data-cat="">Todos</button>` +
    cats.map(c => `<button class="chip ${categoria === c ? 'activo' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')
}
function pintarProductos () {
  const q = ($('#buscar-prod')?.value || '').trim().toLowerCase()
  const tipo = tipoActual()
  const lista = S.productos.filter(p => p.activo && (!categoria || p.categoria === categoria) &&
    (!q || p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))).slice(0, 80)
  $('#rejilla').innerHTML = lista.map(p => {
    const { precio } = precioUnitario(p, 1, tipo)
    const stk = Number(p.stock)
    return `<button class="prod ${stk <= 0 ? 'agotado' : ''}" data-id="${p.id}">
      ${p.imagen ? `<img src="${esc(p.imagen)}" alt="" loading="lazy">` : '<div class="sin-img">sin foto</div>'}
      <span class="nom">${esc(p.nombre)}</span>
      <span class="pre num">${dinero(precio)}</span>
      <span class="stk">${stk > 0 ? stk + ' en existencia' : 'sin existencia'}</span>
    </button>`
  }).join('') || '<p class="vacio">Sin resultados.</p>'
}

/* ---------- Carrito ---------- */
function agregar (id) {
  const l = S.carrito.find(x => x.id === id)
  if (l) l.cantidad++; else S.carrito.push({ id, cantidad: 1 })
  pintarCarrito()
  if (window.innerWidth < 900) $('.ticket').scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function calcular () {
  const tipo = tipoActual()
  let subtotal = 0, lista = 0
  const lineas = S.carrito.map(l => {
    const p = S.productos.find(x => x.id === l.id)
    const { precio, regla } = precioUnitario(p, l.cantidad, tipo)
    const importe = precio * l.cantidad
    subtotal += importe; lista += Number(p.precio_menudeo) * l.cantidad
    return { p, l, precio, regla, importe }
  })
  const env = calcEnvio(subtotal, destino)
  const desc = Math.min(descuento, subtotal)
  return { lineas, subtotal, ahorro: lista - subtotal, envio: env.costo, envioTxt: env.texto, descuento: desc, total: subtotal - desc + env.costo, tipo }
}
function pintarCarrito () {
  const c = calcular()
  const cont = $('#carrito')
  if (!c.lineas.length) {
    cont.innerHTML = '<p class="vacio">Toca un producto para agregarlo.</p>'
  } else {
    cont.innerHTML = c.lineas.map(({ p, l, precio, regla, importe }) => `
      <div class="linea" data-id="${p.id}">
        <div><div class="nom">${esc(p.nombre)}</div>
          <div class="det">${l.cantidad} × ${dinero(precio)}${regla ? ` · <span class="regla">${regla}</span>` : ''}${Number(p.stock) < l.cantidad ? ' · <b>excede existencia</b>' : ''}</div></div>
        <div><div class="cant"><button data-op="-">−</button><span>${l.cantidad}</span><button data-op="+">+</button><button data-op="x" title="Quitar">×</button></div>
          <div class="imp num">${dinero(importe)}</div></div>
      </div>`).join('')
  }
  $('#t-subtotal').textContent = dinero(c.subtotal)
  $('#fila-ahorro').hidden = c.ahorro <= 0
  $('#t-ahorro').textContent = '− ' + dinero(c.ahorro)
  $('#t-envio').textContent = dinero(c.envio)
  $('#t-envio-txt').textContent = 'Envío · ' + c.envioTxt
  $('#t-total').textContent = dinero(c.total)
}

/* ---------- Cotización por WhatsApp (sin registrar) ---------- */
function cotizar () {
  const c = calcular()
  if (!c.lineas.length) return fallo('Agrega productos para cotizar.')
  const nombre = S.cliente?.nombre || $('#cli-nombre').value.trim()
  const txt = `*Fit Plus* · Cotización${nombre ? ' para ' + nombre : ''}\n\n` +
    c.lineas.map(x => `• ${x.l.cantidad} × ${x.p.nombre} — ${dinero(x.importe)}`).join('\n') +
    `\n\nSubtotal: ${dinero(c.subtotal)}` + (c.ahorro > 0 ? `\nAhorro por mayoreo: −${dinero(c.ahorro)}` : '') +
    `\nEnvío: ${c.envio ? dinero(c.envio) : 'gratis'} (${c.envioTxt})\n*Total: ${dinero(c.total)}*\n\nVigencia: hoy. ¿Confirmamos tu pedido?`
  whatsapp(S.cliente?.telefono || $('#cli-tel').value, txt)
}

/* ---------- Registro de venta ---------- */
function fallo (m) { const e = $('#venta-error'); e.textContent = m; e.hidden = false }
async function registrar (cobrar) {
  $('#venta-error').hidden = true
  const c = calcular()
  if (!c.lineas.length) return fallo('Agrega al menos un producto.')
  let cliente = S.cliente
  if (!cliente) {
    const nombre = $('#cli-nombre').value.trim(); const tel = telLimpio($('#cli-tel').value)
    if (!nombre) return fallo('Escribe el nombre de la clienta.')
    if (tel.length !== 10) return fallo('El teléfono debe tener 10 dígitos.')
    const { data, error } = await sb.from('pos_clientes').insert({
      telefono: tel, nombre, tipo: $('#cli-tipo').value, ciudad: $('#cli-ciudad').value.trim() || null,
      asesora_id: S.usuario.id, asesora_nombre: S.perfil.nombre, origen: 'pos'
    }).select().single()
    if (error) return fallo(error.code === '23505' ? 'Ese teléfono ya está registrado: búscalo arriba.' : 'No se pudo dar de alta: ' + error.message)
    cliente = data
  }
  const btns = $$('#btn-guardar,#btn-cobrar'); btns.forEach(b => b.disabled = true)
  try {
    const { data: t, error: e1 } = await sb.from('pos_tickets').insert({
      cliente_id: cliente.id, asesora_id: S.usuario.id, sucursal_id: Number($('#sucursal-venta').value),
      metodo_pago: $('#metodo-pago').value, destino, envio: c.envio, descuento: c.descuento,
      notas: $('#nota-venta').value.trim() || null
    }).select().single()
    if (e1) throw e1
    const items = c.lineas.map(x => ({ ticket_id: t.id, producto_id: x.p.id, nombre: x.p.nombre, sku: x.p.sku,
      cantidad: x.l.cantidad, precio_unitario: x.precio, precio_lista: x.p.precio_menudeo, importe: x.importe }))
    const { error: e2 } = await sb.from('pos_ticket_items').insert(items)
    if (e2) throw e2
    if (cobrar) { const { error: e3 } = await sb.from('pos_tickets').update({ estado: 'pagado' }).eq('id', t.id); if (e3) throw e3 }
    const { data: fin } = await sb.from('pos_tickets').select('*').eq('id', t.id).single()
    // refresca existencias en memoria
    for (const x of c.lineas) if (cobrar) x.p.stock = Number(x.p.stock) - x.l.cantidad
    mostrarTicket(fin, items, cliente)
    S.carrito = []; S.cliente = null; descuento = 0
    render(cont)
  } catch (e) { fallo('No se pudo registrar: ' + e.message) }
  finally { btns.forEach(b => b.disabled = false) }
}

function mostrarTicket (t, items, cliente) {
  const h = hoja(cabHoja('Venta registrada') + `
    <div class="ticket-folio">${esc(t.folio)}</div>
    <p class="suave chico">${fechaHora(t.creado)} · ${esc(cliente.nombre)} · ${telBonito(cliente.telefono)}</p>
    <div class="sep"></div>
    ${items.map(i => `<div class="ticket-linea"><span>${i.cantidad} × ${esc(i.nombre)}</span><b class="num">${dinero(i.importe)}</b></div>`).join('')}
    ${Number(t.envio) ? `<div class="ticket-linea"><span>Envío</span><b class="num">${dinero(t.envio)}</b></div>` : ''}
    ${Number(t.descuento) ? `<div class="ticket-linea"><span>Descuento</span><b class="num">− ${dinero(t.descuento)}</b></div>` : ''}
    <div class="ticket-total"><span>Total</span><span class="num">${dinero(t.total)}</span></div>
    <p class="chico suave" style="margin-top:6px">${t.estado === 'pagado' ? 'Cobrado · ' + (METODOS[t.metodo_pago] || t.metodo_pago) : 'Guardado por cobrar'} · ${DESTINOS[t.destino]}</p>
    <div class="fila" style="margin-top:16px">
      <button class="btn btn-p" id="tk-wa">Enviar ticket por WhatsApp</button>
      <button class="btn" data-cerrar>Nueva venta</button>
    </div>`)
  $('#tk-wa', h).onclick = () => whatsapp(cliente.telefono, textoTicket(t, items, cliente))
}
