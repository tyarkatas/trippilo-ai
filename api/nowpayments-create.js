
import { randomUUID } from "node:crypto";

const PRODUCTS = {
  travel_plan: {
    env: "TRIPPILO_TRAVEL_PLAN_PRICE",
    description: "TripPilo AI - Seyahat Plani",
  },
  membership: {
    env: "TRIPPILO_MEMBERSHIP_PRICE",
    description: "TripPilo AI Pro - Uyelik",
  },
};

const ALLOWED_ORIGIN = "https://trippilo-ai.vercel.app";
const PAY_CURRENCY = "usdttrc20";

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
      "Content-Type": "application/json",
    },
  };
}

async function updateOrder(config, orderId, values) {
  const url = new URL(`${config.base}/rest/v1/payments`);
  url.searchParams.set("order_id", `eq.${orderId}`);

  return fetch(url, {
    method: "PATCH",
    headers: {
      ...config.headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ...values,
      updated_at: new Date().toISOString(),
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Yalnizca POST destekleniyor.",
    });
  }

  if (!validOrigin(req)) {
    return res.status(403).json({
      error: "Istek kaynagi kabul edilmiyor.",
    });
  }

  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      error: "Gecersiz istek govdesi.",
    });
  }

  const { product_type } = req.body;
  const product = PRODUCTS[product_type];

  if (!product) {
    return res.status(400).json({
      error: "product_type travel_plan veya membership olmali.",
    });
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const config = getSupabaseConfig();

  if (!apiKey || !config) {
    console.error("Payment configuration missing", {
      hasApiKey: Boolean(apiKey),
      hasSupabaseConfig: Boolean(config),
    });

    return res.status(500).json({
      error: "Sunucu ayarlari eksik.",
    });
  }

  const amount = Number(process.env[product.env]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(500).json({
      error: "Urun fiyati ayarlanmamis.",
    });
  }

  const orderId = randomUUID();

  try {
    // 1. Siparisi Supabase'e kaydet.
    const insert = await fetch(
      `${config.base}/rest/v1/payments`,
      {
        method: "POST",
        headers: {
          ...config.headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          order_id: orderId,
          product_type,
          amount,
          currency: "usd",
          status: "pending",
        }),
      }
    );

    if (!insert.ok) {
      const details = await insert.text().catch(() => "");

      console.error("Supabase order insert failed", {
        status: insert.status,
        details: details.slice(0, 1000),
        orderId,
        product_type,
      });

      return res.status(502).json({
        error: "Siparis Supabase'e kaydedilemedi.",
      });
    }

    // 2. NOWPayments'te USDT TRC-20 odemesi olustur.
    const response = await fetch(
      "https://api.nowpayments.io/v1/payment",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: "usd",
          pay_currency: PAY_CURRENCY,
          order_id: orderId,
          order_description: product.description,
          ipn_callback_url:
            "https://trippilo-ai.vercel.app/api/nowpayments-ipn",
        }),
      }
    );

    const rawResponse = await response.text();
    let payment = {};

    try {
      payment = rawResponse ? JSON.parse(rawResponse) : {};
    } catch {
      payment = {};
    }

    if (!response.ok || !payment.payment_id) {
      console.error("NOWPayments create-payment failed", {
        http_status: response.status,
        provider_message:
          payment.message ||
          payment.error ||
          "Saglayicidan ayrintili hata mesaji gelmedi.",
        provider_code: payment.code || null,
        order_id: orderId,
        product_type,
        amount,
      });

      await updateOrder(config, orderId, {
        status: "failed",
      }).catch((error) => {
        console.error("Failed to update order status", {
          orderId,
          message: error.message,
        });
      });

      return res.status(502).json({
        error: "NOWPayments odemesi olusturulamadi.",
        provider_status: response.status,
        provider_message:
          payment.message ||
          payment.error ||
          "Saglayicidan ayrintili hata mesaji gelmedi.",
        provider_code: payment.code || null,
        order_id: orderId,
      });
    }

    // 3. Olusturulan odemeyi siparis kaydina bagla.
    const update = await updateOrder(config, orderId, {
      payment_id: String(payment.payment_id),
      status: payment.payment_status || "waiting",
    });

    if (!update.ok) {
      console.error("Supabase order update failed", {
        http_status: update.status,
        order_id: orderId,
        payment_id: String(payment.payment_id),
      });

      return res.status(502).json({
        error:
          "Odeme olustu ancak siparis kaydi guncellenemedi. Destekle iletisime gecin.",
        order_id: orderId,
      });
    }

    // 4. Frontend'e odeme bilgilerini dondur.
    return res.status(201).json({
      order_id: orderId,
      payment_id: String(payment.payment_id),
      payment_status: payment.payment_status || "waiting",
      pay_address: payment.pay_address || null,
      pay_amount: payment.pay_amount ?? null,
      pay_currency: payment.pay_currency || PAY_CURRENCY,
      price_amount: amount,
      price_currency: "usd",
    });
  } catch (error) {
    console.error("Payment creation exception", {
      message: error.message,
      order_id: orderId,
      product_type,
    });

    return res.status(500).json({
      error: "Odeme istegi islenemedi.",
    });
  }
}
