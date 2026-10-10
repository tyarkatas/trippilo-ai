
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "POST isteği gerekli.",
    });
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const setupKey = (process.env.TELEGRAM_SETUP_KEY || "").trim();
  const auth = req.headers.authorization || "";

  if (!token || !secret || !setupKey) {
    return res.status(500).json({
      ok: false,
      error: "Production ortam değişkenleri eksik.",
    });
  }

  if (auth !== `Bearer ${setupKey}`) {
    return res.status(401).json({
      ok: false,
      error: "Kurulum yetkilendirmesi başarısız.",
    });
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return res.status(400).json({
      ok: false,
      error: "TELEGRAM_WEBHOOK_SECRET yalnızca harf, rakam, _ ve - içermeli.",
    });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://trippilo-ai.vercel.app/api/telegram",
          secret_token: secret,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram setWebhook hatası:", result.description);
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
    console.error("Webhook kurulum bağlantı hatası:", error?.message);
    return res.status(502).json({
      ok: false,
      error: "Telegram sunucusuna bağlanılamadı.",
    });
  }
}
