
import { randomUUID } from "node:crypto";

const PRODUCTS = {
  travel_plan: {
    env: "TRIPPILO_TRAVEL_PLAN_PRICE",
    description: "TripPilo AI - Seyahat Plani"
  },
  membership: {
    env: "TRIPPILO_MEMBERSHIP_PRICE",
    description: "TripPilo AI - Yillik Pro Uyelik"
  }
};

const ALLOWED_ORIGIN = "https://trippilo-ai.vercel.app";

function validOrigin(req) {
  const origin = req.headers.origin;
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

function providerErrorMessage(payment) {
  const message =
    payment?.message ||
    payment?.error ||
    payment?.description;

  if (typeof message === "string") {
    return message.slice(0, 500);
  }

  return "Saglayici ayrintili hata mesaji dondurmedi.";
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
    console.error("Payment configuration missing", {
      api_key_present: Boolean(apiKey),
      supabase_config_present: Boolean(config)
    });

    return res.status(500).json({
      error: "Sunucu ayarlari eksik. Vercel ortam degiskenlerini kontrol edin."
    });
  }

  const amount = Number(process.env[product.env]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(500).json({
      error: "Urun fiyati ayarlanmamis veya gecersiz.",
      price_variable: product.env
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
      const dbError = await insert.text().catch(() => "");

      console.error("Payment order insert failed", {
        http_status: insert.status,
        details: dbError.slice(0, 500),
        order_id: orderId
      });

      return res.status(502).json({
        error: "Siparis veritabanina kaydedilemedi. Supabase ayarlarini kontrol edin."
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

    const responseText = await response.text();
    let payment = {};

    try {
      payment = responseText ? JSON.parse(responseText) : {};
    } catch {
      payment = {};
    }

    if (!response.ok || !payment.payment_id) {
      const providerMessage = providerErrorMessage(payment);
      const providerCode =
        payment?.code || payment?.error_code || null;

      console.error("NOWPayments create-payment failed", {
        http_status: response.status,
        provider_message: providerMessage,
        provider_code: providerCode,
        order_id: orderId,
        product_type,
        amount
      });

      await updateOrder(config, orderId, {
        status: "failed"
      }).catch((error) => {
        console.error("Failed to update payment status", {
          order_id: orderId,
          message: error?.message || "Unknown error"
        });
      });

      return res.status(502).json({
        error: "NOWPayments odeme olusturamadi.",
        provider_status: response.status,
        provider_message: providerMessage,
        provider_code: providerCode
      });
    }

    const update = await updateOrder(config, orderId, {
      payment_id: String(payment.payment_id),
      status: "waiting"
    });

    if (!update.ok) {
      console.error("Payment created but order update failed", {
        order_id: orderId,
        payment_id: String(payment.payment_id),
        http_status: update.status
      });

      return res.status(502).json({
        error: "Odeme saglayicida olustu ancak siparis kaydi guncellenemedi. Ayni odemeyi tekrar olusturmadan once kaydi kontrol edin.",
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
  } catch (error) {
    console.error("Payment request failed", {
      order_id: orderId,
      message: error?.message || "Unknown error"
    });

    return res.status(500).json({
      error: "Odeme istegi islenemedi. Vercel Function Logs kayitlarini kontrol edin."
    });
  }
}
