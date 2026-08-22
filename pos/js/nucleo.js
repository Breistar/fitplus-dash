/* Núcleo compartido: conexión, estado, utilidades y reglas de negocio. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

export const sb = createClient('https://zyekxijetpvixxvvbzqd.supabase.co', 'sb_publishable_zpjoFnwp9eHtyXTrlnWWMQ_R964lp6O')

export const S = {
  usuario: null, perfil: null,
  productos: [], reglas: {}, config: {}, sucursales: [], perfiles: [],
  carrito: [], cliente: null
}

export const $  = (s, r = document) => r.querySelector(s)
export const $$ = (s, r = document) => [...r.querySelectorAll(s)]
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const dinero = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const dineroCorto = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX')
export const fecha = iso => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'
export const fechaLarga = iso => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
export const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const diasDesde = iso => iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null
export const hoy0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const mesIni = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d }
const dosDig = n => String(n).padStart(2, '0')
export const diaLocal = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}` }
export const hoyISO = () => diaLocal(new Date())
export const periodo = (d = new Date()) => diaLocal(d).slice(0, 7)
export const telLimpio = t => { const d = String(t || '').replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d }
export const telBonito = t => { if (!t) return '—'; if (/^(ML|WEB)-/.test(t)) return t.startsWith('ML') ? 'vía Mercado Libre' : 'vía tienda web'; const d = telLimpio(t); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t }

export const esAdmin = () => S.perfil?.rol === 'admin'
export const esInv = () => ['admin', 'inventario'].includes(S.perfil?.rol)
export const nombrePerfil = id => S.perfiles.find(p => p.id === id)?.nombre || '—'

export const ESTADOS = ['capturado', 'pagado', 'preparacion', 'enviado', 'entregado', 'cancelado']
export const ESTADO_TXT = { capturado: 'Por cobrar', pagado: 'Pagado', preparacion: 'En preparación', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' }
export const SIGUIENTE = { capturado: 'pagado', pagado: 'preparacion', preparacion: 'enviado', enviado: 'entregado' }
export const ACCION_TXT = { capturado: 'Marcar pagado', pagado: 'Pasar a preparación', preparacion: 'Marcar enviado', enviado: 'Marcar entregado' }
export const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', oxxo: 'OXXO / tienda', contra_entrega: 'Contra entrega', mercado_pago: 'Mercado Pago', paypal: 'PayPal', mercado_libre: 'Mercado Libre' }
export const CANAL_TXT = { pos: 'Sucursal / asesora', web: 'Tienda web', ml: 'Mercado Libre' }
export const tagCanal = c => c && c !== 'pos' ? `<span class="tag tenue">${CANAL_TXT[c] || c}</span>` : ''
export const DESTINOS = { sucursal: 'Recoge en sucursal', oaxaca: 'Envío ciudad de Oaxaca', nacional: 'Envío nacional', eua: 'Envío a EUA' }
export const ETAPAS = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido']
export const ETAPA_TXT = { nuevo: 'Nuevo', contactado: 'Contactado', cotizado: 'Cotizado', ganado: 'Ganado', perdido: 'Perdido' }
export const ORIGEN_TXT = { meta_ads: 'Pauta Meta', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', web: 'Sitio web', referido: 'Referido', sucursal: 'Sucursal', otro: 'Otro' }

export const tagEstado = e => `<span class="tag e-${e}">${ESTADO_TXT[e] || e}</span>`
export const tagEtapa = e => `<span class="tag l-${e}">${ETAPA_TXT[e] || e}</span>`
export const tagTipo = t => `<span class="tag ${t === 'mayorista' ? 'lleno' : 'tenue'}">${t}</span>`

/* ---------- Motor de precios: quiebre por cantidad → lista mayoreo → lista menudeo ---------- */
export function precioUnitario (prod, cantidad, tipo) {
  const clase = tipo === 'mayorista' ? 'mayorista' : 'minorista'
  const reglas = (S.reglas[prod.id] || [])
    .filter(r => r.tipo_cliente === clase && r.cantidad_min <= cantidad)
    .sort((a, b) => b.cantidad_min - a.cantidad_min)
  if (reglas.length) return { precio: Number(reglas[0].precio), regla: `desde ${reglas[0].cantidad_min} pzas` }
  if (clase === 'mayorista' && prod.precio_mayoreo != null) return { precio: Number(prod.precio_mayoreo), regla: 'mayoreo' }
  return { precio: Number(prod.precio_menudeo), regla: null }
}

/* ---------- Calculadora de envío (reglas verificadas con la tienda) ---------- */
export function calcEnvio (subtotal, destino) {
  const c = S.config
  const n = k => Number(c[k] || 0)
  if (destino === 'sucursal') return { costo: 0, texto: 'Sin envío · recoge en sucursal' }
  if (destino === 'eua') return { costo: n('envio_eua') || 7550, texto: 'Tarifa plana EUA' }
  if (destino === 'oaxaca') {
    const min = n('envio_gratis_oaxaca') || 500
    return subtotal >= min ? { costo: 0, texto: 'Gratis en ciudad de Oaxaca' }
      : { costo: n('envio_nacional') || 130, texto: `Faltan ${dinero(min - subtotal)} para envío gratis` }
  }
  const min = n('envio_gratis_desde') || 1500
  return subtotal >= min ? { costo: 0, texto: 'Envío nacional gratis' }
    : { costo: n('envio_nacional') || 130, texto: `Faltan ${dinero(min - subtotal)} para envío gratis` }
}

/* ---------- Segmentación RFM simplificada (suplementos: ciclo ~30 días) ---------- */
export function segmento (st) {
  if (!st || !st.compras) return { clave: 'sin_registro', txt: 'Sin compra registrada' }
  const d = diasDesde(st.ultima)
  if (st.compras >= 4 && d <= 45) return { clave: 'campeona', txt: 'Campeona' }
  if (d <= 30) return { clave: 'activa', txt: 'Activa' }
  if (d <= 60) return { clave: 'recompra', txt: 'Toca recompra' }
  if (d <= 120) return { clave: 'riesgo', txt: 'En riesgo' }
  return { clave: 'dormida', txt: 'Dormida' }
}

/* ---------- Carga base ---------- */
export async function cargarBase () {
  const [prods, reglas, config, sucs, perfiles] = await Promise.all([
    sb.from('pos_productos').select('*').order('nombre'),
    sb.from('pos_reglas_precio').select('*').eq('activa', true),
    sb.from('pos_config').select('*'),
    sb.from('pos_sucursales').select('*').eq('activa', true).order('id'),
    sb.from('pos_perfiles').select('id,nombre,rol,sucursal_id,activo')
  ])
  S.productos = prods.data || []
  S.reglas = {}
  for (const r of reglas.data || []) (S.reglas[r.producto_id] ||= []).push(r)
  S.config = Object.fromEntries((config.data || []).map(c => [c.clave, c.valor]))
  S.sucursales = sucs.data || []
  S.perfiles = perfiles.data || []
}

/* ---------- Paginación: la API corta en 1,000 filas; esto trae todo en bloques ---------- */
export async function todo (armar, paso = 1000) {
  const filas = []
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await armar().range(desde, desde + paso - 1)
    if (error) throw error
    filas.push(...(data || []))
    if (!data || data.length < paso) return filas
  }
}

/* ---------- Estadísticas de compra por clienta (desde tickets cobrados) ---------- */
export async function statsClientas () {
  const data = await todo(() => sb.from('pos_tickets').select('cliente_id,total,creado,estado')
    .in('estado', ['pagado', 'preparacion', 'enviado', 'entregado']).order('id'))
  const m = {}
  for (const t of data) {
    if (!t.cliente_id) continue
    const s = (m[t.cliente_id] ||= { compras: 0, total: 0, ultima: null, primera: null })
    s.compras++; s.total += Number(t.total)
    if (!s.ultima || t.creado > s.ultima) s.ultima = t.creado
    if (!s.primera || t.creado < s.primera) s.primera = t.creado
  }
  return m
}

/* ---------- UI: toast, hoja lateral, WhatsApp ---------- */
let toastT
export function toast (msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true }, 2600)
}

export function hoja (html) {
  cerrarHoja()
  const raiz = $('#hoja-raiz')
  raiz.innerHTML = `<div class="hoja-fondo"><div class="hoja">${html}</div></div>`
  const fondo = raiz.firstElementChild
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrarHoja() })
  document.body.style.overflow = 'hidden'
  return fondo.firstElementChild
}
export function cerrarHoja () { $('#hoja-raiz').innerHTML = ''; document.body.style.overflow = '' }
export const cabHoja = (titulo, extra = '') =>
  `<div class="cab"><h2>${titulo}</h2><div class="fila" style="flex:0 0 auto">${extra}<button class="btn btn-chico btn-fantasma" data-cerrar>Cerrar</button></div></div>`

export function whatsapp (tel, texto) {
  const d = telLimpio(tel)
  if (tel && !/^\d{10}$/.test(d)) return toast('Esta clienta no tiene teléfono directo (compra por ' + (String(tel).startsWith('ML') ? 'Mercado Libre' : 'la web') + ')')
  const url = d ? `https://wa.me/52${d}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`
  window.open(url, '_blank')
}

export function textoTicket (t, items, cliente) {
  const l = (items || []).map(i => `• ${i.cantidad} × ${i.nombre} — ${dinero(i.importe)}`).join('\n')
  const envio = Number(t.envio) ? `\nEnvío: ${dinero(t.envio)}` : ''
  return `*Fit Plus* · Pedido ${t.folio}\n${fechaHora(t.creado)}\n${cliente ? cliente.nombre + '\n' : ''}\n${l}${envio}\n\n*Total: ${dinero(t.total)}*\nEstado: ${ESTADO_TXT[t.estado] || t.estado}`
}

export function descargarCSV (nombre, filas) {
  if (!filas.length) return toast('Nada que exportar')
  const cab = Object.keys(filas[0])
  const csv = [cab.join(','), ...filas.map(f => cab.map(k => `"${String(f[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
  a.download = nombre; a.click()
}

export const ICONO = {
  inicio: '<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></svg>',
  venta: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h4"/></svg>',
  pedidos: '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  clientas: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  leads: '<svg viewBox="0 0 24 24"><path d="M4 4h16l-6 8v6l-4 2v-8z"/></svg>',
  inventario: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/></svg>',
  catalogo: '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>',
  reportes: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
}
