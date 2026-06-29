const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;
const delay = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// PRODUCTOS A MONITOREAR — URLs exactas
// ═══════════════════════════════════════════════════════
const PRODUCTOS = [
  // ALMENDRAS
  {
    nombre_db: 'Almendras Non Pareil',
    proveedor: 'El Sembrador',
    principal: true,
    cantidad_kg: 10,
    variantes: [
      { url: 'https://el-sembrador.com.ar/producto/almendra-non-pareil-27-30-importada/', label: 'Non Pareil 27-30 Importada', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/almendra-non-pareil-mediana-nacional/', label: 'Non Pareil Mediana Nacional', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/almendra-non-pareil-tipo/', label: 'Non Pareil Tipo', es_principal: false },
      { url: 'https://el-sembrador.com.ar/producto/almendra-guara-chica-n2/', label: 'Guara Chica N2 (alternativa)', es_principal: false },
    ]
  },
  // NUEZ
  {
    nombre_db: 'Nuez Mariposa',
    proveedor: 'El Sembrador',
    principal: true,
    cantidad_kg: 10,
    variantes: [
      { url: 'https://el-sembrador.com.ar/producto/nuez-mariposa-extra-light/', label: 'Mariposa Extra Light', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/nuez-mariposa-light/', label: 'Mariposa Light', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/nuez-cuarto-extra-light/', label: 'Cuarto Extra Light', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/nuez-cuarto-light/', label: 'Cuarto Light', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/nuez-pecan-mariposa/', label: 'Pecán Mariposa (sin stock habitual · evaluar incorporar)', es_principal: false },
    ]
  },
  // CHÍA
  {
    nombre_db: 'Chía',
    proveedor: 'El Sembrador',
    principal: true,
    cantidad_kg: 25,
    variantes: [
      { url: 'https://el-sembrador.com.ar/producto/semilla-chia-aa/', label: 'Semilla Chía AA', es_principal: true },
    ]
  },
  // HARINA DE COCO
  {
    nombre_db: 'Harina de Coco',
    proveedor: 'El Sembrador',
    principal: true,
    cantidad_kg: 10,
    variantes: [
      { url: 'https://el-sembrador.com.ar/producto/harina-coco/', label: 'Harina de Coco', es_principal: true },
    ]
  },
  // PSYLLIUM
  {
    nombre_db: 'Psyllium',
    proveedor: 'El Sembrador',
    principal: true,
    cantidad_kg: 10,
    variantes: [
      { url: 'https://el-sembrador.com.ar/producto/semilla-psyllium/', label: 'Semilla Psyllium', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/harina-psyllium/', label: 'Harina Psyllium', es_principal: false },
    ]
  },
  // MANZANILLA
  {
    nombre_db: 'Manzanilla',
    proveedor: 'El Sembrador',
    principal: false,
    cantidad_kg: 2,
    variantes: [
      { url: 'https://el-sembrador.com.ar/producto/hierba-manzanilla-pura-flor/', label: 'Manzanilla Pura Flor', es_principal: true },
      { url: 'https://el-sembrador.com.ar/producto/hierba-manzanilla-tallo-y-flor/', label: 'Manzanilla Tallo y Flor', es_principal: false },
    ]
  },
];

// ═══════════════════════════════════════════════════════
// LEER PRECIO DE UNA URL DE PRODUCTO
// ═══════════════════════════════════════════════════════
async function leerPrecioProducto(page, url, cantidad_kg) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(1500);

    // Clickear "VER PRECIOS" usando Puppeteer directamente
    try {
      // Buscar el elemento con texto VER PRECIOS
      const btnVerPrecios = await page.evaluateHandle(() => {
        const todos = Array.from(document.querySelectorAll('button, a, span, div, p, input'));
        for (const el of todos) {
          const txt = (el.innerText || el.textContent || el.value || '').trim().toUpperCase();
          if (txt === 'VER PRECIOS' || txt === 'VER PRECIO') return el;
        }
        return null;
      });
      
      if (btnVerPrecios && btnVerPrecios.asElement()) {
        console.log('    → Clickeando VER PRECIOS...');
        await btnVerPrecios.asElement().click();
        // Esperar que aparezca el precio en el DOM
        await page.waitForFunction(() => {
          const txt = document.body?.innerText || '';
          return txt.match(/\$\s*[\d.,]+\.-/) !== null;
        }, { timeout: 8000 }).catch(() => {});
        await delay(1500);
        console.log('    → Esperó precio dinámico');
      }
    } catch(eClick) {
      // Si falla el click, continuar igual
    }

    const datos = await page.evaluate((kg) => {
      // Buscar precio del PRODUCTO ignorando el carrito del header
      // El carrito aparece ANTES del h1, el precio del producto DESPUÉS

      const h1 = document.querySelector('h1.product_title, h1, h2.product_title');
      const fullTxt = document.body?.innerText || '';
      const h1Text = (h1?.innerText || '').trim();
      const h1Idx = h1Text ? fullTxt.indexOf(h1Text) : 0;
      
      // Solo analizar texto desde el título del producto hacia abajo
      const txt = h1Idx > 0 ? fullTxt.substring(h1Idx) : fullTxt;

      // Detectar oferta
      const tieneOferta = txt.includes('OFERTA') || !!document.querySelector('.woocommerce-Price-amount ins, ins .amount');

      // Extraer precios del área del producto (mínimo $1000 para evitar cantidades)
      const preciosMatch = [...txt.matchAll(/\$\s*([\d.]+)/g)];
      const precios = preciosMatch
        .map(m => parseFloat(m[1].replace(/\./g,'')))
        .filter(p => p > 1000 && p < 10000000);

      if (!precios.length) return null;

      const precioBase = Math.min(...precios);
      const precioNormal = precios.length > 1 ? Math.max(...precios) : precioBase;
      const precioOferta = tieneOferta && precios.length > 1 ? precioBase : null;

      // Precio específico por cantidad — buscar "Xkg" cerca de un precio
      let precioPorKg10 = null;
      const txtLines = txt.split('\n');
      for (let i = 0; i < txtLines.length; i++) {
        if (txtLines[i].includes(String(kg)) && txtLines[i].toLowerCase().includes('kg')) {
          for (let j = Math.max(0,i-3); j < Math.min(txtLines.length,i+5); j++) {
            const pm = txtLines[j].match(/\$\s*([\d.]+)/);
            if (pm) {
              const p = parseFloat(pm[1].replace(/\./g,''));
              if (p > 1000 && p < 10000000) { precioPorKg10 = p; break; }
            }
          }
          if (precioPorKg10) break;
        }
      }

      const mejorMatch = txt.match(/partir de[:\s]*([\d]+)\s*kg/i);
      const mejorKgs = mejorMatch ? parseInt(mejorMatch[1]) : null;
      const sinStock = txt.includes('sin existencias') || txt.includes('Agotado');

      return {
        precio_base: precioBase,
        precio_normal: precioNormal,
        precio_oferta: precioOferta,
        precio_10kg: precioPorKg10,
        mejor_kgs: mejorKgs,
        tiene_oferta: tieneOferta,
        sin_stock: sinStock,
        todos_precios: precios,
      };
    }, cantidad_kg);

    return datos;
  } catch(e) {
    console.log(`    ⚠ Error en ${url}: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════
async function monitorear() {
  const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
  console.log(`\n🔍 BELAVITA OPS · Monitoreo de precios`);
  console.log(`📅 ${ahora}`);
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
      if (k.includes(key.split(' ')[0])) return v;
    }
    return null;
  }

  const lineas = [];
  const fecha = new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Mendoza', weekday: 'long', day: 'numeric', month: 'long'
  });
  lineas.push(`📊 ANÁLISIS EL SEMBRADOR · ${fecha}`);
  lineas.push('');

  let browser = null;

  try {
    console.log('\n🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
             '--disable-gpu','--no-first-run','--single-process'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Bloquear solo imágenes y fuentes
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image','font','media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // LOGIN - usando cookies de sesión directamente
    console.log('\n📦 EL SEMBRADOR');
    console.log('  🔐 Cargando sesión...');

    // Ir al sitio primero para establecer el dominio
    await page.goto('https://el-sembrador.com.ar/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1000);

    // Parsear y cargar las cookies de sesión
    const cookieString = process.env.SEMBRADOR_COOKIES || '';
    const cookies = cookieString.split(';').map(c => {
      const [name, ...rest] = c.trim().split('=');
      return {
        name: name.trim(),
        value: rest.join('=').trim(),
        domain: 'el-sembrador.com.ar',
        path: '/',
      };
    }).filter(c => c.name && c.value);

    await page.setCookie(...cookies);
    console.log(`  → ${cookies.length} cookies cargadas`);

    // Verificar que estamos logueados yendo a un producto
    await page.goto('https://el-sembrador.com.ar/producto/almendra-non-pareil-27-30-importada/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(2000);

    const test = await page.evaluate(() => {
      const txt = document.body?.innerText || '';
      const tieneVer = txt.includes('VER PRECIOS');
      // Probar múltiples formatos de precio
      const m1 = txt.match(/\$\s*([\d.]+)\.-/);
      const m2 = txt.match(/\$\s*([\d.,]+)/);
      const m3 = txt.match(/([\d.]+),00/);
      const preview = txt.substring(0, 400).replace(/\n/g,' ');
      return { tieneVer, m1: m1?.[1], m2: m2?.[1], m3: m3?.[1], preview };
    });

    console.log(`  → tieneVer=${test.tieneVer}`);
    console.log(`  → m1=$${test.m1} m2=$${test.m2} m3=$${test.m3}`);
    console.log(`  → Preview: ${test.preview}`);
    const estaLogueado = !test.tieneVer;
    console.log(estaLogueado ? '  ✓ Sesión activa' : '  ⚠ Sesión no activa');

    // ANALIZAR CADA PRODUCTO
    // ANALIZAR CADA PRODUCTO
    // ANALIZAR CADA PRODUCTO
    // ANALIZAR CADA PRODUCTO
    // ANALIZAR CADA PRODUCTO
    // ANALIZAR CADA PRODUCTO
    for (const prod_config of PRODUCTOS) {
      console.log(`\n  🌿 ${prod_config.nombre_db}`);
      lineas.push(`🌿 ${prod_config.nombre_db.toUpperCase()}`);

      // Obtener último precio guardado
      const prod = findProd(prod_config.nombre_db);
      let ultimoPrecio = null;
      if (prod?.id) {
        const { data: ult } = await sb.schema('ops').from('precios_historico')
          .select('precio_sin_iva').eq('producto_id', prod.id)
          .eq('proveedor_id', provMap['El Sembrador'])
          .order('fecha_registro', { ascending: false }).limit(1).maybeSingle();
        ultimoPrecio = ult?.precio_sin_iva;
      }

      const resultados = [];

      // Leer cada variante
      for (const variante of prod_config.variantes) {
        const datos = await leerPrecioProducto(page, variante.url, prod_config.cantidad_kg);
        if (!datos) { console.log(`    ⚠ ${variante.label}: no disponible`); continue; }

        const precio = datos.precio_10kg || datos.precio_base;
        const sinStock = datos.sin_stock;

        console.log(`    ${variante.es_principal ? '✓' : '·'} ${variante.label}: $${Math.round(precio).toLocaleString('es-AR')}/kg${datos.tiene_oferta ? ' 🔥' : ''}${sinStock ? ' (SIN STOCK)' : ''}`);

        resultados.push({ ...variante, datos, precio });
        await delay(800);
      }

      if (!resultados.length) {
        lineas.push('  ⚠ No se pudieron leer los precios');
        lineas.push('');
        continue;
      }

      // Variación vs último precio (solo para variantes principales)
      const principal = resultados.find(r => r.es_principal && !r.datos.sin_stock);
      const precioActual = principal?.precio;

      if (ultimoPrecio && precioActual) {
        const pct = ((precioActual - ultimoPrecio) / ultimoPrecio) * 100;
        if (Math.abs(pct) >= 1) {
          const sube = pct > 0;
          lineas.push(`${sube ? '📈' : '📉'} ${sube ? 'Subió' : 'Bajó'} ${Math.abs(pct).toFixed(1)}% vs última compra ($${Math.round(ultimoPrecio).toLocaleString('es-AR')}/kg)`);
          if (!sube) {
            const ahorro = Math.round(Math.abs((precioActual - ultimoPrecio) * prod_config.cantidad_kg));
            lineas.push(`💰 Ahorro comprando ${prod_config.cantidad_kg}kg ahora: $${ahorro.toLocaleString('es-AR')}`);
          }
        } else {
          lineas.push(`= Precio estable`);
        }
      }

      // Listar variantes con novedades
      let hayNovedades = false;
      for (const r of resultados) {
        const tag = r.es_principal ? '✓' : '·';
        const oferta = r.datos.tiene_oferta ? ' 🔥 OFERTA' : '';
        const stock = r.datos.sin_stock ? ' (sin stock)' : '';
        const mejor = r.datos.mejor_kgs ? ` · mejor desde ${r.datos.mejor_kgs}kg` : '';
        const precio10 = r.datos.precio_10kg ? ` · ${prod_config.cantidad_kg}kg = $${Math.round(r.datos.precio_10kg * prod_config.cantidad_kg).toLocaleString('es-AR')} ($${Math.round(r.datos.precio_10kg).toLocaleString('es-AR')}/kg)` : '';
        lineas.push(`  ${tag} ${r.label}: $${Math.round(r.precio).toLocaleString('es-AR')}/kg${precio10}${oferta}${stock}${mejor}`);
        if (r.datos.tiene_oferta || r.datos.sin_stock) hayNovedades = true;
      }

      lineas.push('');

      // Guardar precio principal en Supabase
      if (prod?.id && precioActual) {
        const { error } = await sb.schema('ops').from('precios_historico').insert({
          producto_id: prod.id,
          proveedor_id: provMap['El Sembrador'],
          precio_sin_iva: precioActual,
          fuente: 'agente',
          ahorro_vs_anterior: ultimoPrecio ? ultimoPrecio - precioActual : 0,
        });
        if (error) console.log(`    ⚠ Error guardando precio: ${error.message}`);
        else console.log(`    ✓ Precio guardado: $${Math.round(precioActual).toLocaleString('es-AR')}/kg`);
      }
    }

  } catch(e) {
    console.log('❌ Error general:', e.message);
    lineas.push(`⚠ Error: ${e.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Guardar reporte
  const reporte = lineas.join('\n');
  console.log('\n📋 Reporte:\n' + reporte);

  const { error: errAlerta } = await sb.schema('ops').from('alertas').insert({
    tipo: 'analisis_proveedor',
    mensaje: reporte,
    datos: { fecha: new Date().toISOString(), productos: PRODUCTOS.length },
  });

  if (errAlerta) console.log('❌ Error guardando alerta:', JSON.stringify(errAlerta));
  else console.log('✓ Reporte guardado para Lucas');

  console.log('\n✅ Monitoreo completado');
  console.log('═'.repeat(55));
}

module.exports = { monitorear };
if (require.main === module) monitorear().catch(console.error);
