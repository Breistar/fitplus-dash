/* Arranque, acceso y navegación. */
import { sb, S, $, $$, esc, cargarBase, ICONO, esAdmin, esInv, cerrarHoja } from './nucleo.js'
import * as inicio from './inicio.js'
import * as venta from './venta.js'
import * as pedidos from './pedidos.js'
import * as clientas from './clientas.js'
import * as leads from './leads.js'
import * as inventario from './inventario.js'
import * as catalogo from './catalogo.js'
import * as reportes from './reportes.js'

const VISTAS = {
  inicio:     { mod: inicio,     titulo: 'Inicio',     roles: null },
  venta:      { mod: venta,      titulo: 'Venta',      roles: null },
  pedidos:    { mod: pedidos,    titulo: 'Pedidos',    roles: null },
  clientas:   { mod: clientas,   titulo: 'Clientas',   roles: null },
  leads:      { mod: leads,      titulo: 'Leads',      roles: null },
  inventario: { mod: inventario, titulo: 'Inventario', roles: ['admin', 'inventario'] },
  catalogo:   { mod: catalogo,   titulo: 'Catálogo',   roles: ['admin'] },
  reportes:   { mod: reportes,   titulo: 'Reportes',   roles: ['admin'] }
}
const MOVIL = ['inicio', 'venta', 'pedidos', 'clientas', 'leads']

$('#form-login').addEventListener('submit', async e => {
  e.preventDefault()
  const err = $('#login-error'); err.hidden = true
  const { error } = await sb.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-pass').value })
  if (error) { err.textContent = 'No pudimos entrar. Revisa el correo y la contraseña.'; err.hidden = false; return }
  iniciar()
})
$('#btn-salir').addEventListener('click', async () => { await sb.auth.signOut(); location.hash = ''; location.reload() })

function permitido (v) { const r = VISTAS[v]?.roles; return !r || r.includes(S.perfil.rol) }

function pintarNav () {
  const activa = vistaActual()
  const enlaces = Object.entries(VISTAS).filter(([k]) => permitido(k))
  $('#nav').innerHTML = enlaces.map(([k, v]) =>
    `<a href="#/${k}" class="${k === activa ? 'activa' : ''}">${ICONO[k]}<span>${v.titulo}</span></a>`).join('')
  const movil = enlaces.filter(([k]) => MOVIL.includes(k)).slice(0, 5)
  $('#barra-inf').innerHTML = movil.map(([k, v]) =>
    `<a href="#/${k}" class="${k === activa ? 'activa' : ''}">${ICONO[k]}<span>${v.titulo}</span></a>`).join('')
}

function vistaActual () {
  const v = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'inicio'
  return VISTAS[v] && permitido(v) ? v : 'inicio'
}
export function params () {
  const q = location.hash.split('?')[1] || ''
  return Object.fromEntries(new URLSearchParams(q))
}

async function navegar () {
  if (!S.perfil) return
  cerrarHoja()
  const v = vistaActual()
  pintarNav()
  const cont = $('#vista')
  cont.innerHTML = '<p class="vacio">Cargando…</p>'
  try { await VISTAS[v].mod.render(cont, params()) }
  catch (e) { console.error(e); cont.innerHTML = `<p class="error">No se pudo cargar esta pantalla: ${esc(e.message)}</p>` }
  window.scrollTo(0, 0)
}
window.addEventListener('hashchange', navegar)

// Acciones globales por delegación: cerrar hoja
document.addEventListener('click', e => { if (e.target.closest('[data-cerrar]')) cerrarHoja() })

async function iniciar () {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) { $('#pantalla-login').hidden = false; $('#app').hidden = true; return }
  S.usuario = user
  const { data: perfil } = await sb.from('pos_perfiles').select('*').eq('id', user.id).single()
  if (!perfil) { $('#pantalla-login').hidden = false; $('#login-error').textContent = 'Tu usuario no tiene perfil asignado. Pide a administración que te dé de alta.'; $('#login-error').hidden = false; return }
  S.perfil = perfil
  await cargarBase()
  $('#pantalla-login').hidden = true
  $('#app').hidden = false
  $('#u-nombre').textContent = perfil.nombre
  $('#u-rol').textContent = { admin: 'Administración', asesora: 'Asesora', inventario: 'Inventario' }[perfil.rol] || perfil.rol
  $('#u-nombre-m').textContent = perfil.nombre
  navegar()
}

iniciar()
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})
