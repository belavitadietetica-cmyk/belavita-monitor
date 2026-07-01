const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;
const delay = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// PRODUCTOS A MONITOREAR — EL SEMBRADOR — URLs exactas
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
// PRODUCTOS A MONITOREAR — MOLY MARKET — URLs exactas
// No requiere login. Los precios son "en negro" (sin factura);
// si se pide factura A, el sobreprecio (+10.5%) ya está
// contemplado en la tabla de IVA por proveedor de la app.
// ═══════════════════════════════════════════════════════
const PRODUCTOS_MOLY = [
  {
    nombre_db: 'Almendras Non Pareil',
    proveedor: 'Moly Market',
    principal: true,
    pesos_objetivo: ['10 kg'],
    variantes: [
      { url: 'https://www.molymarket.com.ar/product/almendra-non-pareil-mediana-importada/', label: 'Non Pareil Mediana Importada', es_principal: true },
      { url: 'https://www.molymarket.com.ar/product/almendra-non-pareil-mediana/', label: 'Non Pareil Mediana', es_principal: true },
      { url: 'https://www.molymarket.com.ar/product/almendra-guara-mediana/', label: 'Guara Mediana', es_principal: false },
      { url: 'https://www.molymarket.com.ar/product/almendra-non-pareil-chile/', label: 'Non Pareil Chile', es_principal: false },
    ]
  },
  {
    nombre_db: 'Nuez Mariposa',
    proveedor: 'Moly Market',
    principal: true,
    pesos_objetivo: ['10 kg'],
    variantes: [
      { url: 'https://www.molymarket.com.ar/product/nuez-mariposa-light-x10kg/', label: 'Mariposa Light', es_principal: true },
      { url: 'https://www.molymarket.com.ar/product/nuez-mariposa-extra-light-10kg-procesada-a-mano/', label: 'Mariposa Extra Light (procesada a mano)', es_principal: true },
      { url: 'https://www.molymarket.com.ar/product/nuez-cuartos-extra-light/', label: 'Cuartos Extra Light', es_principal: false },
    ]
  },
  {
    nombre_db: 'Chía',
    proveedor: 'Moly Market',
    principal: true,
    pesos_objetivo: ['25 kg'],
    variantes: [
      { url: 'https://www.molymarket.com.ar/product/chia-aa/', label: 'Chía AA', es_principal: true },
    ]
  },
  {
    nombre_db: 'Harina de Coco',
    proveedor: 'Moly Market',
    principal: true,
    pesos_objetivo: ['5 kg', '10 kg'],
    variantes: [
      { url: 'https://www.molymarket.com.ar/product/harina-de-coco-100-pura/', label: 'Harina de Coco 100% Pura', es_principal: true },
    ]
  },
  {
    nombre_db: 'Manzanilla',
    proveedor: 'Moly Market',
    principal: false,
    pesos_objetivo: ['1 kg'],
    variantes: [
      { url: 'https://www.molymarket.com.ar/product/manzanilla-pura-flor/', label: 'Manzanilla Pura Flor', es_principal: true },
    ]
  },
  // Psyllium: Moly Market no tiene ni semilla ni harina de psyllium — queda excluido
];

// ═══════════════════════════════════════════════════════
// LEER PRECIO DE UNA URL DE PRODUCTO — EL SEMBRADOR
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

    // Capturar texto y verificar que corresponde al producto correcto
    let textoActual = await page.evaluate(() => document.body?.innerText || '');
    
    // Si el texto no contiene parte de la URL del producto, esperar y reintentar
    const slugEsperado = url.split('/producto/')[1]?.replace(/\//g,'').toUpperCase().replace(/-/g,' ');
    const palabrasClave = slugEsperado?.split(' ').filter(p => p.length > 3) || [];
    const textoContieneProducto = palabrasClave.some(p => textoActual.toUpperCase().includes(p));
    
    if (!textoContieneProducto && palabrasClave.length > 0) {
      console.log(`    → Reintentando carga (texto no coincide con ${palabrasClave[0]})`);
      await delay(2000);
      textoActual = await page.evaluate(() => document.body?.innerText || '');
    }
    
    const datos = await page.evaluate((kg, textoExterno) => {
      // Usar el texto capturado externamente para evitar race conditions
      const fullTxt = textoExterno || document.body?.innerText || '';
      
      // Detectar SIN EXISTENCIAS PRIMERO — si no hay stock no hay precio válido
      const sinStock = fullTxt.includes('SIN EXISTENCIAS') || fullTxt.includes('sin existencias') || fullTxt.includes('Agotado');
      
      // Buscar el h1 del producto para ignorar el carrito
      const h1 = document.querySelector('h1.product_title, h1, h2.product_title');
      const h1Text = (h1?.innerText || '').trim();
      // El h1 aparece DOS veces en el texto (breadcrumb + título real)
      // Buscar la segunda ocurrencia para evitar el breadcrumb
      let h1Idx = 0;
      if (h1Text) {
        const first = fullTxt.indexOf(h1Text);
        const second = fullTxt.indexOf(h1Text, first + h1Text.length);
        h1Idx = second > 0 ? second : first;
      }
      
      // Solo analizar texto desde el título del producto hacia abajo
      const txt = h1Idx > 0 ? fullTxt.substring(h1Idx) : fullTxt;

      // Detectar oferta
      const tieneOferta = txt.includes('OFERTA') || !!document.querySelector('.woocommerce-Price-amount ins, ins .amount');

      // Estructura de la página: "NOMBRE PRODUCTO $ PRECIO_NORMAL [precio_oferta]"
      // El primer precio después del h1 es el precio base
      // Si hay oferta, aparece un segundo precio más bajo

      // Buscar todos los precios en el área del producto (>$1000)
      const precios = [...txt.matchAll(/\$\s*([\d.]+)/g)]
        .map(m => ({ val: parseFloat(m[1].replace(/\./g,'')), raw: m[1] }))
        .filter(p => p.val > 1000 && p.val < 5000000);

      // Si no hay stock, no hay precio válido
      if (sinStock) return { precio_base: null, precio_normal: null, precio_oferta: null, precio_10kg: null, mejor_kgs: null, tiene_oferta: false, sin_stock: true, todos_precios: [] };

      if (!precios.length) return null;

      // El precio normal es el PRIMERO que aparece
      const precioNormal = precios[0].val;
      
      // Si hay oferta y un segundo precio distinto, ese es el precio con descuento
      const segundoPrecio = precios.find(p => Math.abs(p.val - precioNormal) > 100);
      const precioOferta = tieneOferta && segundoPrecio && segundoPrecio.val < precioNormal 
        ? segundoPrecio.val : null;
      
      // El precio efectivo: oferta si existe, sino el normal
      const precioBase = precioOferta || precioNormal;

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
      // sinStock calculado arriba

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
    }, cantidad_kg, textoActual);

    return datos;
  } catch(e) {
    console.log(`    ⚠ Error en ${url}: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// LEER PRECIO DE UNA URL DE PRODUCTO — MOLY MARKET
// Sitio WooCommerce sin login. Algunos productos son
// "variables" (dropdown de Peso: 250g/500g/1kg/5kg/10kg/25kg)
// y otros son "simples" (peso fijo, ej. "...x10kg" en el slug).
// Se maneja el peso pedido (pesoObjetivo, ej. "10 kg") en
// ambos casos. Devuelve el precio TOTAL del bulto pedido.
// ═══════════════════════════════════════════════════════
async function leerPrecioMoly(page, url, pesoObjetivo) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1500);

    // Diagnóstico: título de la página + preview del texto visible
    const diag = await page.evaluate(() => ({
      titulo: document.title || '',
      preview: (document.body?.innerText || '').substring(0, 300).replace(/\n/g, ' '),
      tieneWooForm: !!document.querySelector('form.variations_form, form.cart'),
      tienePrecioGenerico: !!document.querySelector('.woocommerce-Price-amount, .price'),
    }));
    console.log(`    → título="${diag.titulo}" wooForm=${diag.tieneWooForm} tienePrecio=${diag.tienePrecioGenerico}`);
    console.log(`    → preview: ${diag.preview}`);

    // Chequear sin stock
    const sinStock = await page.evaluate(() => {
      const txt = document.body?.innerText || '';
      return /SIN STOCK|AGOTADO/i.test(txt);
    });
    if (sinStock) return { precio: null, sin_stock: true };

    // ¿Es un producto con variantes (selector de Peso)?
    const tieneSelect = await page.evaluate(() => {
      return !!document.querySelector('form.variations_form select, table.variations select, .variations select');
    });
    console.log(`    → tieneSelect=${tieneSelect}`);

    if (tieneSelect) {
      // Diagnóstico: listar las opciones reales del selector
      const opciones = await page.evaluate(() => {
        const select = document.querySelector('form.variations_form select, table.variations select, .variations select');
        return select ? Array.from(select.options).map(o => o.textContent.trim()) : [];
      });
      console.log(`    → opciones del selector: [${opciones.join(' | ')}]`);

      // Buscar la opción cuyo texto matchea el peso objetivo (normalizado, sin espacios, minúscula)
      const valorOpcion = await page.evaluate((pesoObjetivo) => {
        const select = document.querySelector('form.variations_form select, table.variations select, .variations select');
        if (!select) return null;
        const normal = s => (s || '').toLowerCase().replace(/\s+/g, '').replace(',', '.');
        const target = normal(pesoObjetivo);
        for (const opt of select.options) {
          const txt = normal(opt.textContent);
          if (txt === target) return opt.value;
        }
        // fallback: buscar coincidencia parcial (ej "10kg" dentro del texto)
        for (const opt of select.options) {
          if (normal(opt.textContent).includes(target.replace('kg', ''))) return opt.value;
        }
        return null;
      }, pesoObjetivo);

      if (!valorOpcion) {
        console.log(`    ⚠ No se encontró la opción "${pesoObjetivo}" en el selector de ${url}`);
        return { precio: null, sin_stock: false, no_encontrado: true };
      }

      const selectHandle = await page.$('form.variations_form select, table.variations select, .variations select');
      await selectHandle.select(valorOpcion);
      // Esperar a que WooCommerce actualice el precio de la variante (AJAX interno, sin recarga)
      await delay(1500);
    }

    // Leer el precio visible. Preferir el precio de variante si quedó seleccionado.
    const resultado = await page.evaluate(() => {
      const candidatos = [
        '.woocommerce-variation-price .woocommerce-Price-amount',
        '.woocommerce-variation-price .amount',
        '.single_variation .woocommerce-Price-amount',
        '.summary .price ins .woocommerce-Price-amount',
        '.summary .price .woocommerce-Price-amount',
        'p.price .woocommerce-Price-amount',
        '.price .woocommerce-Price-amount',
        '.woocommerce-Price-amount',
      ];
      let el = null, selUsado = null;
      for (const sel of candidatos) {
        el = document.querySelector(sel);
        if (el) { selUsado = sel; break; }
      }
      const txt = el?.textContent || '';
      const m = txt.match(/([\d.]+)/);
      return { precio: m ? parseFloat(m[1].replace(/\./g, '')) : null, selUsado, textoCrudo: txt };
    });
    console.log(`    → selector usado="${resultado.selUsado}" textoCrudo="${resultado.textoCrudo}" precio=${resultado.precio}`);

    return { precio: resultado.precio, sin_stock: false };
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
        await delay(2000);
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
        if (r.datos.sin_stock) {
          lineas.push(`  ${tag} ${r.label}: sin stock`);
          continue;
        }
        const oferta = r.datos.tiene_oferta ? ' 🔥 OFERTA' : '';
        const mejor = r.datos.mejor_kgs ? ` · mejor desde ${r.datos.mejor_kgs}kg` : '';
        const precio10 = r.datos.precio_10kg ? ` · ${prod_config.cantidad_kg}kg = $${Math.round(r.datos.precio_10kg * prod_config.cantidad_kg).toLocaleString('es-AR')} ($${Math.round(r.datos.precio_10kg).toLocaleString('es-AR')}/kg)` : '';
        lineas.push(`  ${tag} ${r.label}: $${Math.round(r.precio).toLocaleString('es-AR')}/kg${precio10}${oferta}${mejor}`);
        if (r.datos.tiene_oferta || r.datos.sin_stock) hayNovedades = true;
      }

      lineas.push('');

      // Guardar precio principal en Supabase (solo si hay precio real)
      if (prod?.id && precioActual && precioActual > 0) {
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

    // ═══════════════════════════════════════════════════
    // MOLY MARKET — no requiere login, se reutiliza el mismo browser
    // ═══════════════════════════════════════════════════
    console.log('\n📦 MOLY MARKET');

    if (!provMap['Moly Market']) {
      console.log('  ⚠ No existe el proveedor "Moly Market" en ops.proveedores — se omite el análisis');
    } else {
      const lineasMoly = [];
      lineasMoly.push(`📊 ANÁLISIS MOLY MARKET · ${fecha}`);
      lineasMoly.push('');

      for (const prod_config of PRODUCTOS_MOLY) {
        console.log(`\n  🌿 ${prod_config.nombre_db}`);
        lineasMoly.push(`🌿 ${prod_config.nombre_db.toUpperCase()}`);

        const prod = findProd(prod_config.nombre_db);

        // Para cada peso objetivo del producto (ej. Harina de Coco pide 5kg Y 10kg)
        for (const peso of prod_config.pesos_objetivo) {
          const kgNum = parseFloat(peso.replace(/[^\d.]/g, '')) || 1;

          // Último precio guardado para este producto+proveedor (comparación siempre en $/kg)
          let ultimoPrecioKg = null;
          if (prod?.id) {
            const { data: ult } = await sb.schema('ops').from('precios_historico')
              .select('precio_sin_iva').eq('producto_id', prod.id)
              .eq('proveedor_id', provMap['Moly Market'])
              .order('fecha_registro', { ascending: false }).limit(1).maybeSingle();
            ultimoPrecioKg = ult?.precio_sin_iva;
          }

          const resultados = [];
          for (const variante of prod_config.variantes) {
            const datos = await leerPrecioMoly(page, variante.url, peso);
            if (!datos || datos.precio == null) {
              console.log(`    ⚠ ${variante.label} (${peso}): no disponible`);
              continue;
            }
            const precioTotal = datos.precio;
            const precioKg = Math.round((precioTotal / kgNum) * 100) / 100;
            console.log(`    ${variante.es_principal ? '✓' : '·'} ${variante.label} (${peso}): $${Math.round(precioTotal).toLocaleString('es-AR')} total ($${Math.round(precioKg).toLocaleString('es-AR')}/kg)`);
            resultados.push({ ...variante, precioTotal, precioKg });
            await delay(1500);
          }

          if (!resultados.length) {
            lineasMoly.push(`  ⚠ Sin datos disponibles para ${peso}`);
            continue;
          }

          const principal = resultados.find(r => r.es_principal) || resultados[0];

          if (ultimoPrecioKg && principal.precioKg) {
            const pct = ((principal.precioKg - ultimoPrecioKg) / ultimoPrecioKg) * 100;
            if (Math.abs(pct) >= 1) {
              const sube = pct > 0;
              lineasMoly.push(`  ${sube ? '📈' : '📉'} ${sube ? 'Subió' : 'Bajó'} ${Math.abs(pct).toFixed(1)}% vs última compra ($${Math.round(ultimoPrecioKg).toLocaleString('es-AR')}/kg)`);
            } else {
              lineasMoly.push(`  = Precio estable (${peso})`);
            }
          }

          for (const r of resultados) {
            const tag = r.es_principal ? '✓' : '·';
            lineasMoly.push(`  ${tag} ${r.label} · ${peso}: $${Math.round(r.precioTotal).toLocaleString('es-AR')} total ($${Math.round(r.precioKg).toLocaleString('es-AR')}/kg)`);
          }

          // Guardar precio principal ($/kg) en Supabase
          if (prod?.id && principal.precioKg > 0) {
            const { error } = await sb.schema('ops').from('precios_historico').insert({
              producto_id: prod.id,
              proveedor_id: provMap['Moly Market'],
              precio_sin_iva: principal.precioKg,
              fuente: 'agente',
              ahorro_vs_anterior: ultimoPrecioKg ? ultimoPrecioKg - principal.precioKg : 0,
            });
            if (error) console.log(`    ⚠ Error guardando precio: ${error.message}`);
            else console.log(`    ✓ Precio guardado: $${Math.round(principal.precioKg).toLocaleString('es-AR')}/kg`);
          }
        }
        lineasMoly.push('');
      }

      // Guardar reporte de Moly Market como alerta separada
      const reporteMoly = lineasMoly.join('\n');
      console.log('\n📋 Reporte Moly Market:\n' + reporteMoly);
      const { error: errAlertaMoly } = await sb.schema('ops').from('alertas').insert({
        tipo: 'analisis_proveedor',
        mensaje: reporteMoly,
        datos: { fecha: new Date().toISOString(), proveedor: 'Moly Market', productos: PRODUCTOS_MOLY.length },
      });
      if (errAlertaMoly) console.log('❌ Error guardando alerta Moly Market:', JSON.stringify(errAlertaMoly));
      else console.log('✓ Reporte Moly Market guardado para Lucas');
    }

  } catch(e) {
    console.log('❌ Error general:', e.message);
    lineas.push(`⚠ Error: ${e.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Guardar reporte de El Sembrador
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
