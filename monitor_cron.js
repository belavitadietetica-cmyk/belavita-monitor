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

// Servidor HTTP con CORS
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      servicio: 'Belavita Monitor',
      hora: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/monitorear') {
    console.log('▶ Monitoreo manual iniciado desde la app...');
    
    // Responder inmediatamente para que la app no quede esperando
    // El monitoreo corre en background y la app va a buscar los resultados
    // cuando el usuario refresca o vuelve al panel
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mensaje: 'Monitoreo iniciado — puede tardar hasta 10 minutos' }));

    // Correr el monitoreo después de responder
    setImmediate(async () => {
      try {
        // Limpiar cache del módulo para que tome cambios
        delete require.cache[require.resolve('./monitor_precios')];
        const { monitorear } = require('./monitor_precios');
        await monitorear();
        console.log('✅ Monitoreo manual completado');
      } catch(e) { 
        console.error('❌ Error en monitoreo:', e.message); 
      }
    });
    return;
  }

  // Estado del monitoreo
  if (req.method === 'GET' && req.url === '/estado') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ corriendo: false, hora: new Date().toISOString() }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`🚀 Servidor en puerto ${process.env.PORT || 3001}`);
});
