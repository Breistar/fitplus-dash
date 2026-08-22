/* Catálogo (administración): precios de lista, mayoreo, quiebres por cantidad, mínimos y altas. */
import { sb, S, $, $$, esc, dinero, toast, hoja, cabHoja, cerrarHoja, cargarBase } from './nucleo.js'

let cont, q = ''

export async function render (c) {
  cont = c
  cont.innerHTML = `
  <div class="cabecera"><div><h1>Catálogo</h1><p>Precios y reglas que el punto de venta aplica solo. Cambiar aquí cambia para todas las asesoras al instante.</p></div>
    <div class="acciones-cab"><button class="btn btn-p" id="cat-nuevo">Nuevo producto</button></div></div>
  ${S.config.mayoreo_placeholder === 'true' ? '<p class="error" style="margin-bottom:12px">Los precios de mayoreo cargados son provisionales (85% de lista) y los quiebres de los cafés son un ejemplo. Sustitúyelos por las reglas reales y desactiva este aviso en configuración.</p>' : ''}
  <div class="tarjeta">
    <input id="cat-q" type="search" placeholder="Producto, SKU o categoría" value="${esc(q)}">
    <div class="tabla-env" style="margin-top:12px"><table><thead><tr><th>Producto</th><th>SKU</th><th>Categoría</th><th class="der">Menudeo</th><th class="der">Mayoreo</th><th>Quiebres</th><th class="der">Mínimo</th><th>Estado</th></tr></thead><tbody id="cat-tbody"></tbody></table></div>
  </div>`
  $('#cat-q').oninput = e => { q = e.target.value; pintar() }
  $('#cat-nuevo').onclick = () => ficha(null)
  pintar()
}
function pintar () {
  const qq = q.trim().toLowerCase()
  const lista = S.productos.filter(p => !qq || p.nombre.toLowerCase().includes(qq) || (p.sku || '').toLowerCase().includes(qq) || (p.categoria || '').toLowerCase().includes(qq))
  $('#cat-tbody').innerHTML = lista.map(p => `<tr class="clic" data-id="${p.id}">
    <td><b>${esc(p.nombre)}</b></td><td class="mono suave">${esc(p.sku || '')}</td><td>${esc(p.categoria || '')}</td>
    <td class="der num">${dinero(p.precio_menudeo)}</td><td class="der num">${p.precio_mayoreo != null ? dinero(p.precio_mayoreo) : '—'}</td>
    <td class="chico">${(S.reglas[p.id] || []).sort((a, b) => a.cantidad_min - b.cantidad_min).map(r => `${r.cantidad_min}+ ${dinero(r.precio)}`).join(' · ') || '<span class="suave">—</span>'}</td>
    <td class="der num">${Number(p.stock_min)}</td><td>${p.activo ? '<span class="tag medio">activo</span>' : '<span class="tag tenue">inactivo</span>'}${p.woo_id ? '' : ' <span class="tag tenue">sin web</span>'}</td></tr>`).join('')
  $('#cat-tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) ficha(S.productos.find(p => p.id === Number(tr.dataset.id))) }
}

function ficha (p) {
  const nuevo = !p
  const reglas = (nuevo ? [] : (S.reglas[p.id] || [])).sort((a, b) => a.cantidad_min - b.cantidad_min)
  const cats = [...new Set(S.productos.map(x => x.categoria).filter(Boolean))].sort()
  const h = hoja(cabHoja(nuevo ? 'Nuevo producto' : esc(p.nombre)) + `
    <div class="campos c2">
      <label style="grid-column:1/-1">Nombre<input id="p-nombre" value="${esc(p?.nombre || '')}"></label>
      <label>SKU<input id="p-sku" value="${esc(p?.sku || '')}"></label>
      <label>Categoría<input id="p-cat" list="p-cats" value="${esc(p?.categoria || '')}"><datalist id="p-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label>Precio menudeo<input id="p-menudeo" type="number" min="0" step="1" value="${esc(p?.precio_menudeo ?? '')}"></label>
      <label>Precio mayoreo<input id="p-mayoreo" type="number" min="0" step="1" value="${esc(p?.precio_mayoreo ?? '')}" placeholder="vacío = usa menudeo"></label>
      <label>Costo (opcional)<input id="p-costo" type="number" min="0" step="1" value="${esc(p?.costo ?? '')}"></label>
      <label>Existencia mínima<input id="p-min" type="number" min="0" step="1" value="${esc(p?.stock_min ?? 5)}"></label>
      <label>Imagen (URL)<input id="p-img" value="${esc(p?.imagen || '')}"></label>
      <label>Estado<select id="p-activo"><option value="true" ${p?.activo !== false ? 'selected' : ''}>Activo · se vende</option><option value="false" ${p?.activo === false ? 'selected' : ''}>Inactivo · oculto en venta</option></select></label>
    </div>
    <div class="fila" style="margin-top:12px"><button class="btn btn-p" id="p-guardar">${nuevo ? 'Crear producto' : 'Guardar'}</button></div>
    <p id="p-error" class="error" hidden></p>
    ${nuevo ? '' : `<h3>Quiebres por cantidad</h3>
    <p class="chico suave">“A partir de N piezas, precio X”. Se aplica solo en el punto de venta según el tipo de clienta.</p>
    <div id="p-reglas" class="lista" style="margin-top:8px">${reglas.map(r => `<div class="item" style="padding:8px 12px"><div class="cab"><span>${r.tipo_cliente} · desde <b>${r.cantidad_min}</b> pzas → <b class="num">${dinero(r.precio)}</b>${r.nota ? `<span class="chico suave"> · ${esc(r.nota)}</span>` : ''}</span><button class="btn btn-chico btn-fantasma" data-borrar="${r.id}">Quitar</button></div></div>`).join('') || '<p class="vacio">Sin quiebres.</p>'}</div>
    <div class="fila" style="margin-top:10px">
      <select id="r-tipo"><option value="mayorista">Mayorista</option><option value="minorista">Minorista</option></select>
      <input id="r-cant" type="number" min="2" step="1" placeholder="Desde N pzas">
      <input id="r-precio" type="number" min="0" step="1" placeholder="Precio">
      <button class="btn fijo" id="r-agregar">Agregar</button>
    </div>`}`)
  $('#p-guardar', h).onclick = async () => {
    const err = $('#p-error', h); err.hidden = true
    const f = { nombre: $('#p-nombre', h).value.trim(), sku: $('#p-sku', h).value.trim() || null, categoria: $('#p-cat', h).value.trim() || null,
      precio_menudeo: Number($('#p-menudeo', h).value) || 0, precio_mayoreo: $('#p-mayoreo', h).value === '' ? null : Number($('#p-mayoreo', h).value),
      costo: $('#p-costo', h).value === '' ? null : Number($('#p-costo', h).value), stock_min: Number($('#p-min', h).value) || 0,
      imagen: $('#p-img', h).value.trim() || null, activo: $('#p-activo', h).value === 'true', actualizado: new Date().toISOString() }
    if (!f.nombre) { err.textContent = 'El nombre es obligatorio.'; err.hidden = false; return }
    const r = nuevo ? await sb.from('pos_productos').insert(f) : await sb.from('pos_productos').update(f).eq('id', p.id)
    if (r.error) { err.textContent = r.error.message; err.hidden = false; return }
    toast('Producto guardado'); cerrarHoja(); await cargarBase(); pintar()
  }
  $('#r-agregar', h)?.addEventListener('click', async () => {
    const cant = Number($('#r-cant', h).value), precio = Number($('#r-precio', h).value)
    if (!(cant >= 2) || !(precio > 0)) return toast('Captura cantidad (≥2) y precio')
    const { error } = await sb.from('pos_reglas_precio').upsert({ producto_id: p.id, tipo_cliente: $('#r-tipo', h).value, cantidad_min: cant, precio, nota: null, activa: true }, { onConflict: 'producto_id,tipo_cliente,cantidad_min' })
    if (error) return toast(error.message)
    await cargarBase(); toast('Quiebre agregado'); ficha(S.productos.find(x => x.id === p.id))
  })
  $('#p-reglas', h)?.addEventListener('click', async e => {
    const b = e.target.closest('[data-borrar]'); if (!b) return
    await sb.from('pos_reglas_precio').delete().eq('id', Number(b.dataset.borrar))
    await cargarBase(); toast('Quiebre eliminado'); ficha(S.productos.find(x => x.id === p.id))
  })
}
