// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Agente de monitoreo de precios
// Versión liviana - una sola instancia de página
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;

const delay = ms => new Promise(r => setTimeout(r, ms));

const BUSQUEDAS = [
  { buscar: 'almendra', nombre_db: 'Almendras Non Pareil', enfocar: ['NON PAREIL'], cantidad_kg: 10 },
  { buscar: 'nuez',     nombre_db: 'Nuez Mariposa',        enfocar: ['MARIPOSA EXTRA LIGHT', 'MARIPOSA LIGHT', 'CUARTO LIGHT', 'CUARTO EXTRA LIGHT'], cantidad_kg: 10 },
  { buscar: 'chia',     nombre_db: 'Chía',                 enfocar: ['CHIA AA', 'SEMILLA CHIA'], cantidad_kg: 25 },
  { buscar: 'harina+coco', nombre_db: 'Harina de Coco',   enfocar: ['HARINA COCO', 'HARINA DE COCO'], cantidad_kg: 10 },
  { buscar: 'psyllium', nombre_db: 'Psyllium',             enfocar: ['PSYLLIUM'], cantidad_kg: 10 },
  { buscar: 'manzanilla', nombre_db: 'Manzanilla',         enfocar: ['MANZANILLA'], cantidad_kg: 2 },
];

async function monitorear() {
  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
  console.log(`\n🔍 BELAVITA OPS · Monitoreo de precios`);
  console.log(`📅 ${ahora}`);
  console.log('═'.repeat(55));

  // Cargar datos de Supabase
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
      if (k.includes(key.split(' ')[0])) return v;
    }
    return null;
  }

  const lineasReporte = [];
  const fecha = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza', weekday: 'long', day: 'numeric', month: 'long' });
  lineasReporte.push(`📊 ANÁLISIS EL SEMBRADOR · ${fecha}`);
  lineasReporte.push('');

  let browser = null;
  let page = null;

  try {
    console.log('\n🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--disable-extensions', '--disable-background-networking',
        '--no-first-run', '--single-process', '--memory-pressure-off',
        '--js-flags=--max-old-space-size=512',
      ],
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Bloquear imágenes y fuentes para ahorrar memoria
    await page.setRequestInterception(true);
    page.on('request', req => {
      const tipo = req.resourceType();
      // Solo bloquear imágenes y fuentes, permitir scripts para que carguen los productos
      if (['image', 'font', 'media'].includes(tipo)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // ── LOGIN ──
    console.log('\n📦 EL SEMBRADOR');
    console.log('  🔐 Logueando...');
    await page.goto('https://el-sembrador.com.ar/mi-cuenta/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await delay(2000);

    const loginOk = await page.evaluate((user, pass) => {
      const forms = Array.from(document.querySelectorAll('form'));
      let loginForm = null;
      for (const form of forms) {
        const btns = form.querySelectorAll('button, input[type="submit"]');
        for (const btn of btns) {
          const txt = (btn.value || btn.innerText || btn.textContent || '').toLowerCase();
          if (txt.includes('acced') || txt.includes('ingresar')) { loginForm = form; break; }
        }
        if (loginForm) break;
      }
      if (!loginForm) {
        for (const form of forms) {
          if (form.querySelector('input[name="log"]')) { loginForm = form; break; }
        }
      }
      if (!loginForm) return false;
      const cu = loginForm.querySelector('input[name="log"], input[type="text"]');
      const cp = loginForm.querySelector('input[name="pwd"], input[type="password"]');
      if (!cu || !cp) return false;
      cu.value = user;
      cu.dispatchEvent(new Event('input', { bubbles: true }));
      cp.value = pass;
      cp.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = loginForm.querySelector('button[type="submit"], input[type="submit"]');
      if (btn) btn.click();
      return true;
    }, SEMBRADOR_USER, SEMBRADOR_PASS);

    if (loginOk) {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await delay(1500);
      console.log('  ✓ Login OK');
    } else {
      console.log('  ⚠ Login no completado');
    }

    // ── BUSCAR CADA PRODUCTO ──
    for (const config of BUSQUEDAS) {
      console.log(`  🔍 Buscando: "${config.buscar}"`);
      try {
        const url = `https://el-sembrador.com.ar/tienda/?23867_search_1=${config.buscar}&23867_filtered=true`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await delay(1500);

        // Extraer productos y precios
        const productos = await page.evaluate((enfocar, cantidad_kg) => {
          const items = [];
          document.querySelectorAll('.product, li.product, .type-product').forEach(el => {
            const nombre = (el.querySelector('h2, .woocommerce-loop-product__title')?.innerText || '').trim();
            if (!nombre) return;

            // Precio oferta vs normal
            const po = el.querySelector('ins .woocommerce-Price-amount bdi, ins .amount bdi');
            const pn = el.querySelector('.woocommerce-Price-amount bdi, .price .amount bdi');
            const limpiar = t => {
              if (!t) return null;
              const txt = t.innerText || t.textContent || '';
              const num = parseFloat(txt.replace(/[^0-9,]/g,'').replace(',','.'));
              return isNaN(num) ? null : num;
            };
            const precio_oferta = limpiar(po);
            const precio_base = limpiar(pn);
            const precio = precio_oferta || precio_base;
            if (!precio || precio < 100) return;

            const nombreUp = nombre.toUpperCase();
            const esEnfocado = enfocar.some(e => nombreUp.includes(e));
            const link = el.querySelector('a')?.href || '';

            // Mejor precio por cantidad
            const txt = el.innerText || '';
            const majMatch = txt.match(/partir de[:\s]*([\d]+)\s*kg/i);
            items.push({ nombre, precio, precio_oferta, es_enfocado: esEnfocado, link, mejor_kgs: majMatch ? parseInt(majMatch[1]) : null });
          });
          return items;
        }, config.enfocar, config.cantidad_kg);

        console.log(`  → ${productos.length} productos encontrados`);

        if (productos.length === 0) {
          lineasReporte.push(`🌿 ${config.nombre_db.toUpperCase()}`);
          lineasReporte.push(`  ⚠ Sin resultados para "${config.buscar}"`);
          lineasReporte.push('');
          continue;
        }

        // Obtener último precio guardado
        const prod = findProd(config.nombre_db);
        let ultimoPrecio = null;
        if (prod?.id) {
          const { data: ult } = await sb.schema('ops').from('precios_historico')
            .select('precio_sin_iva').eq('producto_id', prod.id).eq('proveedor_id', provMap['El Sembrador'])
            .order('fecha_registro', { ascending: false }).limit(1).maybeSingle();
          ultimoPrecio = ult?.precio_sin_iva;
        }

        // Construir líneas del reporte
        lineasReporte.push(`🌿 ${config.nombre_db.toUpperCase()}`);

        const enfocados = productos.filter(p => p.es_enfocado);
        const mejor = enfocados[0] || productos[0];
        const precioActual = mejor.precio;

        // Variación vs último precio
        if (ultimoPrecio && precioActual) {
          const pct = ((precioActual - ultimoPrecio) / ultimoPrecio) * 100;
          if (Math.abs(pct) >= 1) {
            const sube = pct > 0;
            const ahorro = Math.round(Math.abs(pct/100 * ultimoPrecio * config.cantidad_kg));
            lineasReporte.push(`${sube ? '📈' : '📉'} ${sube ? 'Subió' : 'Bajó'} ${Math.abs(pct).toFixed(1)}% vs última compra`);
            if (!sube) lineasReporte.push(`💰 Ahorro pidiendo ${config.cantidad_kg}kg ahora: $${ahorro.toLocaleString('es-AR')}`);
          } else {
            lineasReporte.push(`= Precio estable`);
          }
        }

        // Listar todos los productos encontrados
        productos.forEach(p => {
          const tag = p.es_enfocado ? '✓' : '·';
          const oferta = p.precio_oferta ? ' 🔥 OFERTA' : '';
          const mayor = p.mejor_kgs ? ` · mejor precio a partir de ${p.mejor_kgs}kg` : '';
          lineasReporte.push(`  ${tag} ${p.nombre}: $${Math.round(p.precio).toLocaleString('es-AR')}/kg${oferta}${mayor}`);
        });

        // Oportunidades de otras variantes en oferta
        const oportunidad = productos.find(p => !p.es_enfocado && p.precio_oferta);
        if (oportunidad) {
          lineasReporte.push(`  💡 Oportunidad: ${oportunidad.nombre} en oferta · Lucas decide`);
        }

        lineasReporte.push('');

        // Guardar precio en Supabase
        if (prod?.id && precioActual) {
          const precioRes = await sb.schema('ops').from('precios_historico').insert({
            producto_id: prod.id,
            proveedor_id: provMap['El Sembrador'],
            precio_sin_iva: precioActual,
            fuente: 'agente',
            ahorro_vs_anterior: ultimoPrecio ? ultimoPrecio - precioActual : 0,
          });
          if (precioRes.error) console.log('  ⚠ Error guardando precio:', precioRes.error.message);
          else console.log(`  ✓ Precio guardado: $${Math.round(precioActual).toLocaleString('es-AR')}/kg`);
        }

        await delay(800);

      } catch(eProd) {
        console.log(`  ⚠ Error en ${config.buscar}:`, eProd.message);
        lineasReporte.push(`🌿 ${config.nombre_db.toUpperCase()}`);
        lineasReporte.push(`  ⚠ Error al consultar: ${eProd.message}`);
        lineasReporte.push('');
      }
    }

  } catch(e) {
    console.log('❌ Error general:', e.message);
    lineasReporte.push(`⚠ Error en el monitoreo: ${e.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  // Guardar reporte en alertas
  const reporte = lineasReporte.join('\n');
  console.log('\n📋 Reporte:\n' + reporte);

  const { error: errAlerta } = await sb.schema('ops').from('alertas').insert({
    tipo: 'analisis_proveedor',
    mensaje: reporte,
    datos: { fecha: new Date().toISOString(), productos: BUSQUEDAS.length },
  });

  if (errAlerta) {
    console.log('❌ Error guardando alerta:', JSON.stringify(errAlerta));
  } else {
    console.log('✓ Reporte guardado para Lucas');
  }

  // Registrar ejecución
  const monRes = await sb.schema('ops').from('monitoreo_precios').insert({
    proveedor_id: provMap['El Sembrador'],
    productos_revisados: BUSQUEDAS.length,
    alerta_generada: true,
    fecha_ejecucion: new Date().toISOString(),
  });
  if (monRes.error) console.log('⚠ monitoreo_precios:', monRes.error.message);

  console.log('\n✅ Monitoreo completado');
  console.log('═'.repeat(55));
}

module.exports = { monitorear };
if (require.main === module) monitorear().catch(console.error);
