// ═══════════════════════════════════════════════════════
// BELAVITA OPS · Cron job - todos los lunes a las 8am
// Subir este archivo a Railway como servicio separado
// ═══════════════════════════════════════════════════════
const cron = require('node-cron');

console.log('🕐 Belavita Monitor iniciado · esperando lunes 8am...');

// Todos los lunes a las 8:00 AM (hora Argentina = UTC-3)
cron.schedule('0 11 * * 1', async () => {
  console.log('⏰ Iniciando monitoreo semanal...');
  const { monitorear } = require('./monitor_precios');
  await monitorear().catch(console.error);
}, {
  timezone: 'America/Argentina/Mendoza'
});

// También se puede ejecutar manualmente desde la app
// via botón en la UI que llama a POST /monitorear
const http = require('http');
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/monitorear') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mensaje: 'Monitoreo iniciado' }));
    const { monitorear } = require('./monitor_precios');
    await monitorear().catch(console.error);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Belavita Monitor activo');
  }
}).listen(process.env.PORT || 3001);
