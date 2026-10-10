export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_SETUP_KEY } =
    process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !TELEGRAM_SETUP_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Gerekli Preview ortam değişkenleri eksik.",
    });
  }

  if (req.query.key !== TELEGRAM_SETUP_KEY) {
    return res.status(401).json({ ok: false, error: "Yetkisiz istek." });
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(TELEGRAM_WEBHOOK_SECRET)) {
    return res.status(400).json({
      ok: false,
      error: "Webhook secret yalnızca harf, rakam, _ ve - içerebilir.",
    });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://${req.headers.host}/api/telegram`,
          secret_token: TELEGRAM_WEBHOOK_SECRET,
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
