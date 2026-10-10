
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

const ALLOWED_ORIGIN = "https://trippilo-ai.vercel.app";

function validOrigin(req) {
  const origin = req.headers.origin;

  // Origin olmayan sunucu isteklerini de destekle.
  // Bu kontrol tek başına kimlik doğrulama değildir.
  return !origin || origin === ALLOWED_ORIGIN;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) return null;

  return {
    base: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    }
  };
}

async function updateOrder(config, orderId, values) {
  const url = new URL(`${config.base}/rest/v1/payments`);
  url.searchParams.set("order_id", `eq.${orderId}`);

  return fetch(url, {
    method: "PATCH",
    headers: {
      ...config.headers,
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      ...values,
      updated_at: new Date().toISOString()
    })
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Yalnizca POST destekleniyor."
    });
  }

  if (!validOrigin(req)) {
    return res.status(403).json({
      error: "Istek kaynagi kabul edilmiyor."
    });
  }

  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      error: "Gecersiz istek govdesi."
    });
  }

  const { product_type } = req.body;
  const product = PRODUCTS[product_type];

  if (!product) {
    return res.status(400).json({
      error: "product_type travel_plan veya membership olmali."
    });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const config = getSupabaseConfig();

  if (!apiKey || !config) {
    return res.status(500).json({
      error: "Sunucu ayarlari eksik."
    });
  }

  const amount = Number(process.env[product.env]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(500).json({
      error: "Urun fiyati ayarlanmamis."
    });
  }

  const orderId = randomUUID();

  try {
    const insert = await fetch(
      `${config.base}/rest/v1/payments`,
      {
        method: "POST",
        headers: {
          ...config.headers,
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          order_id: orderId,
          product_type,
          amount,
          currency: "usd",
          status: "pending"
        })
      }
    );

    if (!insert.ok) {
      return res.status(502).json({
        error: "Siparis kaydedilemedi."
      });
    }

    const response = await fetch(
      "https://api.nowpayments.io/v1/payment",
      {
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
      }
    );

    const payment = await response.json().catch(() => ({}));

    if (!response.ok || !payment.payment_id) {
      await updateOrder(config, orderId, {
        status: "failed"
      }).catch(() => null);

      return res.status(502).json({
        error: "Odeme olusturulamadi. Saglayici ayarlarini kontrol edin."
      });
    }

    const update = await updateOrder(config, orderId, {
      payment_id: String(payment.payment_id),
      status: "waiting"
    });

    if (!update.ok) {
      // Odeme saglayicida olusmus olabilir.
      // Bu durumda yeni odeme olusturmayin; kaydi kontrol edin.
      return res.status(502).json({
        error: "Odeme olustu ancak siparis kaydi guncellenemedi. Destekle iletisime gecin.",
        order_id: orderId
      });
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
    return res.status(500).json({
      error: "Odeme istegi islenemedi."
    });
  }
}
