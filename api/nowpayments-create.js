
import { randomUUID } from "node:crypto";

const PRODUCTS = {
  travel_plan: {
    env: "TRIPPILO_TRAVEL_PLAN_PRICE",
    description: "TripPilo AI - Seyahat Plani"
  },
  membership: {
    env: "TRIPPILO_MEMBERSHIP_PRICE",
    description: "TripPilo AI - Uyelik"
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Yalnizca POST destekleniyor." });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Sunucu ayarlari eksik." });
  }

  const { product_type } = req.body || {};
  const product = PRODUCTS[product_type];

  if (!product) {
    return res.status(400).json({
      error: "product_type travel_plan veya membership olmali."
    });
  }

  const amount = Number(process.env[product.env]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(500).json({ error: "Urun fiyati ayarlanmamis." });
  }

  const orderId = randomUUID();
  const base = supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json"
  };

  try {
    const insert = await fetch(`${base}/rest/v1/payments`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        order_id: orderId,
        product_type,
        amount,
        currency: "usd",
        status: "pending"
      })
    });

    if (!insert.ok) {
      return res.status(502).json({ error: "Siparis kaydedilemedi." });
    }

    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        order_id: orderId,
        order_description: product.description,
        ipn_callback_url:
          "https://trippilo-ai.vercel.app/api/nowpayments-ipn"
      })
    });

    const payment = await response.json().catch(() => ({}));

    if (!response.ok || !payment.payment_id) {
      const failedUrl = new URL(`${base}/rest/v1/payments`);
      failedUrl.searchParams.set("order_id", `eq.${orderId}`);

      await fetch(failedUrl, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "failed",
          updated_at: new Date().toISOString()
        })
      });

      return res.status(502).json({
        error: "Odeme olusturulamadi; saglayici ayarlarini kontrol edin."
      });
    }

    const updateUrl = new URL(`${base}/rest/v1/payments`);
    updateUrl.searchParams.set("order_id", `eq.${orderId}`);

    const update = await fetch(updateUrl, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        payment_id: String(payment.payment_id),
        status: "waiting",
        updated_at: new Date().toISOString()
      })
    });

    if (!update.ok) {
      return res.status(502).json({ error: "Odeme kaydi guncellenemedi." });
    }

    return res.status(201).json({
      order_id: orderId,
      payment_id: String(payment.payment_id),
      payment_status: payment.payment_status || "waiting",
      pay_address: payment.pay_address || null,
      pay_amount: payment.pay_amount ?? null,
      pay_currency: payment.pay_currency || null,
      price_amount: amount,
      price_currency: "usd"
    });
  } catch {
    return res.status(500).json({ error: "Odeme istegi islenemedi." });
  }
}
