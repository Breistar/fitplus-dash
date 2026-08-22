/* Inventario: existencias, entradas, ajustes, alertas y bitácora de movimientos. */
import { sb, S, $, $$, esc, dinero, fechaHora, toast, hoja, cabHoja, cerrarHoja, nombrePerfil, descargarCSV, cargarBase } from './nucleo.js'

let cont, q = '', filtro = 'todos'

export async function render (c) {
  cont = c
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Inventario</h1><p>Las existencias bajan solas al cobrar y regresan al cancelar. Aquí se capturan entradas y ajustes.</p></div>
    <div class="acciones-cab"><button class="btn" id="inv-csv">Exportar</button><button class="btn btn-p" id="inv-entrada">Registrar entrada</button></div></div>
  <div class="cuadricula c4" id="inv-metricas" style="margin-bottom:14px"></div>
  <div class="tarjeta">
    <div class="fila">
      <input id="inv-q" type="search" placeholder="Producto o SKU" value="${esc(q)}">
      <div class="pill-grupo fijo" id="inv-filtros">
        ${[['todos', 'Todos'], ['bajo', 'Bajo mínimo'], ['agotado', 'Agotados'], ['web', 'En la web'], ['sucursal', 'Sólo sucursal']].map(([k, v]) => `<button data-f="${k}" class="${filtro === k ? 'activo' : ''}">${v}</button>`).join('')}
      </div>
    </div>
    <div class="tabla-env" style="margin-top:12px"><table><thead><tr><th>Producto</th><th>SKU</th><th>Categoría</th><th class="der">Existencia</th><th class="der">Mínimo</th><th>Web</th><th class="der">Valor a lista</th></tr></thead><tbody id="inv-tbody"></tbody></table></div>
  </div>`
  $('#inv-q').oninput = e => { q = e.target.value; pintar() }
  $('#inv-filtros').onclick = e => { const b = e.target.closest('button[data-f]'); if (!b) return; filtro = b.dataset.f; render(cont) }
  $('#inv-entrada').onclick = () => movimiento(null)
  $('#inv-csv').onclick = () => descargarCSV('inventario.csv', filtradas().map(p => ({ producto: p.nombre, sku: p.sku, categoria: p.categoria, existencia: p.stock, minimo: p.stock_min, en_web: p.woo_id ? 'sí' : 'no', precio_lista: p.precio_menudeo, activo: p.activo ? 'sí' : 'no' })))
  await cargarBase(); pintar()
}
function filtradas () {
  const qq = q.trim().toLowerCase()
  return S.productos.filter(p =>
    (!qq || p.nombre.toLowerCase().includes(qq) || (p.sku || '').toLowerCase().includes(qq)) &&
    (filtro === 'todos' || (filtro === 'bajo' && Number(p.stock) <= Number(p.stock_min) && Number(p.stock) > 0) ||
     (filtro === 'agotado' && Number(p.stock) <= 0) || (filtro === 'web' && p.woo_id) || (filtro === 'sucursal' && !p.woo_id)))
}
function pintar () {
  const lista = filtradas()
  const todos = S.productos
  const piezas = todos.reduce((s, p) => s + Number(p.stock), 0)
  const valor = todos.reduce((s, p) => s + Number(p.stock) * Number(p.precio_menudeo), 0)
  const bajo = todos.filter(p => Number(p.stock) <= Number(p.stock_min) && Number(p.stock) > 0).length
  const agot = todos.filter(p => p.activo && Number(p.stock) <= 0).length
  $('#inv-metricas').innerHTML = `
    <div class="metrica oscura"><div class="cap">Piezas en existencia</div><div class="val num">${piezas.toLocaleString('es-MX')}</div><div class="sub">${todos.length} productos</div></div>
    <div class="metrica"><div class="cap">Valor a precio de lista</div><div class="val num">${dinero(valor)}</div></div>
    <div class="metrica"><div class="cap">Bajo mínimo</div><div class="val num">${bajo}</div><div class="sub">conviene reabastecer</div></div>
    <div class="metrica"><div class="cap">Agotados activos</div><div class="val num">${agot}</div><div class="sub">se venden pero no hay pieza</div></div>`
  $('#inv-tbody').innerHTML = lista.map(p => {
    const s = Number(p.stock), m = Number(p.stock_min)
    return `<tr class="clic" data-id="${p.id}">
      <td><b>${esc(p.nombre)}</b>${!p.activo ? ' <span class="tag tenue">inactivo</span>' : ''}</td>
      <td class="mono suave">${esc(p.sku || '')}</td><td>${esc(p.categoria || '')}</td>
      <td class="der num ${s <= 0 ? 'stock-bajo' : s <= m ? 'stock-bajo' : ''}">${s}</td><td class="der num suave">${m}</td>
      <td>${p.woo_id ? '<span class="tag medio">web</span>' : '<span class="tag tenue">sucursal</span>'}</td>
      <td class="der num">${dinero(s * Number(p.precio_menudeo))}</td></tr>`
  }).join('') || '<tr><td colspan="7" class="vacio">Sin productos.</td></tr>'
  $('#inv-tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) detalle(S.productos.find(p => p.id === Number(tr.dataset.id))) }
}

async function detalle (p) {
  const { data: movs } = await sb.from('pos_inventario_mov').select('*').eq('producto_id', p.id).order('creado', { ascending: false }).limit(40)
  const h = hoja(cabHoja(esc(p.nombre)) + `
    <div class="cuadricula c3" style="margin-bottom:12px">
      <div class="metrica"><div class="cap">Existencia</div><div class="val num">${Number(p.stock)}</div></div>
      <div class="metrica"><div class="cap">Mínimo</div><div class="val num">${Number(p.stock_min)}</div></div>
      <div class="metrica"><div class="cap">Precio lista</div><div class="val num">${dinero(p.precio_menudeo)}</div></div>
    </div>
    <div class="acc"><button class="btn btn-p" id="i-entrada">Entrada</button><button class="btn" id="i-salida">Salida</button><button class="btn" id="i-ajuste">Ajuste a conteo</button></div>
    <h3>Movimientos</h3>
    <div class="tabla-env"><table><thead><tr><th>Fecha</th><th>Tipo</th><th class="der">Cant.</th><th class="der">Saldo</th><th>Nota</th></tr></thead><tbody>
      ${(movs || []).map(m => `<tr><td class="chico">${fechaHora(m.creado)}</td><td>${m.tipo}</td><td class="der num">${m.tipo === 'salida' ? '−' : ''}${Number(m.cantidad)}</td><td class="der num">${m.saldo ?? '—'}</td><td class="chico suave">${esc(m.nota || '')}${m.usuario_id ? ' · ' + esc(nombrePerfil(m.usuario_id)) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin movimientos.</td></tr>'}
    </tbody></table></div>`)
  $('#i-entrada', h).onclick = () => movimiento(p, 'entrada')
  $('#i-salida', h).onclick = () => movimiento(p, 'salida')
  $('#i-ajuste', h).onclick = () => movimiento(p, 'ajuste')
}

function movimiento (p, tipo = 'entrada') {
  const h = hoja(cabHoja({ entrada: 'Registrar entrada', salida: 'Registrar salida', ajuste: 'Ajustar a conteo físico' }[tipo]) + `
    <div class="campos">
      ${p ? `<p><b>${esc(p.nombre)}</b> · existencia actual <b class="num">${Number(p.stock)}</b></p>` : `<label>Producto<input id="m-q" list="m-lista" placeholder="Escribe para buscar"><datalist id="m-lista">${S.productos.map(x => `<option value="${esc(x.nombre)}">`).join('')}</datalist></label>`}
      <label>${tipo === 'ajuste' ? 'Existencia real contada' : 'Cantidad'}<input id="m-cant" type="number" min="0" step="1" inputmode="numeric" class="grande"></label>
      <label>Nota<input id="m-nota" placeholder="${tipo === 'entrada' ? 'Ej. llegó producción del 3 de septiembre' : tipo === 'salida' ? 'Ej. muestra, merma, traspaso a CDMX' : 'Ej. conteo mensual'}"></label>
    </div>
    <div class="fila" style="margin-top:12px"><button class="btn btn-p" id="m-ok">Aplicar</button></div>
    <p id="m-error" class="error" hidden></p>`)
  $('#m-ok', h).onclick = async () => {
    const err = $('#m-error', h); err.hidden = true
    let prod = p
    if (!prod) { const n = $('#m-q', h).value.trim().toLowerCase(); prod = S.productos.find(x => x.nombre.toLowerCase() === n) || S.productos.find(x => x.nombre.toLowerCase().includes(n) && n.length > 3) }
    if (!prod) { err.textContent = 'Elige un producto de la lista.'; err.hidden = false; return }
    const cant = Number($('#m-cant', h).value)
    if (!(cant >= 0) || (tipo !== 'ajuste' && cant <= 0)) { err.textContent = 'Captura una cantidad válida.'; err.hidden = false; return }
    const actual = Number(prod.stock)
    const saldo = tipo === 'entrada' ? actual + cant : tipo === 'salida' ? actual - cant : cant
    const delta = Math.abs(saldo - actual)
    const { error: e1 } = await sb.from('pos_productos').update({ stock: saldo, actualizado: new Date().toISOString() }).eq('id', prod.id)
    if (e1) { err.textContent = e1.message; err.hidden = false; return }
    await sb.from('pos_inventario_mov').insert({ producto_id: prod.id, tipo: tipo === 'ajuste' ? 'ajuste' : tipo, cantidad: tipo === 'ajuste' ? delta : cant, saldo, usuario_id: S.usuario.id, nota: $('#m-nota', h).value.trim() || (tipo === 'ajuste' ? `conteo: de ${actual} a ${saldo}` : null) })
    prod.stock = saldo
    toast(`${prod.nombre}: existencia ${saldo}`); cerrarHoja(); pintar()
  }
}
