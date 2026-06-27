const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;

const PRODUCTOS_SEMBRADOR = [
  { nombre_db: 'Almendras Non Pareil',         slug: 'almendra-non-pareil-27-30-importada' },
  { nombre_db: 'Nuez Mariposa',                slug: 'nuez-mariposa-extra-light' },
  { nombre_db: 'Chía',                         slug: 'chia-semilla-importada-aa' },
  { nombre_db: 'Harina de Coco',               slug: 'harina-de-coco-organica' },
  { nombre_db: 'Harina de Arroz',              slug: 'harina-de-arroz-fino' },
  { nombre_db: 'Psyllium',                     slug: 'psyllium-semilla-de-platago' },
  { nombre_db: 'Quinoa Nacional',              slug: 'quinoa-nacional-extra' },
  { nombre_db: 'Lino Marrón',                  slug: 'semilla-de-lino-marron' },
  { nombre_db: 'Girasol',                      slug: 'semilla-girasol-pelado-aa' },
  { nombre_db: 'Sésamo Blanco',                slug: 'sesamo-blanco-natural-aa' },
  { nombre_db: 'Manzanilla',                   slug: 'manzanilla-flor' },
  { nombre_db: 'Pasas Negras Jumbo',           slug: 'pasa-uva-morocha-flame' },
  { nombre_db: 'Harina Integral',              slug: 'harina-integral-fina' },
  { nombre_db: 'Amaranto',                     slug: 'amaranto-en-grano' },
  { nombre_db: 'Mijo Pelado',                  slug: 'mijo-pelado' },
  { nombre_db: 'Harina de Soja',               slug: 'harina-de-soja-desgrasada' },
  { nombre_db: 'Harina de Centeno',            slug: 'harina-de-centeno' },
  { nombre_db: 'Harina de Arveja',             slug: 'harina-de-arveja' },
  { nombre_db: 'Pasas Rubias',                 slug: 'pasa-uva-rubia-thompson' },
  { nombre_db: 'Maní Tostado Con Sal',         slug: 'mani-tostado-con-sal' },
  { nombre_db: 'Sésamo Integral',              slug: 'sesamo-integral' },
  { nombre_db: 'Sésamo Negro',                 slug: 'sesamo-negro' },
  { nombre_db: 'Cus Cus',                      slug: 'cus-cus-semola-de-trigo' },
  { nombre_db: 'Apio (Semillas)',              slug: 'semilla-de-apio' },
];

const PRODUCTOS_MOLY = [
  { nombre_db: 'Mix Clásico',                  path: '/producto/mix-clasico/' },
  { nombre_db: 'Mix Tropical',                 path: '/producto/mix-tropical/' },
  { nombre_db: 'Mix Premium (Mix Patagónico)', path: '/producto/mix-patagonico/' },
  { nombre_db: 'Mix Sin Pasas',                path: '/producto/mix-sin-pasas/' },
  { nombre_db: 'Mix Cervecero',                path: '/producto/mix-cervecero/' },
  { nombre_db: 'Maní Crudo',                   path: '/producto/mani-crudo/' },
  { nombre_db: 'Amapola',                      path: '/producto/semilla-de-amapola/' },
  { nombre_db: 'Harina de Algarroba',          path: '/producto/harina-de-algarroba/' },
  { nombre_db: 'Harina de Chía',               path: '/producto/harina-de-chia/' },
  { nombre_db: 'Harina de Avena',              path: '/producto/harina-de-avena/' },
  { nombre_db: 'Chips Banana',                 path: '/producto/chips-de-banana/' },
  { nombre_db: 'Harina Integral',              path: '/producto/harina-integral/' },
];

const PRODUCTOS_BERNAL = [
  { nombre_db: 'Dátiles Sin Carozo',           buscar: 'Datil' },
  { nombre_db: 'Zapallo (Semillas)',            buscar: 'Zapallo' },
  { nombre_db: 'Pistachos Con Cáscara',        buscar: 'Pistacho' },
  { nombre_db: 'Avellanas Peladas',            buscar: 'Avellana Pelada' },
  { nombre_db: 'Pasas Rubias',                 buscar: 'Pasa Rubia' },
  { nombre_db: 'Arándanos',                    buscar: 'Arandano' },
];

// Extraer precio del HTML renderizado por Puppeteer
async function extraerPrecioWoo(page) {
  try {
    // Intentar múltiples selectores en orden
    const selectores = [
      'ins .woocommerce-Price-amount bdi',     // precio oferta
      '.woocommerce-Price-amount bdi',          // precio normal
      'p.price .amount bdi',
      '.price ins .amount',
      '.price .amount',
    ];
    for (const sel of selectores) {
      const texto = await page.$eval(sel, el => el.innerText).catch(() => null);
      if (texto) {
        const limpio = texto.replace(/[^0-9,.]/g, '').replace(/\./g,'').replace(',','.');
        const precio = parseFloat(limpio);
        if (precio > 100 && precio < 10000000) return precio;
      }
    }
    // Fallback: buscar en el HTML
    const html = await page.content();
    const m = html.match(/\$\s*([\d.]+)\.-/);
    if (m) {
      const p = parseFloat(m[1].replace(/\./g,''));
      if (p > 100) return p;
    }
    return null;
  } catch(e) { return null; }
}

// Extraer precio de la página de Bernal buscando por nombre de producto
async function extraerPrecioBernal(page, buscar) {
  try {
    const precio = await page.evaluate((buscar) => {
      // Buscar el texto del producto en la página
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const txt = node.textContent.trim().toUpperCase();
        if (txt.includes(buscar.toUpperCase())) {
          // Buscar precio en los 500 chars siguientes del HTML
          let el = node.parentElement;
          for (let i = 0; i < 8; i++) {
            if (!el) break;
            const html = el.outerHTML || '';
            const m = html.match(/\$\s*([\d.,]+)/);
            if (m) {
              const p = parseFloat(m[1].replace(/\./g,'').replace(',','.'));
              if (p > 100) return p;
            }
            el = el.nextElementSibling || el.parentElement;
          }
        }
      }
      return null;
    }, buscar);
    return precio;
  } catch(e) { return null; }
}

async function procesarPrecio(prod, proveedor_id, precio_nuevo) {
  if (!precio_nuevo || !prod?.id) return false;
  const { data: ultimo } = await sb.schema('ops').from('precios_historico')
    .select('precio_sin_iva').eq('producto_id', prod.id).eq('proveedor_id', proveedor_id)
    .order('fecha_registro', { ascending: false }).limit(1).maybeSingle();
  const precio_anterior = ultimo?.precio_sin_iva || null;
  await sb.schema('ops').from('precios_historico').insert({
    producto_id: prod.id, proveedor_id, precio_sin_iva: precio_nuevo,
    fuente: 'agente', ahorro_vs_anterior: precio_anterior ? precio_anterior - precio_nuevo : 0,
  });
  if (!precio_anterior) {
    console.log(`  ✓ ${prod.nombre}: $${Math.round(precio_nuevo).toLocaleString('es-AR')} (primer precio)`);
    return true;
  }
  const pct = ((precio_nuevo - precio_anterior) / precio_anterior) * 100;
  if (Math.abs(pct) < 1) {
    console.log(`  = ${prod.nombre}: $${Math.round(precio_nuevo).toLocaleString('es-AR')} (sin cambio)`);
    return true;
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
  return true;
}

async function monitorear() {
  console.log(`\n🔍 BELAVITA OPS · Monitoreo de precios`);
  console.log(`📅 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`);
  console.log('═'.repeat(55));

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
    console.log('\n🌐 Iniciando navegador Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });

    // ── EL SEMBRADOR · LOGIN ──
    console.log('\n📦 EL SEMBRADOR');
    try {
      await page.goto('https://el-sembrador.com.ar/mi-cuenta/', { waitUntil: 'networkidle2', timeout: 30000 });
      
      // WordPress usa #user_login (no #username)
      await page.waitForSelector('#user_login', { timeout: 10000 });
      await page.type('#user_login', SEMBRADOR_USER, { delay: 60 });
      await page.type('#user_pass', SEMBRADOR_PASS, { delay: 60 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
        page.click('#wp-submit'),
      ]);
      const urlActual = page.url();
      const logueado = !urlActual.includes('login') && urlActual.includes('mi-cuenta');
      console.log(logueado ? '  ✓ Login exitoso' : `  ⚠ Login dudoso: ${urlActual}`);
    } catch(e) {
      console.log('  ⚠ Error login:', e.message);
    }

    // Scrape El Sembrador
    for (const item of PRODUCTOS_SEMBRADOR) {
      const prod = findProd(item.nombre_db);
      if (!prod) { console.log(`  ? ${item.nombre_db} → no en DB`); continue; }
      try {
        await page.goto(`https://el-sembrador.com.ar/producto/${item.slug}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));
        const precio = await extraerPrecioWoo(page);
        if (precio) { await procesarPrecio(prod, provMap['El Sembrador'], precio); revisados++; }
        else console.log(`  ⚠ ${item.nombre_db} → precio no detectado`);
      } catch(e) { console.log(`  ⚠ ${item.nombre_db} → ${e.message}`); }
      await new Promise(r => setTimeout(r, 800));
    }

    // ── MOLY MARKET ──
    console.log('\n📦 MOLY MARKET');
    for (const item of PRODUCTOS_MOLY) {
      const prod = findProd(item.nombre_db);
      if (!prod) continue;
      try {
        await page.goto(`https://www.molymarket.com.ar${item.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));
        const precio = await extraerPrecioWoo(page);
        if (precio) { await procesarPrecio(prod, provMap['Moly Market'], precio); revisados++; }
        else console.log(`  ⚠ ${item.nombre_db} → precio no detectado`);
      } catch(e) { console.log(`  ⚠ ${item.nombre_db} → ${e.message}`); }
      await new Promise(r => setTimeout(r, 800));
    }

    // ── BERNAL ──
    console.log('\n📦 BERNAL');
    try {
      await page.goto('https://gglobal.net.ar/bernal/?cliente', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      console.log('  ✓ Página cargada');
      for (const item of PRODUCTOS_BERNAL) {
        const prod = findProd(item.nombre_db);
        if (!prod) continue;
        const precio = await extraerPrecioBernal(page, item.buscar);
        if (precio) { await procesarPrecio(prod, provMap['Bernal'], precio); revisados++; }
        else console.log(`  ⚠ ${item.nombre_db} → no encontrado`);
      }
    } catch(e) { console.log('  ⚠ Error Bernal:', e.message); }

  } finally {
    if (browser) await browser.close();
  }

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
