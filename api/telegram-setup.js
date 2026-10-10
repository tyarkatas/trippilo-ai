
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const setupKey = (process.env.TELEGRAM_SETUP_KEY || "").trim();
  const suppliedKey = String(req.query.key || "").trim();

  if (!token || !secret || !setupKey) {
    return res.status(500).json({
      ok: false,
      error: "Production ortam değişkenleri eksik.",
    });
  }

  if (suppliedKey !== setupKey) {
    return res.status(401).json({
      ok: false,
      error: "TELEGRAM_SETUP_KEY eşleşmiyor.",
    });
  }

  if (secret.length < 1 || secret.length > 256) {
    return res.status(400).json({
      ok: false,
      error: "TELEGRAM_WEBHOOK_SECRET boş veya çok uzun.",
    });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://trippilo-ai.vercel.app/api/telegram",
          secret_token: secret,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram webhook kurulamadı:", result.description);

      return res.status(502).json({
        ok: false,
        error: "Telegram webhook kurulamadı.",
        description: result.description || "Telegram API hatası.",
      });
    }

    return res.status(200).json({
      ok: true,
      description: "Telegram webhook başarıyla kuruldu.",
    });
  } catch (error) {
    console.error("Webhook kurulum hatası:", error?.message);

    return res.status(502).json({
      ok: false,
      error: "Telegram sunucusuna bağlanılamadı.",
    });
  }
}
