// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Agente de análisis de precios
// PRUEBA: solo Almendras Non Pareil
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;

// Delay helper
const delay = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// LANZAR BROWSER
// ═══════════════════════════════════════════════════════
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,900'],
  });
}

// ═══════════════════════════════════════════════════════
// EL SEMBRADOR · Login + precios almendras
// ═══════════════════════════════════════════════════════
async function scrapeSembrador(page) {
  console.log('\n📦 EL SEMBRADOR');
  const resultado = { proveedor: 'El Sembrador', productos: [], error: null };

  try {
    // LOGIN
    console.log('  🔐 Logueando...');
    await page.goto('https://el-sembrador.com.ar/mi-cuenta/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Esperar el form de login
    await page.waitForSelector('#user_login', { timeout: 10000 });
    await page.click('#user_login', { clickCount: 3 });
    await page.type('#user_login', SEMBRADOR_USER, { delay: 60 });
    await page.click('#user_pass', { clickCount: 3 });
    await page.type('#user_pass', SEMBRADOR_PASS, { delay: 60 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('#wp-submit'),
    ]);
    const urlPost = page.url();
    const logueado = urlPost.includes('mi-cuenta') && !urlPost.includes('login');
    console.log(logueado ? '  ✓ Login OK' : `  ⚠ Login incierto: ${urlPost}`);
    await delay(1500);

    // ALMENDRA NON PAREIL IMPORTADA (la que compramos)
    console.log('  → Almendra Non Pareil 27-30 Importada...');
    await page.goto('https://el-sembrador.com.ar/producto/almendra-non-pareil-27-30-importada/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1500);
    
    const datosAlmendra = await page.evaluate(() => {
      // Precio de oferta (en <ins>) vs precio normal (en <del>)
      const precioOferta = document.querySelector('ins .woocommerce-Price-amount bdi, ins .amount bdi');
      const precioNormal = document.querySelector('del .woocommerce-Price-amount bdi, del .amount bdi');
      const precioSimple = document.querySelector('.woocommerce-Price-amount bdi, p.price .amount');
      
      const limpiar = t => t ? parseFloat(t.innerText.replace(/[^0-9,]/g,'').replace(',','.')) : null;
      
      const oferta = limpiar(precioOferta);
      const normal = limpiar(precioNormal);
      const simple = limpiar(precioSimple);
      
      // Buscar texto de descuento por cantidad
      const bodyTxt = document.body.innerText;
      const descuentoMatch = bodyTxt.match(/10%\s*de\s*descuento|descuento.*cantidad|MONTO.MÍNIMO/i);
      
      return {
        nombre: 'Almendra Non Pareil 27-30 Importada',
        precio_oferta: oferta,
        precio_normal: normal || simple,
        precio_efectivo: oferta || simple,
        tiene_oferta: !!oferta,
        descuento_cantidad: !!descuentoMatch,
        nota_cantidad: descuentoMatch ? descuentoMatch[0] : null,
        url: window.location.href,
      };
    });

    console.log(`  ✓ Precio: $${datosAlmendra.precio_efectivo?.toLocaleString('es-AR') || '—'} ${datosAlmendra.tiene_oferta ? '(EN OFERTA)' : ''}`);
    resultado.productos.push(datosAlmendra);

    // ALMENDRA NON PAREIL MEDIANA NACIONAL (alternativa)
    console.log('  → Almendra Non Pareil Mediana Nacional...');
    await page.goto('https://el-sembrador.com.ar/producto/almendra-non-pareil-mediana-nacional/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1500);

    const datosNacional = await page.evaluate(() => {
      const precioOferta = document.querySelector('ins .woocommerce-Price-amount bdi');
      const precioSimple = document.querySelector('.woocommerce-Price-amount bdi');
      const limpiar = t => t ? parseFloat(t.innerText.replace(/[^0-9,]/g,'').replace(',','.')) : null;
      const oferta = limpiar(precioOferta);
      const simple = limpiar(precioSimple);
      
      // Buscar variaciones de precio por kg (select de peso)
      const opciones = [];
      document.querySelectorAll('select option, .variable-item').forEach(el => {
        const txt = el.innerText || el.textContent;
        if (txt && (txt.includes('kg') || txt.includes('g ('))) {
          opciones.push(txt.trim());
        }
      });

      return {
        nombre: 'Almendra Non Pareil Mediana Nacional',
        precio_oferta: oferta,
        precio_efectivo: oferta || simple,
        tiene_oferta: !!oferta,
        opciones_peso: opciones,
        url: window.location.href,
        hay_stock: !document.body.innerText.includes('sin existencias') && !document.body.innerText.includes('Agotado'),
      };
    });

    console.log(`  ✓ Nacional: $${datosNacional.precio_efectivo?.toLocaleString('es-AR') || 'Sin stock'} · Stock: ${datosNacional.hay_stock ? 'Sí' : 'No'}`);
    if (datosNacional.opciones_peso.length > 0) console.log(`    Opciones: ${datosNacional.opciones_peso.join(' | ')}`);
    resultado.productos.push(datosNacional);

    // Precio por 10kg en El Sembrador (10% descuento por monto)
    // El sembrador da 10% si comprás $150.000+, para almendras eso equivale a ~8-9kg
    const precio1kg = datosAlmendra.precio_efectivo;
    if (precio1kg) {
      resultado.precio_10kg = precio1kg * 10 * 0.90; // con 10% descuento
      resultado.precio_por_kg_10kg = precio1kg * 0.90;
      console.log(`  📊 Precio estimado 10kg (con 10% dto): $${resultado.precio_10kg.toLocaleString('es-AR')} → $${resultado.precio_por_kg_10kg.toLocaleString('es-AR')}/kg`);
    }

  } catch(e) {
    resultado.error = e.message;
    console.log('  ❌ Error:', e.message);
  }

  return resultado;
}

// ═══════════════════════════════════════════════════════
// MOLY MARKET · Precios almendras
// ═══════════════════════════════════════════════════════
async function scrapeMoly(page) {
  console.log('\n📦 MOLY MARKET');
  const resultado = { proveedor: 'Moly Market', productos: [], error: null };

  try {
    // Moly tiene variaciones por peso en la misma página de producto
    await page.goto('https://www.molymarket.com.ar/producto/almendra-non-pareil/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(1500);

    const datos = await page.evaluate(() => {
      const limpiar = t => t ? parseFloat(t.innerText.replace(/[^0-9,]/g,'').replace(',','.')) : null;
      const precio = document.querySelector('ins .woocommerce-Price-amount bdi, .woocommerce-Price-amount bdi');
      const sinStock = document.body.innerText.includes('sin existencias') || document.body.innerText.includes('Agotado') || document.body.innerText.includes('agotado');
      
      // Buscar variaciones de precio por peso en el texto de la página
      const variaciones = [];
      document.querySelectorAll('table.variations td, .woocommerce-variation-price, option').forEach(el => {
        const t = el.innerText || el.textContent;
        if (t && (t.includes('$') || t.includes('kg'))) variaciones.push(t.trim());
      });

      return {
        nombre: 'Almendra Non Pareil',
        precio_efectivo: limpiar(precio),
        sin_stock: sinStock,
        variaciones,
        url: window.location.href,
      };
    });

    if (datos.sin_stock) {
      console.log('  ⚠ Sin stock de Almendra Non Pareil en Moly Market');
      datos.nota = 'SIN STOCK';
    } else {
      console.log(`  ✓ Precio: $${datos.precio_efectivo?.toLocaleString('es-AR') || '—'}`);
    }
    resultado.productos.push(datos);

    // Buscar almendra mediana como alternativa
    await page.goto('https://www.molymarket.com.ar/producto/almendra-mediana/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await delay(1000);
    const datosAlt = await page.evaluate(() => {
      const limpiar = t => t ? parseFloat(t.innerText.replace(/[^0-9,]/g,'').replace(',','.')) : null;
      const precio = document.querySelector('ins .woocommerce-Price-amount bdi, .woocommerce-Price-amount bdi');
      const sinStock = document.body.innerText.includes('sin existencias') || document.body.innerText.includes('Agotado');
      return {
        nombre: 'Almendra Mediana (alternativa)',
        precio_efectivo: limpiar(precio),
        sin_stock: sinStock,
        url: window.location.href,
      };
    });
    if (page.url().includes('almendra-mediana')) {
      resultado.productos.push(datosAlt);
      console.log(`  ✓ Mediana alternativa: $${datosAlt.precio_efectivo?.toLocaleString('es-AR') || '—'} ${datosAlt.sin_stock ? '(sin stock)' : ''}`);
    }

  } catch(e) {
    resultado.error = e.message;
    console.log('  ❌ Error:', e.message);
  }

  return resultado;
}

// ═══════════════════════════════════════════════════════
// BERNAL · Precios almendras (solo 1kg y 10kg, no 500g)
// ═══════════════════════════════════════════════════════
async function scrapeBernal(page) {
  console.log('\n📦 BERNAL');
  const resultado = { proveedor: 'Bernal', productos: [], error: null };

  try {
    // Bernal tiene buscador — usar URL con búsqueda
    await page.goto('https://gglobal.net.ar/bernal/?cliente&buscar=almendra', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(2000);

    const productos = await page.evaluate(() => {
      const items = [];
      // Buscar todos los elementos que contengan "almendra" y un precio
      const textos = document.querySelectorAll('*');
      const vistos = new Set();
      
      textos.forEach(el => {
        const txt = (el.innerText || '').trim();
        if (!txt.toLowerCase().includes('almendra')) return;
        if (txt.length > 200) return; // saltar contenedores grandes
        if (vistos.has(txt)) return;
        
        // Buscar precio en el texto del elemento o sus hermanos
        const pMatch = txt.match(/\$\s*([\d.,]+)/);
        if (!pMatch) return;
        
        const precio = parseFloat(pMatch[1].replace(/\./g,'').replace(',','.'));
        if (precio < 1000) return; // filtrar precios de 100g/500g pequeños
        
        // Excluir si dice 500g, 100g
        if (txt.includes('500') && txt.includes('g') && !txt.includes('kg')) return;
        if (txt.includes('100') && txt.includes('g') && !txt.includes('kg')) return;
        
        vistos.add(txt);
        
        // Calcular precio por kg
        let precio_por_kg = precio;
        let unidad = '1kg';
        if (txt.includes('10') && txt.includes('K')) { precio_por_kg = precio / 10; unidad = '10kg'; }
        else if (txt.includes('5') && txt.includes('K')) { precio_por_kg = precio / 5; unidad = '5kg'; }
        
        items.push({ nombre: txt.substring(0, 80), precio_total: precio, precio_por_kg, unidad });
      });
      
      return items.slice(0, 8); // máximo 8 resultados
    });

    if (productos.length === 0) {
      console.log('  ⚠ No se encontraron almendras en Bernal');
    } else {
      productos.forEach(p => {
        console.log(`  ✓ ${p.nombre} → $${p.precio_total.toLocaleString('es-AR')} (${p.unidad}) · $${Math.round(p.precio_por_kg).toLocaleString('es-AR')}/kg`);
      });
    }
    resultado.productos = productos;

  } catch(e) {
    resultado.error = e.message;
    console.log('  ❌ Error:', e.message);
  }

  return resultado;
}

// ═══════════════════════════════════════════════════════
// GENERAR RECOMENDACIÓN PARA LUCAS
// ═══════════════════════════════════════════════════════
async function generarRecomendacion(sembrador, moly, bernal, ultimoPrecio) {
  console.log('\n🧠 Generando recomendación...');

  const opciones = [];

  // El Sembrador
  const precioSemb = sembrador.precio_por_kg_10kg || sembrador.productos[0]?.precio_efectivo;
  if (precioSemb) {
    opciones.push({
      proveedor: 'El Sembrador',
      precio_kg: precioSemb,
      ventajas: ['Factura A incluida', '30 días de pago', sembrador.precio_10kg ? `10kg = $${Math.round(sembrador.precio_10kg).toLocaleString('es-AR')} (10% dto)` : ''],
      precio_display: sembrador.precio_10kg
        ? `$${Math.round(sembrador.precio_10kg).toLocaleString('es-AR')} por 10kg ($${Math.round(precioSemb).toLocaleString('es-AR')}/kg con dto)`
        : `$${Math.round(precioSemb).toLocaleString('es-AR')}/kg`,
    });
  }

  // Moly Market
  const prodMoly = moly.productos.find(p => !p.sin_stock && p.precio_efectivo);
  if (prodMoly) {
    const precioMoly = prodMoly.precio_efectivo;
    opciones.push({
      proveedor: 'Moly Market',
      precio_kg: precioMoly,
      ventajas: ['Precio sin IVA', '14 días pago', prodMoly.nombre !== 'Almendra Non Pareil' ? '⚠ Es alternativa, no Non Pareil' : ''],
      precio_display: `$${Math.round(precioMoly).toLocaleString('es-AR')}/kg`,
      advertencia: prodMoly.nota === 'SIN STOCK' ? 'SIN STOCK Non Pareil' : null,
    });
  } else if (moly.productos.length > 0) {
    opciones.push({ proveedor: 'Moly Market', precio_kg: null, advertencia: 'SIN STOCK de Almendra Non Pareil' });
  }

  // Bernal (mejor precio por kg entre los de 1kg o 10kg)
  const mejorBernal = bernal.productos
    .filter(p => p.precio_por_kg > 0)
    .sort((a,b) => a.precio_por_kg - b.precio_por_kg)[0];
  if (mejorBernal) {
    opciones.push({
      proveedor: 'Bernal',
      precio_kg: mejorBernal.precio_por_kg,
      ventajas: [`${mejorBernal.unidad}: $${mejorBernal.precio_total.toLocaleString('es-AR')} total`, 'Sin factura A (+8% si la pedís)'],
      precio_display: `$${Math.round(mejorBernal.precio_por_kg).toLocaleString('es-AR')}/kg (${mejorBernal.unidad})`,
    });
  }

  // Elegir mejor opción por precio/kg
  const conPrecio = opciones.filter(o => o.precio_kg);
  conPrecio.sort((a,b) => a.precio_kg - b.precio_kg);
  const mejor = conPrecio[0];

  // Calcular variación vs último precio
  let varMsg = '';
  if (ultimoPrecio && mejor?.precio_kg) {
    const var_pct = ((mejor.precio_kg - ultimoPrecio) / ultimoPrecio) * 100;
    if (Math.abs(var_pct) >= 1) {
      varMsg = var_pct > 0
        ? `📈 Subió ${var_pct.toFixed(1)}% vs última compra ($${Math.round(ultimoPrecio).toLocaleString('es-AR')}/kg)`
        : `📉 Bajó ${Math.abs(var_pct).toFixed(1)}% vs última compra ($${Math.round(ultimoPrecio).toLocaleString('es-AR')}/kg)`;
    } else {
      varMsg = `= Precio estable vs última compra ($${Math.round(ultimoPrecio).toLocaleString('es-AR')}/kg)`;
    }
  }

  // Armar mensaje final para Lucas
  let recomendacion = `🌰 ANÁLISIS ALMENDRAS NON PAREIL\n\n`;
  
  opciones.forEach(o => {
    if (o.advertencia) {
      recomendacion += `❌ ${o.proveedor}: ${o.advertencia}\n`;
    } else {
      recomendacion += `• ${o.proveedor}: ${o.precio_display}\n`;
      o.ventajas?.filter(v=>v).forEach(v => recomendacion += `  → ${v}\n`);
    }
    recomendacion += '\n';
  });

  if (mejor) {
    recomendacion += `✅ RECOMENDACIÓN: Comprar en ${mejor.proveedor}\n`;
    recomendacion += `   Precio: ${mejor.precio_display}\n`;
    if (mejor.proveedor === 'El Sembrador') recomendacion += `   → Factura A incluida + mejor precio con descuento por cantidad\n`;
    if (mejor.proveedor === 'Bernal') recomendacion += `   → Más barato pero sin factura A. Pedirla suma +8%\n`;
    if (mejor.proveedor === 'Moly Market') recomendacion += `   → Sin factura A incluida (+10.5% si la pedís)\n`;
  }

  if (varMsg) recomendacion += `\n${varMsg}`;

  return recomendacion;
}

// ═══════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════
async function monitorear() {
  console.log(`\n🔍 BELAVITA OPS · Análisis de precios · ALMENDRAS`);
  console.log(`📅 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`);
  console.log('═'.repeat(55));

  // Cargar datos de Supabase
  const { data: provs } = await sb.schema('ops').from('proveedores').select('id, nombre');
  const provMap = {};
  provs?.forEach(p => { provMap[p.nombre] = p.id; });

  const { data: prod } = await sb.schema('ops').from('productos')
    .select('id, nombre').ilike('nombre', '%almendra%').limit(1).maybeSingle();

  // Último precio de almendras en El Sembrador
  let ultimoPrecio = null;
  if (prod?.id) {
    const { data: ult } = await sb.schema('ops').from('precios_historico')
      .select('precio_sin_iva').eq('producto_id', prod.id)
      .order('fecha_registro', { ascending: false }).limit(1).maybeSingle();
    ultimoPrecio = ult?.precio_sin_iva;
    if (ultimoPrecio) console.log(`\n💾 Último precio en DB: $${Math.round(ultimoPrecio).toLocaleString('es-AR')}/kg`);
  }

  let browser = null;
  let sembrador = { proveedor: 'El Sembrador', productos: [], error: 'no ejecutado' };
  let moly = { proveedor: 'Moly Market', productos: [], error: 'no ejecutado' };
  let bernal = { proveedor: 'Bernal', productos: [], error: 'no ejecutado' };

  try {
    console.log('\n🌐 Iniciando navegador...');
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });

    sembrador = await scrapeSembrador(page);
    await delay(1000);
    moly = await scrapeMoly(page);
    await delay(1000);
    bernal = await scrapeBernal(page);

  } catch(e) {
    console.error('❌ Error general:', e.message);
  } finally {
    if (browser) await browser.close();
  }

  // Generar recomendación
  const recomendacion = await generarRecomendacion(sembrador, moly, bernal, ultimoPrecio);
  console.log('\n' + recomendacion);

  // Guardar precio más relevante (El Sembrador 1kg) en DB
  if (prod?.id && sembrador.productos[0]?.precio_efectivo) {
    await sb.schema('ops').from('precios_historico').insert({
      producto_id: prod.id,
      proveedor_id: provMap['El Sembrador'],
      precio_sin_iva: sembrador.productos[0].precio_efectivo,
      fuente: 'agente',
      ahorro_vs_anterior: ultimoPrecio ? ultimoPrecio - sembrador.productos[0].precio_efectivo : 0,
    });
  }

  // Guardar recomendación como alerta para Lucas
  if (prod?.id) {
    await sb.schema('ops').from('alertas').insert({
      producto_id: prod.id,
      tipo: 'analisis_proveedor',
      mensaje: recomendacion,
      datos: {
        sembrador: sembrador.productos,
        moly: moly.productos,
        bernal: bernal.productos,
        mejor_precio: sembrador.precio_por_kg_10kg || sembrador.productos[0]?.precio_efectivo,
        fecha: new Date().toISOString(),
      },
    });
  }

  // Registrar ejecución
  await sb.schema('ops').from('monitoreo_precios').insert({
    proveedor_id: provMap['El Sembrador'],
    productos_revisados: 1,
    alerta_generada: true,
    fecha_ejecucion: new Date().toISOString(),
  });

  console.log('\n✅ Análisis completado');
  console.log('═'.repeat(55));
}

module.exports = { monitorear };
if (require.main === module) monitorear().catch(console.error);
