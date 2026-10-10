
import { createHmac, timingSafeEqual } from "node:crypto";

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = sortObject(value[key]);
      return out;
    }, {});
  }
  return value;
}

function validSignature(signature, expected) {
  if (typeof signature !== "string") return false;
  const a = Buffer.from(signature.toLowerCase(), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const statuses = new Set([
  "waiting", "confirming", "confirmed", "sending",
  "partially_paid", "finished", "failed", "refunded", "expired"
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!ipnSecret || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Server configuration missing" });
  }

  const body = req.body;
  const signature = req.headers["x-nowpayments-sig"];

  if (!body || typeof body !== "object" || Array.isArray(body) || !signature) {
    return res.status(400).json({ error: "Invalid notification" });
  }

  const payload = JSON.stringify(sortObject(body));
  const expected = createHmac("sha512", ipnSecret)
    .update(payload)
    .digest("hex");

  if (!validSignature(signature, expected)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const orderId = body.order_id;
  const status = body.payment_status;

  if (!orderId || !statuses.has(status)) {
    return res.status(400).json({ error: "Invalid order or status" });
  }

  const base = supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json"
  };

  try {
    const query = new URL(`${base}/rest/v1/payments`);
    query.searchParams.set("select", "order_id,payment_id,amount,currency");
    query.searchParams.set("order_id", `eq.${orderId}`);
    query.searchParams.set("limit", "1");

    const found = await fetch(query, { headers });
    if (!found.ok) {
      return res.status(502).json({ error: "Order lookup failed" });
    }

    const rows = await found.json();
    const order = rows[0];
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.payment_id && body.payment_id &&
        String(order.payment_id) !== String(body.payment_id)) {
      return res.status(409).json({ error: "Payment ID mismatch" });
    }

    if (body.price_amount != null &&
        Math.abs(Number(body.price_amount) - Number(order.amount)) > 0.01) {
      return res.status(409).json({ error: "Amount mismatch" });
    }

    if (body.price_currency &&
        String(body.price_currency).toLowerCase() !==
        String(order.currency).toLowerCase()) {
      return res.status(409).json({ error: "Currency mismatch" });
    }

    const updateUrl = new URL(`${base}/rest/v1/payments`);
    updateUrl.searchParams.set("order_id", `eq.${orderId}`);

    const update = await fetch(updateUrl, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        payment_id: body.payment_id ? String(body.payment_id) : order.payment_id,
        status,
        updated_at: new Date().toISOString()
      })
    });

    if (!update.ok) {
      return res.status(502).json({ error: "Payment update failed" });
    }

    return res.status(200).json({ received: true });
  } catch {
    return res.status(500).json({ error: "Notification processing failed" });
  }
}
