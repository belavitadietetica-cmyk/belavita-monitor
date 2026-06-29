// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Agente de monitoreo de precios
// El Sembrador (con login + búsqueda correcta)
// Lunes, Miércoles y Viernes a las 8am
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SEMBRADOR_USER = process.env.SEMBRADOR_USER;
const SEMBRADOR_PASS = process.env.SEMBRADOR_PASS;

const delay = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// CONFIGURACIÓN DE PRODUCTOS A MONITOREAR
// buscar: término exacto en el buscador
// enfocar: variedad principal
// cantidad_kg: cantidad a filtrar para precio mayorista
// ═══════════════════════════════════════════════════════
const PRODUCTOS_SEMBRADOR = [
  {
    buscar: 'almendra',
    nombre_db: 'Almendras Non Pareil',
    enfocar: ['NON PAREIL', 'NONPAREIL'],
    cantidad_kg: 10,
    nota_lucas: 'Priorizar Non Pareil importada. Si hay oferta en otra variedad avisarlo como oportunidad.',
  },
  {
    buscar: 'nuez',
    nombre_db: 'Nuez Mariposa',
    enfocar: ['MARIPOSA EXTRA LIGHT', 'MARIPOSA LIGHT', 'CUARTO LIGHT', 'CUARTO EXTRA LIGHT'],
    cantidad_kg: 10,
    nota_lucas: 'Enfocar en Mariposa Extra Light y Cuarto Light. Comparar precio/kg entre variantes.',
  },
  {
    buscar: 'chia',
    nombre_db: 'Chía',
    enfocar: ['CHIA AA', 'CHIA SEMILLA AA'],
    cantidad_kg: 25,
    nota_lucas: 'Comprar por 25kg. Verificar que sea AA (calidad máxima).',
  },
  {
    buscar: 'harina coco',
    nombre_db: 'Harina de Coco',
    enfocar: ['HARINA COCO', 'HARINA DE COCO'],
    cantidad_kg: 10,
    nota_lucas: 'Un solo producto. Verificar precio por kg.',
  },
  {
    buscar: 'psyllium',
    nombre_db: 'Psyllium',
    enfocar: ['PSYLLIUM', 'HARINA PSYLLIUM'],
    cantidad_kg: 10,
    nota_lucas: 'Filtrar por 10kg.',
  },
  {
    buscar: 'manzanilla',
    nombre_db: 'Manzanilla',
    enfocar: ['MANZANILLA PURA FLOR', 'MANZANILLA'],
    cantidad_kg: 2,
    nota_lucas: 'Hay dos variantes: pura flor y con tallo. Informar precio de ambas.',
  },
];

// ═══════════════════════════════════════════════════════
// LANZAR BROWSER
// ═══════════════════════════════════════════════════════
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  });
}

// ═══════════════════════════════════════════════════════
// LOGIN EN EL SEMBRADOR
// ═══════════════════════════════════════════════════════
async function loginSembrador(page) {
  console.log('  🔐 Logueando en El Sembrador...');
  try {
    await page.goto('https://el-sembrador.com.ar/mi-cuenta/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await delay(3000);

    // La página tiene 2 formularios: registro (arriba) y login (abajo con botón ACCEDER)
    // Usamos evaluate para operar directamente sobre el DOM correcto
    const resultado = await page.evaluate((user, pass) => {
      const forms = Array.from(document.querySelectorAll('form'));
      let loginForm = null;

      // Buscar el form que tenga el botón ACCEDER
      for (const form of forms) {
        const btns = form.querySelectorAll('button, input[type="submit"]');
        for (const btn of btns) {
          const txt = (btn.value || btn.innerText || btn.textContent || '').toLowerCase();
          if (txt.includes('acced') || txt.includes('ingresar') || txt.includes('entrar')) {
            loginForm = form;
            break;
          }
        }
        if (loginForm) break;
      }

      // Fallback: buscar por campo log/pwd
      if (!loginForm) {
        for (const form of forms) {
          if (form.querySelector('input[name="log"]') || form.querySelector('input[name="user_login"]')) {
            loginForm = form;
            break;
          }
        }
      }

      if (!loginForm) return { ok: false, error: 'SIN_FORM' };

      const campoUser = loginForm.querySelector('input[name="log"], input[name="user_login"], input[type="text"]');
      const campoPass = loginForm.querySelector('input[name="pwd"], input[name="user_pass"], input[type="password"]');

      if (!campoUser || !campoPass) return { ok: false, error: 'SIN_CAMPOS' };

      campoUser.value = user;
      campoUser.dispatchEvent(new Event('input', { bubbles: true }));
      campoUser.dispatchEvent(new Event('change', { bubbles: true }));

      campoPass.value = pass;
      campoPass.dispatchEvent(new Event('input', { bubbles: true }));
      campoPass.dispatchEvent(new Event('change', { bubbles: true }));

      const btnSubmit = loginForm.querySelector('button[type="submit"], input[type="submit"]');
      if (btnSubmit) btnSubmit.click();

      return { ok: true, error: null };
    }, SEMBRADOR_USER, SEMBRADOR_PASS);

    console.log('  → evaluate:', JSON.stringify(resultado));

    if (!resultado.ok) {
      console.log('  ⚠ No se pudo completar el login:', resultado.error);
      return false;
    }

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await delay(2000);

    const urlFinal = page.url();
    const ok = !urlFinal.includes('/mi-cuenta/?') && urlFinal.includes('sembrador');
    console.log(ok ? '  ✓ Login OK' : '  ⚠ Login incierto · ' + urlFinal);
    return ok;

  } catch(e) {
    console.log('  ⚠ Error en login:', e.message);
    return false;
  }
}

async function buscarProducto(page, config) {
  console.log(`\n  🔍 Buscando: "${config.buscar}"`);

  // Ir a la tienda mayorista con búsqueda
  const url = `https://el-sembrador.com.ar/tienda/?s=${encodeURIComponent(config.buscar)}&post_type=product`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await delay(1500);

  // Extraer todos los productos de los resultados
  const productos = await page.evaluate((enfocar, cantidad_kg) => {
    const items = [];
    document.querySelectorAll('.product, .type-product, li.product').forEach(el => {
      const nombre = el.querySelector('h2, .woocommerce-loop-product__title, .product-title')?.innerText?.trim() || '';
      if (!nombre) return;

      // Precio
      const precioOferta = el.querySelector('ins .woocommerce-Price-amount bdi, ins .amount');
      const precioNormal = el.querySelector('del .woocommerce-Price-amount bdi, del .amount');
      const precioBase = el.querySelector('.woocommerce-Price-amount bdi, .price .amount');

      const limpiar = t => t ? parseFloat(t.innerText.replace(/[^0-9,]/g,'').replace(',','.')) : null;
      const oferta = limpiar(precioOferta);
      const normal = limpiar(precioNormal) || limpiar(precioBase);
      const efectivo = oferta || normal;

      // Mejor precio por cantidad (texto "Mejor precio comprando a partir de X kgs")
      const mejorTxt = el.innerText || '';
      const mejorMatch = mejorTxt.match(/partir de[:\s]*([\d]+)\s*kg/i);
      const mejor_kgs = mejorMatch ? parseInt(mejorMatch[1]) : null;

      // URL del producto
      const link = el.querySelector('a')?.href || '';

      // ¿Es el enfocado?
      const nombreUp = nombre.toUpperCase();
      const esEnfocado = enfocar.some(e => nombreUp.includes(e.toUpperCase()));

      items.push({
        nombre,
        precio_base: efectivo,
        precio_anterior: normal,
        tiene_oferta: !!oferta,
        mejor_kgs,
        link,
        es_enfocado: esEnfocado,
      });
    });
    return items;
  }, config.enfocar, config.cantidad_kg);

  console.log(`  → ${productos.length} productos encontrados`);

  // Para los productos enfocados, entrar a su página y buscar precio por cantidad
  const resultados = [];
  for (const prod of productos) {
    if (!prod.precio_base) continue;

    let precio_cantidad = null;
    let nota_cantidad = '';

    // Entrar al producto para ver precio por cantidad específica
    if (prod.link && (prod.es_enfocado || productos.length <= 3)) {
      try {
        await page.goto(prod.link, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await delay(800);

        const detalle = await page.evaluate((kg_buscar) => {
          // Buscar precio por cantidad en el texto de la página
          const txt = document.body.innerText;

          // Formato: "500 g ($20.490 x kg)" o "10 kg ($17.896 x kg)"
          const matches = [...txt.matchAll(/([\d]+)\s*kg?\s*\(\$\s*([\d.,]+)\s*x\s*kg\)/gi)];
          let precio_mejor = null;
          let kg_mejor = null;

          for (const m of matches) {
            const kg = parseFloat(m[1]);
            const precio = parseFloat(m[2].replace(/\./g,'').replace(',','.'));
            if (kg >= kg_buscar && (!precio_mejor || precio < precio_mejor)) {
              precio_mejor = precio;
              kg_mejor = kg;
            }
          }

          // También buscar descuento por monto
          const descMatch = txt.match(/10%.*descuento|descuento.*10%|MONTO M[IÍ]NIMO/i);
          const mejorKg = txt.match(/partir de[:\s]*([\d]+)\s*kg/i);

          return {
            precio_por_kg_cantidad: precio_mejor,
            kg_cantidad: kg_mejor,
            tiene_descuento_monto: !!descMatch,
            mejor_a_partir_de: mejorKg ? parseInt(mejorKg[1]) : null,
          };
        }, config.cantidad_kg);

        precio_cantidad = detalle.precio_por_kg_cantidad;
        if (precio_cantidad) {
          nota_cantidad = `${config.cantidad_kg}kg = $${Math.round(precio_cantidad * config.cantidad_kg).toLocaleString('es-AR')} ($${Math.round(precio_cantidad).toLocaleString('es-AR')}/kg)`;
        }
        if (detalle.tiene_descuento_monto) {
          nota_cantidad += ' · tiene descuento por monto';
        }
        if (detalle.mejor_a_partir_de) {
          nota_cantidad += ` · mejor precio comprando ${detalle.mejor_a_partir_de}kg+`;
        }

        await delay(600);
      } catch(e) {
        console.log(`  ⚠ Error entrando a ${prod.nombre}: ${e.message}`);
      }
    }

    resultados.push({
      ...prod,
      precio_cantidad,
      nota_cantidad,
    });

    const estado = prod.tiene_oferta ? '🔥 OFERTA' : '';
    const precioShow = precio_cantidad
      ? `$${Math.round(precio_cantidad).toLocaleString('es-AR')}/kg (${config.cantidad_kg}kg)`
      : `$${Math.round(prod.precio_base).toLocaleString('es-AR')}/kg`;
    console.log(`  ${prod.es_enfocado ? '✓' : '·'} ${prod.nombre}: ${precioShow} ${estado}`);
  }

  return resultados;
}

// ═══════════════════════════════════════════════════════
// OFERTAS DE LA SEMANA EN TIENDA MAYORISTA
// ═══════════════════════════════════════════════════════
async function scrapeOfertasSemana(page) {
  console.log('\n  🏷️ Revisando ofertas de la semana...');
  try {
    await page.goto('https://el-sembrador.com.ar/tienda/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(2000);

    const ofertas = await page.evaluate(() => {
      const items = [];
      // Productos con precio tachado (ins = oferta)
      document.querySelectorAll('.product, li.product').forEach(el => {
        const tieneOferta = el.querySelector('ins') && el.querySelector('del');
        if (!tieneOferta) return;
        const nombre = el.querySelector('h2, .woocommerce-loop-product__title')?.innerText?.trim() || '';
        const precioOferta = el.querySelector('ins .woocommerce-Price-amount bdi');
        const precioAntes = el.querySelector('del .woocommerce-Price-amount bdi');
        const limpiar = t => t ? parseFloat(t.innerText.replace(/[^0-9,]/g,'').replace(',','.')) : null;
        const po = limpiar(precioOferta);
        const pa = limpiar(precioAntes);
        if (po && pa && nombre) {
          const pct = Math.round(((pa - po) / pa) * 100);
          items.push({ nombre, precio_oferta: po, precio_antes: pa, descuento_pct: pct });
        }
      });
      return items;
    });

    if (ofertas.length > 0) {
      console.log(`  → ${ofertas.length} productos en oferta esta semana:`);
      ofertas.forEach(o => console.log(`    🔥 ${o.nombre}: $${Math.round(o.precio_oferta).toLocaleString('es-AR')} (antes $${Math.round(o.precio_antes).toLocaleString('es-AR')}, -${o.descuento_pct}%)`));
    } else {
      console.log('  → Sin ofertas detectadas esta semana');
    }
    return ofertas;
  } catch(e) {
    console.log('  ⚠ Error revisando ofertas:', e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// GENERAR REPORTE PARA LUCAS
// ═══════════════════════════════════════════════════════
async function generarReporte(resultadosPorProducto, ofertas, ultimosPrecios) {
  const lineas = [];
  const fecha = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza', weekday: 'long', day: 'numeric', month: 'long' });
  lineas.push(`📊 ANÁLISIS SEMANAL · El Sembrador · ${fecha}`);
  lineas.push('');

  let totalAhorro = 0;

  for (const [config, resultados] of resultadosPorProducto) {
    if (!resultados.length) continue;

    const enfocados = resultados.filter(r => r.es_enfocado);
    const mejor = enfocados[0] || resultados[0];

    lineas.push(`🌿 ${config.nombre_db.toUpperCase()}`);

    // Precio actual vs anterior
    const precioActual = mejor.precio_cantidad || mejor.precio_base;
    const precioAnterior = ultimosPrecios[config.nombre_db];

    if (precioAnterior && precioActual) {
      const var_pct = ((precioActual - precioAnterior) / precioAnterior) * 100;
      const ahorroPosible = Math.round((precioAnterior - precioActual) * config.cantidad_kg);

      if (Math.abs(var_pct) >= 1) {
        const sube = var_pct > 0;
        lineas.push(`${sube ? '📈' : '📉'} ${sube ? 'Subió' : 'Bajó'} ${Math.abs(var_pct).toFixed(1)}% vs última compra`);
        if (!sube && ahorroPosible > 0) {
          lineas.push(`💰 Ahorro en este pedido (${config.cantidad_kg}kg): $${Math.abs(ahorroPosible).toLocaleString('es-AR')}`);
          totalAhorro += Math.abs(ahorroPosible);
        }
      } else {
        lineas.push(`= Precio estable`);
      }
    }

    // Mostrar variantes encontradas
    resultados.forEach(r => {
      const precio_show = r.precio_cantidad
        ? `$${Math.round(r.precio_cantidad).toLocaleString('es-AR')}/kg · ${r.nota_cantidad}`
        : `$${Math.round(r.precio_base).toLocaleString('es-AR')}/kg`;
      const tag = r.es_enfocado ? '✓' : '·';
      const oferta = r.tiene_oferta ? ' 🔥 OFERTA' : '';
      lineas.push(`  ${tag} ${r.nombre}: ${precio_show}${oferta}`);
    });

    // Oportunidades
    const noEnfocado = resultados.find(r => !r.es_enfocado && r.tiene_oferta);
    if (noEnfocado) {
      lineas.push(`  💡 Oportunidad: ${noEnfocado.nombre} en oferta a $${Math.round(noEnfocado.precio_base).toLocaleString('es-AR')}/kg · Lucas decide si conviene`);
    }
    lineas.push('');
  }

  // Ofertas generales de la semana
  if (ofertas.length > 0) {
    lineas.push('🔥 OTRAS OFERTAS ESTA SEMANA');
    ofertas.slice(0, 5).forEach(o => {
      lineas.push(`  · ${o.nombre}: $${Math.round(o.precio_oferta).toLocaleString('es-AR')}/kg (-${o.descuento_pct}%)`);
    });
    lineas.push('');
  }

  // Resumen de ahorro total
  if (totalAhorro > 0) {
    lineas.push(`✅ AHORRO TOTAL ESTIMADO ESTE PEDIDO: $${totalAhorro.toLocaleString('es-AR')}`);
    lineas.push('   (comparado con precios de la última compra)');
  }

  return lineas.join('\n');
}

// ═══════════════════════════════════════════════════════
// GUARDAR PRECIO EN SUPABASE
// ═══════════════════════════════════════════════════════
async function guardarPrecio(prod, proveedor_id, precio_nuevo) {
  if (!prod?.id || !precio_nuevo) return null;
  const { data: ult } = await sb.schema('ops').from('precios_historico')
    .select('precio_sin_iva').eq('producto_id', prod.id).eq('proveedor_id', proveedor_id)
    .order('fecha_registro', {ascending:false}).limit(1).maybeSingle();
  const anterior = ult?.precio_sin_iva || null;
  await sb.schema('ops').from('precios_historico').insert({
    producto_id: prod.id, proveedor_id, precio_sin_iva: precio_nuevo,
    fuente: 'agente', ahorro_vs_anterior: anterior ? anterior - precio_nuevo : 0,
  });
  return anterior;
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

  let browser = null;
  const resultadosPorProducto = [];
  const ultimosPrecios = {};

  try {
    console.log('\n🌐 Iniciando navegador...');
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });

    console.log('\n📦 EL SEMBRADOR');
    await loginSembrador(page);
    await delay(2000);

    // Ofertas de la semana
    const ofertas = await scrapeOfertasSemana(page);
    await delay(1000);

    // Buscar cada producto
    for (const config of PRODUCTOS_SEMBRADOR) {
      const prod = findProd(config.nombre_db);

      // Obtener último precio guardado
      if (prod?.id) {
        const { data: ult } = await sb.schema('ops').from('precios_historico')
          .select('precio_sin_iva').eq('producto_id', prod.id).eq('proveedor_id', provMap['El Sembrador'])
          .order('fecha_registro', {ascending:false}).limit(1).maybeSingle();
        if (ult) ultimosPrecios[config.nombre_db] = ult.precio_sin_iva;
      }

      const resultados = await buscarProducto(page, config);
      resultadosPorProducto.push([config, resultados]);

      // Guardar precio del producto enfocado
      if (prod && resultados.length > 0) {
        const enfocado = resultados.find(r => r.es_enfocado) || resultados[0];
        const precio = enfocado.precio_cantidad || enfocado.precio_base;
        if (precio) await guardarPrecio(prod, provMap['El Sembrador'], precio);
      }

      await delay(1000);
    }

    // Generar reporte
    const reporte = await generarReporte(resultadosPorProducto, ofertas, ultimosPrecios);
    console.log('\n' + reporte);

    // Guardar reporte como alerta para Lucas
    const prodAlmendra = findProd('Almendras Non Pareil');
    await sb.schema('ops').from('alertas').insert({
      producto_id: prodAlmendra?.id || null,
      tipo: 'analisis_proveedor',
      mensaje: reporte,
      datos: { productos_analizados: PRODUCTOS_SEMBRADOR.length, ofertas: ofertas.length },
    });

  } finally {
    if (browser) await browser.close();
  }

  await sb.schema('ops').from('monitoreo_precios').insert({
    proveedor_id: provMap['El Sembrador'],
    productos_revisados: PRODUCTOS_SEMBRADOR.length,
    alerta_generada: true,
    fecha_ejecucion: new Date().toISOString(),
  });

  console.log('\n✅ Monitoreo completado');
  console.log('═'.repeat(55));
}

module.exports = { monitorear };
if (require.main === module) monitorear().catch(console.error);
