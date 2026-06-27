// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Agente de monitoreo de precios
// El Sembrador (con login), Moly Market, Bernal
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;

// ═══════════════════════════════════════════════════════
// PRODUCTOS A MONITOREAR
// ═══════════════════════════════════════════════════════
const PRODUCTOS_SEMBRADOR = [
  { nombre_db: 'Almendras Non Pareil',   slug: 'almendra-non-pareil-27-30-importada' },
  { nombre_db: 'Nuez Mariposa',          slug: 'nuez-mariposa-extra-light' },
  { nombre_db: 'Chía',                   slug: 'chia-semilla-importada-aa' },
  { nombre_db: 'Harina de Coco',         slug: 'harina-de-coco-organica' },
  { nombre_db: 'Harina de Arroz',        slug: 'harina-de-arroz-fino' },
  { nombre_db: 'Psyllium',               slug: 'psyllium-semilla-de-platago' },
  { nombre_db: 'Quinoa Nacional',        slug: 'quinoa-nacional-extra' },
  { nombre_db: 'Lino Marrón',            slug: 'semilla-de-lino-marron' },
  { nombre_db: 'Girasol',               slug: 'semilla-girasol-pelado-aa' },
  { nombre_db: 'Sésamo Blanco',          slug: 'sesamo-blanco-natural-aa' },
  { nombre_db: 'Manzanilla',             slug: 'manzanilla-flor' },
  { nombre_db: 'Pasas Negras Jumbo',     slug: 'pasa-uva-morocha-flame' },
  { nombre_db: 'Harina Integral',        slug: 'harina-integral-fina' },
  { nombre_db: 'Amaranto',              slug: 'amaranto-en-grano' },
  { nombre_db: 'Mijo Pelado',           slug: 'mijo-pelado' },
  { nombre_db: 'Harina de Soja',        slug: 'harina-de-soja-desgrasada' },
  { nombre_db: 'Harina de Centeno',     slug: 'harina-de-centeno' },
  { nombre_db: 'Harina de Arveja',      slug: 'harina-de-arveja' },
];

const PRODUCTOS_MOLY = [
  { nombre_db: 'Mix Clásico',                  url: 'https://www.molymarket.com.ar/producto/mix-clasico/' },
  { nombre_db: 'Mix Tropical',                 url: 'https://www.molymarket.com.ar/producto/mix-tropical/' },
  { nombre_db: 'Mix Premium (Mix Patagónico)', url: 'https://www.molymarket.com.ar/producto/mix-patagonico/' },
  { nombre_db: 'Mix Sin Pasas',                url: 'https://www.molymarket.com.ar/producto/mix-sin-pasas/' },
  { nombre_db: 'Mix Cervecero',                url: 'https://www.molymarket.com.ar/producto/mix-cervecero/' },
  { nombre_db: 'Maní Crudo',                   url: 'https://www.molymarket.com.ar/producto/mani-crudo/' },
  { nombre_db: 'Amapola',                      url: 'https://www.molymarket.com.ar/producto/semilla-de-amapola/' },
  { nombre_db: 'Harina de Algarroba',          url: 'https://www.molymarket.com.ar/producto/harina-de-algarroba/' },
  { nombre_db: 'Harina de Chía',               url: 'https://www.molymarket.com.ar/producto/harina-de-chia/' },
  { nombre_db: 'Harina de Avena',              url: 'https://www.molymarket.com.ar/producto/harina-de-avena/' },
  { nombre_db: 'Chips Banana',                 url: 'https://www.molymarket.com.ar/producto/chips-de-banana/' },
];

const PRODUCTOS_BERNAL = [
  { nombre_db: 'Dátiles Sin Carozo',      buscar: 'DATIL' },
  { nombre_db: 'Zapallo (Semillas)',       buscar: 'ZAPALLO' },
  { nombre_db: 'Pistachos Con Cáscara',   buscar: 'PISTACHO' },
  { nombre_db: 'Avellanas Peladas',        buscar: 'AVELLANA' },
  { nombre_db: 'Pasas Rubias',             buscar: 'PASA RUBIA' },
  { nombre_db: 'Arándanos',               buscar: 'ARANDANO' },
];

// ═══════════════════════════════════════════════════════
// LOGIN EN EL SEMBRADOR (WooCommerce)
// ═══════════════════════════════════════════════════════
async function loginSembrador() {
  console.log('  🔐 Iniciando login en El Sembrador...');
  try {
    // 1. Obtener nonce de la página de login
    const loginPage = await fetch('https://el-sembrador.com.ar/mi-cuenta/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000)
    });
    const loginHtml = await loginPage.text();

    // Extraer nonce de WooCommerce
    const nonceMatch = loginHtml.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/);
    const nonce = nonceMatch ? nonceMatch[1] : '';

    // 2. Hacer POST de login
    const formData = new URLSearchParams({
      username: SEMBRADOR_USER,
      password: SEMBRADOR_PASS,
      'woocommerce-login-nonce': nonce,
      _wp_http_referer: '/mi-cuenta/',
      login: 'Acceder',
    });

    const loginRes = await fetch('https://el-sembrador.com.ar/mi-cuenta/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://el-sembrador.com.ar/mi-cuenta/',
      },
      body: formData.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });

    // Obtener cookies de sesión
    const cookies = loginRes.headers.get('set-cookie') || '';
    const cookieHeader = cookies.split(',').map(c => c.split(';')[0]).join('; ');

    if (cookieHeader && cookieHeader.includes('wordpress_logged_in')) {
      console.log('  ✓ Login exitoso en El Sembrador');
    } else {
      console.log('  ⚠ Login puede no haber funcionado — continuando igual');
    }
    return cookieHeader;
  } catch(e) {
    console.error('  ⚠ Error en login:', e.message);
    return '';
  }
}

// ═══════════════════════════════════════════════════════
// FETCH PRECIO DE PRODUCTO WOOCOMMERCE
// ═══════════════════════════════════════════════════════
async function fetchPrecioWoo(url, cookies = '') {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(cookies ? { 'Cookie': cookies } : {}),
      },
      signal: AbortSignal.timeout(15000)
    });
    const html = await res.text();

    // Buscar precio en WooCommerce — primero precio de oferta, luego precio normal
    // Formato: <ins><span class="woocommerce-Price-amount">$ 18.495.-</span></ins>
    const patterns = [
      /<ins[^>]*>[\s\S]*?woocommerce-Price-amount[^>]*>([\d.,\s]+)<\/bdi>/i,
      /woocommerce-Price-amount amount"[^>]*>.*?\$([\d.,\s]+)/i,
      /"price"\s*:\s*"([\d.]+)"/,
      /\$\s*([\d.,]+)\.-/,
    ];

    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) {
        const raw = m[1].replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
        const precio = parseFloat(raw);
        if (precio > 100 && precio < 10000000) return precio;
      }
    }

    // Buscar en JSON-LD (datos estructurados)
    const jsonMatch = html.match(/"offers"[\s\S]*?"price"\s*:\s*"?([\d.]+)"?/);
    if (jsonMatch) {
      const precio = parseFloat(jsonMatch[1]);
      if (precio > 100) return precio;
    }

    return null;
  } catch(e) {
    console.error(`  ⚠ Error fetching ${url}:`, e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// PROCESAR Y GUARDAR PRECIO
// ═══════════════════════════════════════════════════════
async function procesarPrecio(producto, proveedor_id, precio_nuevo) {
  if (!precio_nuevo || !producto?.id) return;

  // Obtener último precio guardado
  const { data: ultimo } = await sb.schema('ops').from('precios_historico')
    .select('precio_sin_iva, fecha_registro')
    .eq('producto_id', producto.id)
    .eq('proveedor_id', proveedor_id)
    .order('fecha_registro', { ascending: false })
    .limit(1).maybeSingle();

  const precio_anterior = ultimo?.precio_sin_iva || null;
  const ahorro = precio_anterior ? precio_anterior - precio_nuevo : 0;

  // Guardar nuevo precio
  await sb.schema('ops').from('precios_historico').insert({
    producto_id: producto.id,
    proveedor_id,
    precio_sin_iva: precio_nuevo,
    fuente: 'agente',
    ahorro_vs_anterior: ahorro,
  });

  if (!precio_anterior) {
    console.log(`  ✓ ${producto.nombre}: $${precio_nuevo.toLocaleString('es-AR')} (primer registro)`);
    return;
  }

  const variacion_pct = ((precio_nuevo - precio_anterior) / precio_anterior) * 100;

  if (Math.abs(variacion_pct) < 1) {
    console.log(`  = ${producto.nombre}: $${precio_nuevo.toLocaleString('es-AR')} (sin cambio)`);
    return;
  }

  const sube = precio_nuevo > precio_anterior;
  const icon = sube ? '📈' : '📉';
  const tipo = sube ? 'precio_aumento' : 'proveedor_mejor';
  const mensaje = `${icon} ${producto.nombre} ${sube ? 'subió' : 'bajó'} ${Math.abs(variacion_pct).toFixed(1)}% — de $${Math.round(precio_anterior).toLocaleString('es-AR')} a $${Math.round(precio_nuevo).toLocaleString('es-AR')}`;

  console.log(`  ${mensaje}`);

  // Generar alerta si variación > 3%
  if (Math.abs(variacion_pct) >= 3) {
    await sb.schema('ops').from('alertas').insert({
      producto_id: producto.id,
      tipo,
      mensaje,
      datos: { precio_anterior, precio_nuevo, variacion_pct: variacion_pct.toFixed(1) },
    });
  }
}

// ═══════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL EXPORTABLE
// ═══════════════════════════════════════════════════════
async function monitorear() {
  console.log(`\n🔍 BELAVITA OPS · Monitoreo de precios`);
  console.log(`📅 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`);
  console.log('═'.repeat(55));

  // Cargar IDs de proveedores y productos
  const { data: provs } = await sb.schema('ops').from('proveedores').select('id, nombre');
  const provMap = {};
  provs?.forEach(p => { provMap[p.nombre] = p.id; });

  const { data: prods } = await sb.schema('ops').from('productos').select('id, nombre').eq('activo', true);
  const prodMap = {};
  prods?.forEach(p => { prodMap[p.nombre.toLowerCase()] = p; });

  function findProd(nombre) {
    const key = nombre.toLowerCase();
    if (prodMap[key]) return prodMap[key];
    for (const [k, v] of Object.entries(prodMap)) {
      if (k.includes(key.split(' ')[0]) || key.includes(k.split(' ')[0])) return v;
    }
    return null;
  }

  let revisados = 0;

  // ── EL SEMBRADOR (con login) ──
  console.log('\n📦 EL SEMBRADOR');
  const cookies = await loginSembrador();
  await new Promise(r => setTimeout(r, 2000));

  for (const item of PRODUCTOS_SEMBRADOR) {
    const prod = findProd(item.nombre_db);
    if (!prod) { console.log(`  ? ${item.nombre_db} → no encontrado en DB`); continue; }
    const url = `https://el-sembrador.com.ar/producto/${item.slug}/`;
    const precio = await fetchPrecioWoo(url, cookies);
    if (precio) {
      await procesarPrecio(prod, provMap['El Sembrador'], precio);
      revisados++;
    } else {
      console.log(`  ⚠ ${item.nombre_db} → precio no detectado`);
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  // ── MOLY MARKET ──
  console.log('\n📦 MOLY MARKET');
  for (const item of PRODUCTOS_MOLY) {
    const prod = findProd(item.nombre_db);
    if (!prod) { console.log(`  ? ${item.nombre_db} → no encontrado en DB`); continue; }
    const precio = await fetchPrecioWoo(item.url);
    if (precio) {
      await procesarPrecio(prod, provMap['Moly Market'], precio);
      revisados++;
    } else {
      console.log(`  ⚠ ${item.nombre_db} → precio no detectado`);
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  // ── BERNAL ──
  console.log('\n📦 BERNAL');
  let bernalHtml = null;
  try {
    const res = await fetch('https://gglobal.net.ar/bernal/?cliente', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(20000)
    });
    bernalHtml = await res.text();
    console.log('  ✓ Página de Bernal cargada');
  } catch(e) {
    console.log('  ⚠ No se pudo cargar Bernal:', e.message);
  }

  if (bernalHtml) {
    for (const item of PRODUCTOS_BERNAL) {
      const prod = findProd(item.nombre_db);
      if (!prod) continue;
      const idx = bernalHtml.toUpperCase().indexOf(item.buscar.toUpperCase());
      if (idx === -1) { console.log(`  ? ${item.nombre_db} → no encontrado en página`); continue; }
      const frag = bernalHtml.substring(idx, idx + 400);
      const m = frag.match(/\$\s*([\d.,]+)/);
      if (m) {
        const precio = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        if (precio > 100) {
          await procesarPrecio(prod, provMap['Bernal'], precio);
          revisados++;
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Registrar ejecución
  await sb.schema('ops').from('monitoreo_precios').insert({
    proveedor_id: provMap['El Sembrador'],
    productos_revisados: revisados,
    alerta_generada: true,
    fecha_ejecucion: new Date().toISOString(),
  });

  console.log(`\n✅ Monitoreo completado · ${revisados} productos revisados`);
  console.log('═'.repeat(55));
}

module.exports = { monitorear };

// Si se ejecuta directamente
if (require.main === module) {
  monitorear().catch(console.error);
}
