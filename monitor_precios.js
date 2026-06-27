// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Agente de monitoreo de precios
// Corre todos los lunes a las 8am en Railway
// Scraper: El Sembrador, Moly Market, Bernal
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(SB_URL, SB_KEY);

// ═══════════════════════════════════════════════════════
// MAPA DE PRODUCTOS POR PROVEEDOR
// URL de la página de cada producto en la tienda online
// ═══════════════════════════════════════════════════════
const PRODUCTOS_SEMBRADOR = [
  { nombre_db: 'Almendras Non Pareil',        url: 'https://el-sembrador.com.ar/producto/almendra-non-pareil-27-30-importada/' },
  { nombre_db: 'Nuez Mariposa',               url: 'https://el-sembrador.com.ar/producto/nuez-mariposa-extra-light/' },
  { nombre_db: 'Chía',                        url: 'https://el-sembrador.com.ar/producto/chia-semilla-importada-aa/' },
  { nombre_db: 'Harina de Coco',              url: 'https://el-sembrador.com.ar/producto/harina-de-coco-organica/' },
  { nombre_db: 'Harina de Arroz',             url: 'https://el-sembrador.com.ar/producto/harina-de-arroz-fino/' },
  { nombre_db: 'Psyllium',                    url: 'https://el-sembrador.com.ar/producto/psyllium-semilla-de-platago/' },
  { nombre_db: 'Quinoa Nacional',             url: 'https://el-sembrador.com.ar/producto/quinoa-nacional-extra/' },
  { nombre_db: 'Lino Marrón',                 url: 'https://el-sembrador.com.ar/producto/semilla-de-lino-marron/' },
  { nombre_db: 'Girasol',                     url: 'https://el-sembrador.com.ar/producto/semilla-girasol-pelado-aa/' },
  { nombre_db: 'Sésamo Blanco',               url: 'https://el-sembrador.com.ar/producto/sesamo-blanco-natural-aa/' },
  { nombre_db: 'Manzanilla',                  url: 'https://el-sembrador.com.ar/producto/manzanilla-flor/' },
  { nombre_db: 'Pasas Negras Jumbo',          url: 'https://el-sembrador.com.ar/producto/pasa-uva-morocha-flame/' },
  { nombre_db: 'Harina Integral',             url: 'https://el-sembrador.com.ar/producto/harina-integral-fina/' },
  { nombre_db: 'Amaranto',                    url: 'https://el-sembrador.com.ar/producto/amaranto-en-grano/' },
  { nombre_db: 'Harina de Arveja',            url: 'https://el-sembrador.com.ar/producto/harina-de-arveja/' },
  { nombre_db: 'Mijo Pelado',                 url: 'https://el-sembrador.com.ar/producto/mijo-pelado/' },
  { nombre_db: 'Harina de Soja',              url: 'https://el-sembrador.com.ar/producto/harina-de-soja-desgrasada/' },
  { nombre_db: 'Harina de Centeno',           url: 'https://el-sembrador.com.ar/producto/harina-de-centeno/' },
];

const PRODUCTOS_MOLY = [
  { nombre_db: 'Mix Clásico',                 url: 'https://www.molymarket.com.ar/producto/mix-clasico/' },
  { nombre_db: 'Mix Tropical',                url: 'https://www.molymarket.com.ar/producto/mix-tropical/' },
  { nombre_db: 'Mix Premium (Mix Patagónico)',url: 'https://www.molymarket.com.ar/producto/mix-patagonico/' },
  { nombre_db: 'Mix Sin Pasas',               url: 'https://www.molymarket.com.ar/producto/mix-sin-pasas/' },
  { nombre_db: 'Mix Cervecero',               url: 'https://www.molymarket.com.ar/producto/mix-cervecero/' },
  { nombre_db: 'Maní Crudo',                  url: 'https://www.molymarket.com.ar/producto/mani-crudo/' },
  { nombre_db: 'Amapola',                     url: 'https://www.molymarket.com.ar/producto/semilla-de-amapola/' },
  { nombre_db: 'Harina de Algarroba',         url: 'https://www.molymarket.com.ar/producto/harina-de-algarroba/' },
  { nombre_db: 'Harina de Chía',              url: 'https://www.molymarket.com.ar/producto/harina-de-chia/' },
  { nombre_db: 'Harina de Avena',             url: 'https://www.molymarket.com.ar/producto/harina-de-avena/' },
  { nombre_db: 'Harina Integral',             url: 'https://www.molymarket.com.ar/producto/harina-integral/' },
  { nombre_db: 'Chips Banana',                url: 'https://www.molymarket.com.ar/producto/chips-de-banana/' },
];

const PRODUCTOS_BERNAL = [
  { nombre_db: 'Dátiles Sin Carozo',          url: 'https://gglobal.net.ar/bernal/?cliente', buscar: 'DATIL' },
  { nombre_db: 'Zapallo (Semillas)',           url: 'https://gglobal.net.ar/bernal/?cliente', buscar: 'ZAPALLO' },
  { nombre_db: 'Pistachos Con Cáscara',       url: 'https://gglobal.net.ar/bernal/?cliente', buscar: 'PISTACHO' },
  { nombre_db: 'Avellanas Peladas',           url: 'https://gglobal.net.ar/bernal/?cliente', buscar: 'AVELLANA' },
];

// ═══════════════════════════════════════════════════════
// SCRAPER: extrae precio de una página de producto
// ═══════════════════════════════════════════════════════
async function fetchPrecio(url, buscar = null) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BelavitaOps/1.0)' },
      signal: AbortSignal.timeout(15000)
    });
    const html = await res.text();

    // WooCommerce: buscar precio en formato estándar
    // <p class="price"><span class="woocommerce-Price-amount amount">$&nbsp;18.495.-</span>
    const patterns = [
      /class="woocommerce-Price-amount amount"[^>]*>\$[^0-9]*([\d.,]+)/gi,
      /"price"\s*:\s*"([\d.,]+)"/g,
      /Precio:\s*\$\s*([\d.,]+)/gi,
      /\$\s*([\d.,]+)\.-/g,
    ];

    // Si hay palabra clave buscar cerca de ella
    if (buscar) {
      const idx = html.toUpperCase().indexOf(buscar.toUpperCase());
      if (idx === -1) return null;
      const fragmento = html.substring(idx, idx + 500);
      const m = fragmento.match(/\$\s*([\d.,]+)/);
      if (m) {
        const raw = m[1].replace(/\./g, '').replace(',', '.');
        return parseFloat(raw);
      }
      return null;
    }

    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        // Tomar el primer precio encontrado (precio de oferta si existe)
        const raw = matches[0][1].replace(/\./g, '').replace(',', '.');
        const precio = parseFloat(raw);
        if (precio > 100) return precio; // sanity check
      }
    }
    return null;
  } catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// OBTENER ÚLTIMO PRECIO GUARDADO EN SUPABASE
// ═══════════════════════════════════════════════════════
async function getUltimoPrecio(producto_id, proveedor_id) {
  const { data } = await sb.schema('ops').from('precios_historico')
    .select('precio_sin_iva, fecha_registro')
    .eq('producto_id', producto_id)
    .eq('proveedor_id', proveedor_id)
    .order('fecha_registro', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.precio_sin_iva || null;
}

// ═══════════════════════════════════════════════════════
// GUARDAR NUEVO PRECIO Y GENERAR ALERTA SI HAY CAMBIO
// ═══════════════════════════════════════════════════════
async function procesarPrecio(producto, proveedor_id, precio_nuevo) {
  if (!precio_nuevo || !producto.id) return;

  const precio_anterior = await getUltimoPrecio(producto.id, proveedor_id);

  // Siempre registrar el precio nuevo
  await sb.schema('ops').from('precios_historico').insert({
    producto_id: producto.id,
    proveedor_id,
    precio_sin_iva: precio_nuevo,
    fuente: 'agente',
    ahorro_vs_anterior: precio_anterior ? precio_anterior - precio_nuevo : 0,
  });

  if (!precio_anterior) {
    console.log(`  ✓ ${producto.nombre} → $${precio_nuevo.toLocaleString('es-AR')} (primer registro)`);
    return;
  }

  const variacion_pct = ((precio_nuevo - precio_anterior) / precio_anterior) * 100;
  const variacion_abs = Math.abs(variacion_pct);

  if (variacion_abs < 1) {
    console.log(`  = ${producto.nombre} → $${precio_nuevo.toLocaleString('es-AR')} (sin cambio)`);
    return;
  }

  const subio = precio_nuevo > precio_anterior;
  const emoji = subio ? '📈' : '📉';
  const tipo = subio ? 'precio_aumento' : 'proveedor_mejor';
  const mensaje = subio
    ? `${emoji} ${producto.nombre} subió ${variacion_pct.toFixed(1)}% — de $${precio_anterior.toLocaleString('es-AR')} a $${precio_nuevo.toLocaleString('es-AR')}`
    : `${emoji} ${producto.nombre} bajó ${Math.abs(variacion_pct).toFixed(1)}% — de $${precio_anterior.toLocaleString('es-AR')} a $${precio_nuevo.toLocaleString('es-AR')}`;

  console.log(`  ${mensaje}`);

  // Solo generar alerta si la variación es mayor al 3%
  if (variacion_abs >= 3) {
    await sb.schema('ops').from('alertas').insert({
      producto_id: producto.id,
      tipo,
      mensaje,
      datos: { precio_anterior, precio_nuevo, variacion_pct: variacion_pct.toFixed(1) },
    });
  }
}

// ═══════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════
async function monitorear() {
  console.log(`\n🔍 BELAVITA OPS · Monitoreo de precios · ${new Date().toLocaleString('es-AR')}`);
  console.log('═'.repeat(60));

  // Cargar IDs de proveedores
  const { data: provs } = await sb.schema('ops').from('proveedores').select('id, nombre');
  const provMap = {};
  provs?.forEach(p => { provMap[p.nombre] = p.id; });

  const sembId = provMap['El Sembrador'];
  const molyId = provMap['Moly Market'];
  const bernalId = provMap['Bernal'];

  // Cargar productos de la DB
  const { data: prods } = await sb.schema('ops').from('productos').select('id, nombre').eq('activo', true);
  const prodMap = {};
  prods?.forEach(p => { prodMap[p.nombre.toLowerCase()] = p; });

  function findProd(nombre) {
    const key = nombre.toLowerCase();
    // Búsqueda exacta
    if (prodMap[key]) return prodMap[key];
    // Búsqueda parcial
    for (const [k, v] of Object.entries(prodMap)) {
      if (k.includes(key) || key.includes(k)) return v;
    }
    return null;
  }

  // ── EL SEMBRADOR ──
  console.log('\n📦 El Sembrador');
  for (const item of PRODUCTOS_SEMBRADOR) {
    const prod = findProd(item.nombre_db);
    if (!prod) { console.log(`  ? ${item.nombre_db} → no encontrado en DB`); continue; }
    const precio = await fetchPrecio(item.url);
    if (precio) await procesarPrecio(prod, sembId, precio);
    else console.log(`  ⚠ ${item.nombre_db} → no se pudo leer el precio`);
    await new Promise(r => setTimeout(r, 800)); // delay para no saturar
  }

  // ── MOLY MARKET ──
  console.log('\n📦 Moly Market');
  for (const item of PRODUCTOS_MOLY) {
    const prod = findProd(item.nombre_db);
    if (!prod) { console.log(`  ? ${item.nombre_db} → no encontrado en DB`); continue; }
    const precio = await fetchPrecio(item.url);
    if (precio) await procesarPrecio(prod, molyId, precio);
    else console.log(`  ⚠ ${item.nombre_db} → no se pudo leer el precio`);
    await new Promise(r => setTimeout(r, 800));
  }

  // ── BERNAL ──
  console.log('\n📦 Bernal');
  // Bernal es una sola página con todos los productos
  let bernalHtml = null;
  try {
    const res = await fetch('https://gglobal.net.ar/bernal/?cliente', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BelavitaOps/1.0)' },
      signal: AbortSignal.timeout(15000)
    });
    bernalHtml = await res.text();
  } catch(e) { console.log('  ⚠ No se pudo cargar la página de Bernal'); }

  if (bernalHtml) {
    for (const item of PRODUCTOS_BERNAL) {
      const prod = findProd(item.nombre_db);
      if (!prod) continue;
      const idx = bernalHtml.toUpperCase().indexOf(item.buscar.toUpperCase());
      if (idx === -1) { console.log(`  ? ${item.nombre_db} → no encontrado en página`); continue; }
      const frag = bernalHtml.substring(idx, idx + 300);
      const m = frag.match(/\$\s*([\d.,]+)/);
      if (m) {
        const precio = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        if (precio > 100) await procesarPrecio(prod, bernalId, precio);
      }
    }
  }

  // ── REGISTRO DE EJECUCIÓN ──
  await sb.schema('ops').from('monitoreo_precios').insert({
    proveedor_id: sembId,
    productos_revisados: PRODUCTOS_SEMBRADOR.length + PRODUCTOS_MOLY.length + PRODUCTOS_BERNAL.length,
    alerta_generada: true,
  });

  console.log('\n✅ Monitoreo completado');
}

// Ejecutar
monitorear().catch(console.error);
