
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const setupKey = process.env.TELEGRAM_SETUP_KEY;
  const suppliedKey = req.query.key;

  if (!token || !secret || !setupKey) {
    return res.status(500).json({
      ok: false,
      error: "Production ortam değişkenleri eksik.",
    });
  }

  if (suppliedKey !== setupKey) {
    return res.status(401).json({
      ok: false,
      error: "Yetkisiz istek.",
    });
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return res.status(400).json({
      ok: false,
      error: "Webhook secret geçersiz. Yalnızca harf, rakam, _ ve - kullan.",
    });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://${req.headers.host}/api/telegram`,
          secret_token: secret,
        }),
      }
    );

    const result = await response.json();

    return res.status(response.ok && result.ok ? 200 : 502).json({
      ok: Boolean(response.ok && result.ok),
      description: result.description || "Telegram webhook kurulumu tamamlandı.",
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Telegram sunucusuna bağlanılamadı.",
    });
  }
}
