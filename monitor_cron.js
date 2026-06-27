const cron = require('node-cron');
const http = require('http');

console.log('🕐 Belavita Monitor iniciado · esperando lunes 8am...');

// Todos los lunes a las 8am hora Mendoza
cron.schedule('0 11 * * 1', async () => {
  console.log('⏰ Iniciando monitoreo semanal automático...');
  try {
    const { monitorear } = require('./monitor_precios');
    await monitorear();
  } catch(e) { console.error(e); }
}, { timezone: 'America/Argentina/Mendoza' });

// Servidor HTTP con CORS habilitado
const server = http.createServer(async (req, res) => {
  // Headers CORS — permite llamadas desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', servicio: 'Belavita Monitor', hora: new Date().toISOString() }));
    return;
  }

  // Monitoreo manual desde la app
  if (req.method === 'POST' && req.url === '/monitorear') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mensaje: 'Monitoreo iniciado' }));
    console.log('▶ Monitoreo manual iniciado desde la app...');
    try {
      const { monitorear } = require('./monitor_precios');
      await monitorear();
      console.log('✅ Monitoreo manual completado');
    } catch(e) { console.error('Error en monitoreo:', e); }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`🚀 Servidor escuchando en puerto ${process.env.PORT || 3001}`);
});
