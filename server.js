const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ────────────────────────────────────────────────────────────────────
// En producción, reemplaza el "*" por el dominio exacto de tu frontend
// Ej: origin: "https://tusitioweb.com"
app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Constantes ──────────────────────────────────────────────────────────────
const BINANCE_P2P_URL =
  "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

// ─── Helper: consulta P2P ────────────────────────────────────────────────────
async function queryBinanceP2P(fiat, tradeType, rows = 5) {
  const body = {
    fiat,
    page: 1,
    rows,
    tradeType,       // "BUY" o "SELL"
    asset: "USDT",
    countries: [],
    proMerchantAds: false,
    shieldMerchantAds: false,
    filterType: "all",
    periods: [],
    additionalKycVerifyFilter: 0,
    publisherType: null,
    payTypes: [],
    classifies: ["mass", "profession"],
  };

  const res = await fetch(BINANCE_P2P_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Binance P2P respondió con status ${res.status}`);
  }

  const data = await res.json();

  if (!data.data || data.data.length === 0) {
    throw new Error(`Sin anuncios P2P para ${fiat} / ${tradeType}`);
  }

  // Devuelve los precios individuales y el promedio
  const prices = data.data.map((d) => parseFloat(d.adv.price));
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  return {
    fiat,
    tradeType,
    asset: "USDT",
    prices,          // lista de precios de los mejores anuncios
    average: avg,    // promedio usado por el frontend
    timestamp: new Date().toISOString(),
  };
}

// ─── Ruta principal: tasas para Chile → Bolivia ───────────────────────────────
// GET /api/rates
// Devuelve: tasa CLP/USDT (BUY desde Chile) y BOB/USDT (SELL en Bolivia)
app.get("/api/rates", async (req, res) => {
  try {
    const [clpData, bobData] = await Promise.all([
      queryBinanceP2P("CLP", "BUY"),   // Compra USDT en Chile (pagas CLP)
      queryBinanceP2P("BOB", "SELL"),  // Vende USDT en Bolivia (recibes BOB)
    ]);

    res.json({
      ok: true,
      clp: clpData,
      bob: bobData,
    });
  } catch (err) {
    console.error("[/api/rates] Error:", err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ─── Ruta de cotización: calcula el envío ────────────────────────────────────
// GET /api/quote?amount=100000
// Devuelve: desglose completo con margen del 1%
const SERVICE_FEE = 0.01; // 1%

app.get("/api/quote", async (req, res) => {
  const amount = parseFloat(req.query.amount);

  if (!amount || amount <= 0) {
    return res
      .status(400)
      .json({ ok: false, error: "Parámetro 'amount' inválido (CLP)" });
  }

  try {
    const [clpData, bobData] = await Promise.all([
      queryBinanceP2P("CLP", "BUY"),
      queryBinanceP2P("BOB", "SELL"),
    ]);

    const rateClpUsdt = clpData.average;
    const rateUsdtBob = bobData.average;

    const usdtGross   = amount / rateClpUsdt;
    const feeUsdt     = usdtGross * SERVICE_FEE;
    const usdtNet     = usdtGross - feeUsdt;
    const bobReceived = usdtNet * rateUsdtBob;

    res.json({
      ok: true,
      input: { amount, currency: "CLP" },
      rates: {
        clpPerUsdt: rateClpUsdt,
        bobPerUsdt: rateUsdtBob,
      },
      breakdown: {
        usdtGross: usdtGross.toFixed(6),
        feePercent: SERVICE_FEE * 100,
        feeUsdt: feeUsdt.toFixed(6),
        usdtNet: usdtNet.toFixed(6),
        bobReceived: bobReceived.toFixed(2),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/quote] Error:", err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ RemesasFácil proxy corriendo en http://localhost:${PORT}`);
  console.log(`   GET /api/rates          → tasas CLP y BOB`);
  console.log(`   GET /api/quote?amount=X → cotización completa`);
});
