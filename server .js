const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

async function queryBinanceP2P(fiat, tradeType, rows = 10) {
  const body = {
    fiat,
    page: 1,
    rows,
    tradeType,
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

  const response = await axios.post(BINANCE_P2P_URL, body, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const data = response.data;

  if (!data.data || data.data.length === 0) {
    throw new Error(`Sin anuncios P2P para ${fiat} / ${tradeType}`);
  }

  const prices = data.data.map((d) => parseFloat(d.adv.price));
  const slice = prices.slice(4, 10);
  const avg = slice.reduce((a, b) => a + b, 0) / slice.length;

  return { fiat, tradeType, asset: "USDT", prices, slice, average: avg, timestamp: new Date().toISOString() };
}

app.get("/api/rates", async (req, res) => {
  try {
    const [clpData, bobData] = await Promise.all([
      queryBinanceP2P("CLP", "BUY"),
      queryBinanceP2P("BOB", "SELL"),
    ]);
    res.json({ ok: true, clp: clpData, bob: bobData });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

const SERVICE_FEE = 0.015;

app.get("/api/quote", async (req, res) => {
  const amount = parseFloat(req.query.amount);
  if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: "Amount inválido" });
  try {
    const [clpData, bobData] = await Promise.all([
      queryBinanceP2P("CLP", "BUY"),
      queryBinanceP2P("BOB", "SELL"),
    ]);
    const usdtGross = amount / clpData.average;
    const usdtNet = usdtGross * (1 - SERVICE_FEE);
    const bobReceived = usdtNet * bobData.average;
    res.json({ ok: true, rates: { clpPerUsdt: clpData.average, bobPerUsdt: bobData.average }, breakdown: { bobReceived: bobReceived.toFixed(2) }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
