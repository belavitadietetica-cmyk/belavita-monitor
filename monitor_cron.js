const cron = require('node-cron');
const http = require('http');

console.log('🕐 Belavita Monitor iniciado');
console.log('📅 Corre automáticamente: Lunes, Miércoles y Viernes a las 8am (Mendoza)');

// ── Función principal de ejecución ──
const ejecutar = async (dia) => {
  console.log(`\n⏰ Iniciando monitoreo ${dia}...`);
  try {
    delete require.cache[require.resolve('./monitor_precios')];
    const { monitorear } = require('./monitor_precios');
    await monitorear();
    console.log('✅ Monitoreo completado');
  } catch(e) { console.error('❌ Error en monitoreo:', e.message, e.stack); }
};

// ── Lunes 8am ──
cron.schedule('0 8 * * 1', () => ejecutar('Lunes'), { timezone: 'America/Argentina/Mendoza' });
// ── Miércoles 8am ──
cron.schedule('0 8 * * 3', () => ejecutar('Miércoles'), { timezone: 'America/Argentina/Mendoza' });
// ── Viernes 8am ──
cron.schedule('0 8 * * 5', () => ejecutar('Viernes'), { timezone: 'America/Argentina/Mendoza' });

// ── Servidor HTTP con CORS ──
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      servicio: 'Belavita Monitor',
      schedule: 'Lunes, Miércoles y Viernes 8am Mendoza',
      hora: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/monitorear') {
    console.log('▶ Monitoreo manual iniciado desde la app...');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mensaje: 'Monitoreo iniciado · puede tardar hasta 10 minutos' }));
    setImmediate(() => ejecutar('Manual'));
    return;
  }

  res.writeHead(404); res.end('{"error":"no encontrado"}');
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`🚀 Servidor en puerto ${process.env.PORT || 3001}`);
});
