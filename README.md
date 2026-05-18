[README.md](https://github.com/user-attachments/files/27976435/README.md)
# RemesasFácil — Proxy Binance P2P

## Instalación local

```bash
# 1. Entra a la carpeta
cd remesas-proxy

# 2. Instala dependencias
npm install

# 3. Inicia el servidor
npm start
# → Corriendo en http://localhost:3001
```

## Rutas disponibles

| Ruta | Descripción |
|------|-------------|
| `GET /health` | Verifica que el servidor esté activo |
| `GET /api/rates` | Retorna tasas CLP/USDT y BOB/USDT desde Binance P2P |
| `GET /api/quote?amount=100000` | Cotización completa con desglose y margen del 1% |

### Ejemplo de respuesta `/api/quote?amount=100000`

```json
{
  "ok": true,
  "input": { "amount": 100000, "currency": "CLP" },
  "rates": {
    "clpPerUsdt": 985.5,
    "bobPerUsdt": 6.93
  },
  "breakdown": {
    "usdtGross": "101.470828",
    "feePercent": 1,
    "feeUsdt": "1.014708",
    "usdtNet": "100.456120",
    "bobReceived": "696.16"
  },
  "timestamp": "2025-05-18T12:00:00.000Z"
}
```

## Despliegue en producción

### Opción A — Railway (recomendado, gratis)
1. Crea cuenta en https://railway.app
2. "New Project" → "Deploy from GitHub" o sube la carpeta
3. Railway detecta el `package.json` automáticamente
4. Copia la URL pública (ej: `https://remesas-proxy.up.railway.app`)

### Opción B — Render (gratis)
1. Crea cuenta en https://render.com
2. "New Web Service" → conecta tu repositorio GitHub
3. Build command: `npm install`
4. Start command: `npm start`

### Opción C — VPS propio (DigitalOcean, Contabo, etc.)
```bash
# Instalar PM2 para mantenerlo activo
npm install -g pm2
pm2 start server.js --name remesas-proxy
pm2 save
pm2 startup
```

## Conectar con el frontend

En tu HTML/JS, reemplaza las llamadas directas a Binance por:

```javascript
// Antes (fallaba por CORS)
fetch("https://p2p.binance.com/bapi/c2c/v2/...")

// Ahora (via tu proxy)
fetch("https://TU-DOMINIO.railway.app/api/rates")
  .then(r => r.json())
  .then(data => {
    const rateClpUsdt = data.clp.average;
    const rateUsdtBob = data.bob.average;
    // ... tu lógica de cálculo
  });
```

## Seguridad recomendada para producción

En `server.js`, línea 12, cambia:
```js
// ❌ Permite cualquier origen
app.use(cors({ origin: "*" }));

// ✅ Solo tu dominio
app.use(cors({ origin: "https://tusitioweb.com" }));
```
