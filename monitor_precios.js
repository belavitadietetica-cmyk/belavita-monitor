// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Agente de monitoreo de precios
// Usa Puppeteer (navegador real) para evitar bloqueos
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;

// ═══════════════════════════════════════════════════════
// PRODUCTOS A MONITOREAR
// ═══════════════════════════════════════════════════════
const PRODUCTOS_SEMBRADOR = [
  { nombre_db: 'Almendras Non Pareil',          slug: 'almendra-non-pareil-27-30-importada' },
  { nombre_db: 'Nuez Mariposa',                 slug: 'nuez-mariposa-extra-light' },
  { nombre_db: 'Chía',                          slug: 'chia-semilla-importada-aa' },
  { nombre_db: 'Harina de Coco',                slug: 'harina-de-coco-organica' },
  { nombre_db: 'Harina de Arroz',               slug: 'harina-de-arroz-fino' },
  { nombre_db: 'Psyllium',                      slug: 'psyllium-semilla-de-platago' },
  { nombre_db: 'Quinoa Nacional',               slug: 'quinoa-nacional-extra' },
  { nombre_db: 'Lino Marrón',                   slug: 'semilla-de-lino-marron' },
  { nombre_db: 'Girasol',                       slug: 'semilla-girasol-pelado-aa' },
  { nombre_db: 'Sésamo Blanco',                 slug: 'sesamo-blanco-natural-aa' },
  { nombre_db: 'Manzanilla',                    slug: 'manzanilla-flor' },
  { nombre_db: 'Pasas Negras Jumbo',            slug: 'pasa-uva-morocha-flame' },
  { nombre_db: 'Harina Integral',               slug: 'harina-integral-fina' },
  { nombre_db: 'Amaranto',                      slug: 'amaranto-en-grano' },
  { nombre_db: 'Mijo Pelado',                   slug: 'mijo-pelado' },
  { nombre_db: 'Harina de Soja',                slug: 'harina-de-soja-desgrasada' },
  { nombre_db: 'Harina de Centeno',             slug: 'harina-de-centeno' },
  { nombre_db: 'Harina de Arveja',              slug: 'harina-de-arveja' },
  { nombre_db: 'Pasas Rubias',                  slug: 'pasa-uva-rubia-thompson' },
  { nombre_db: 'Arándanos',                     slug: 'arandano-rojo-deshidratado' },
  { nombre_db: 'Maní Tostado Con Sal',          slug: 'mani-tostado-con-sal' },
  { nombre_db: 'Maní Tostado Sin Sal',          slug: 'mani-tostado-sin-sal' },
  { nombre_db: 'Sésamo Integral',               slug: 'sesamo-integral' },
  { nombre_db: 'Sésamo Negro',                  slug: 'sesamo-negro' },
  { nombre_db: 'Cus Cus',                       slug: 'cus-cus-semola-de-trigo' },
  { nombre_db: 'Amaranto',                      slug: 'amaranto-en-grano' },
  { nombre_db: 'Apio (Semillas)',               slug: 'semilla-de-apio' },
  { nombre_db: 'Hinojo (Semillas)',             slug: 'semilla-de-hinojo' },
];

const PRODUCTOS_MOLY = [
  { nombre_db: 'Mix Clásico',                   path: '/producto/mix-clasico/' },
  { nombre_db: 'Mix Tropical',                  path: '/producto/mix-tropical/' },
  { nombre_db: 'Mix Premium (Mix Patagónico)',   path: '/producto/mix-patagonico/' },
  { nombre_db: 'Mix Sin Pasas',                 path: '/producto/mix-sin-pasas/' },
  { nombre_db: 'Mix Cervecero',                 path: '/producto/mix-cervecero/' },
  { nombre_db: 'Maní Crudo',                    path: '/producto/mani-crudo/' },
  { nombre_db: 'Amapola',                       path: '/producto/semilla-de-amapola/' },
  { nombre_db: 'Harina de Algarroba',           path: '/producto/harina-de-algarroba/' },
  { nombre_db: 'Harina de Chía',                path: '/producto/harina-de-chia/' },
  { nombre_db: 'Harina de Avena',               path: '/producto/harina-de-avena/' },
  { nombre_db: 'Chips Banana',                  path: '/producto/chips-de-banana/' },
  { nombre_db: 'Harina Integral',               path: '/producto/harina-integral/' },
];

const PRODUCTOS_BERNAL = [
  { nombre_db: 'Dátiles Sin Carozo',            buscar: 'DATIL' },
  { nombre_db: 'Zapallo (Semillas)',             buscar: 'SEMILLA DE ZAPALLO' },
  { nombre_db: 'Pistachos Con Cáscara',         buscar: 'PISTACHO' },
  { nombre_db: 'Avellanas Peladas',             buscar: 'AVELLANA PELADA' },
  { nombre_db: 'Pasas Rubias',                  buscar: 'PASA RUBIA' },
  { nombre_db: 'Arándanos',                     buscar: 'ARANDANO' },
];

// ═══════════════════════════════════════════════════════
// EXTRAER PRECIO DEL HTML DE WOOCOMMERCE
// ═══════════════════════════════════════════════════════
function extraerPrecioWoo(html) {
  // Precio de oferta (dentro de <ins>)
  let m = html.match(/<ins[\s\S]*?woocommerce-Price-amount[\s\S]*?<bdi>([\d.,\s]+)<\/bdi>/i);
  if (m) {
    const p = parseFloat(m[1].replace(/\./g,'').replace(',','.').replace(/\s/g,''));
    if (p > 100) return p;
  }
  // Precio normal
  m = html.match(/woocommerce-Price-amount amount[^>]*>[^<]*<bdi>([\d.,\s]+)<\/bdi>/i);
  if (m) {
    const p = parseFloat(m[1].replace(/\./g,'').replace(',','.').replace(/\s/g,''));
    if (p > 100) return p;
  }
  // JSON-LD
  m = html.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (m) {
    const p = parseFloat(m[1]);
    if (p > 100) return p;
  }
  // Formato $X.-
  const matches = [...html.matchAll(/\$\s*([\d.,]+)\.-/g)];
  for (const match of matches) {
    const p = parseFloat(match[1].replace(/\./g,'').replace(',','.'));
    if (p > 100 && p < 10000000) return p;
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// GUARDAR PRECIO Y GENERAR ALERTA
// ═══════════════════════════════════════════════════════
async function procesarPrecio(prod, proveedor_id, precio_nuevo) {
  if (!precio_nuevo || !prod?.id) return;

  const { data: ultimo } = await sb.schema('ops').from('precios_historico')
    .select('precio_sin_iva').eq('producto_id', prod.id).eq('proveedor_id', proveedor_id)
    .order('fecha_registro', { ascending: false }).limit(1).maybeSingle();

  const precio_anterior = ultimo?.precio_sin_iva || null;

  await sb.schema('ops').from('precios_historico').insert({
    producto_id: prod.id, proveedor_id, precio_sin_iva: precio_nuevo,
    fuente: 'agente', ahorro_vs_anterior: precio_anterior ? precio_anterior - precio_nuevo : 0,
  });

  if (!precio_anterior) {
    console.log(`  ✓ ${prod.nombre}: $${Math.round(precio_nuevo).toLocaleString('es-AR')} (primer registro)`);
    return;
  }

  const pct = ((precio_nuevo - precio_anterior) / precio_anterior) * 100;
  if (Math.abs(pct) < 1) {
    console.log(`  = ${prod.nombre}: $${Math.round(precio_nuevo).toLocaleString('es-AR')} (sin cambio)`);
    return;
  }

  const sube = precio_nuevo > precio_anterior;
  const msg = `${sube?'📈':'📉'} ${prod.nombre} ${sube?'subió':'bajó'} ${Math.abs(pct).toFixed(1)}% — de $${Math.round(precio_anterior).toLocaleString('es-AR')} a $${Math.round(precio_nuevo).toLocaleString('es-AR')}`;
  console.log(`  ${msg}`);

  if (Math.abs(pct) >= 3) {
    await sb.schema('ops').from('alertas').insert({
      producto_id: prod.id, tipo: sube?'precio_aumento':'proveedor_mejor', mensaje: msg,
      datos: { precio_anterior, precio_nuevo, variacion_pct: pct.toFixed(1) },
    });
  }
}

// ═══════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════
async function monitorear() {
  console.log(`\n🔍 BELAVITA OPS · Monitoreo de precios`);
  console.log(`📅 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`);
  console.log('═'.repeat(55));

  // Cargar proveedores y productos de Supabase
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
  let browser = null;

  try {
    // Iniciar Puppeteer
    console.log('\n🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });

    // ── EL SEMBRADOR · LOGIN ──
    console.log('\n📦 EL SEMBRADOR · Iniciando sesión...');
    try {
      await page.goto('https://el-sembrador.com.ar/mi-cuenta/', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.type('#username', SEMBRADOR_USER, { delay: 50 });
      await page.type('#password', SEMBRADOR_PASS, { delay: 50 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
        page.click('[name="login"]'),
      ]);
      const url = page.url();
      if (url.includes('mi-cuenta') && !url.includes('login')) {
        console.log('  ✓ Login exitoso');
      } else {
        console.log('  ⚠ Login puede no haber funcionado');
      }
    } catch(e) {
      console.log('  ⚠ Error en login:', e.message);
    }

    // Scrape productos El Sembrador
    for (const item of PRODUCTOS_SEMBRADOR) {
      const prod = findProd(item.nombre_db);
      if (!prod) continue;
      try {
        const url = `https://el-sembrador.com.ar/producto/${item.slug}/`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const html = await page.content();
        const precio = extraerPrecioWoo(html);
        if (precio) {
          await procesarPrecio(prod, provMap['El Sembrador'], precio);
          revisados++;
        } else {
          console.log(`  ⚠ ${item.nombre_db} → precio no encontrado`);
        }
      } catch(e) {
        console.log(`  ⚠ ${item.nombre_db} → error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 800));
    }

    // ── MOLY MARKET ──
    console.log('\n📦 MOLY MARKET');
    for (const item of PRODUCTOS_MOLY) {
      const prod = findProd(item.nombre_db);
      if (!prod) continue;
      try {
        await page.goto(`https://www.molymarket.com.ar${item.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const html = await page.content();
        const precio = extraerPrecioWoo(html);
        if (precio) {
          await procesarPrecio(prod, provMap['Moly Market'], precio);
          revisados++;
        } else {
          console.log(`  ⚠ ${item.nombre_db} → precio no encontrado`);
        }
      } catch(e) {
        console.log(`  ⚠ ${item.nombre_db} → error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 800));
    }

    // ── BERNAL ──
    console.log('\n📦 BERNAL');
    try {
      await page.goto('https://gglobal.net.ar/bernal/?cliente', { waitUntil: 'domcontentloaded', timeout: 20000 });
      const html = await page.content();
      console.log(`  ✓ Página cargada (${html.length} chars)`);

      for (const item of PRODUCTOS_BERNAL) {
        const prod = findProd(item.nombre_db);
        if (!prod) continue;
        const idx = html.toUpperCase().indexOf(item.buscar.toUpperCase());
        if (idx === -1) { console.log(`  ? ${item.nombre_db} → no encontrado`); continue; }
        const frag = html.substring(idx, idx + 500);
        const m = frag.match(/\$\s*([\d.,]+)/);
        if (m) {
          const precio = parseFloat(m[1].replace(/\./g,'').replace(',','.'));
          if (precio > 100) { await procesarPrecio(prod, provMap['Bernal'], precio); revisados++; }
        }
      }
    } catch(e) {
      console.log('  ⚠ Error Bernal:', e.message);
    }

  } finally {
    if (browser) await browser.close();
  }

  // Registrar ejecución
  await sb.schema('ops').from('monitoreo_precios').insert({
    proveedor_id: provMap['El Sembrador'],
    productos_revisados: revisados,
    alerta_generada: revisados > 0,
    fecha_ejecucion: new Date().toISOString(),
  });

  console.log(`\n✅ Monitoreo completado · ${revisados} productos revisados`);
  console.log('═'.repeat(55));
}

module.exports = { monitorear };
if (require.main === module) monitorear().catch(console.error);
