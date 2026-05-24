const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

async function queryBinanceP2P(fiat, tradeType) {
  var body = {
    fiat: fiat,
    page: 1,
    rows: 10,
    tradeType: tradeType,
    asset: "USDT",
    countries: [],
    proMerchantAds: false,
    shieldMerchantAds: false,
    filterType: "all",
    periods: [],
    additionalKycVerifyFilter: 0,
    publisherType: null,
    payTypes: [],
    classifies: ["mass", "profession"]
  };

  var response = await axios.post(BINANCE_P2P_URL, body, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  var data = response.data;

  if (!data.data || data.data.length === 0) {
    throw new Error("Sin anuncios para " + fiat);
  }

  var prices = data.data.map(function(d) {
    return parseFloat(d.adv.price);
  });

  var slice = prices.slice(4, 10);
  if (slice.length === 0) slice = prices;
  var avg = slice.reduce(function(a, b) { return a + b; }, 0) / slice.length;

  return {
    fiat: fiat,
    tradeType: tradeType,
    prices: prices,
    average: avg,
    timestamp: new Date().toISOString()
  };
}

app.get("/health", function(req, res) {
  res.json({ status: "ok" });
});

app.get("/api/rates", async function(req, res) {
  try {
    var clp = await queryBinanceP2P("CLP", "BUY");
    var bob = await queryBinanceP2P("BOB", "SELL");
    res.json({ ok: true, clp: clp, bob: bob });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.get("/api/quote", async function(req, res) {
  var amount = parseFloat(req.query.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ ok: false, error: "Amount invalido" });
  }
  try {
    var clp = await queryBinanceP2P("CLP", "BUY");
    var bob = await queryBinanceP2P("BOB", "SELL");
    var FEE = 0.015;
    var usdt = amount / clp.average;
    var usdtNet = usdt * (1 - FEE);
    var bobTotal = usdtNet * bob.average;
    res.json({
      ok: true,
      clpPerUsdt: clp.average,
      bobPerUsdt: bob.average,
      bobReceived: bobTotal.toFixed(2),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, function() {
  console.log("Servidor en puerto " + PORT);
});
