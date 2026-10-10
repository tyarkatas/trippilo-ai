```javascript
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "TripPilo Telegram Bot",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken || !webhookSecret) {
    return res.status(500).json({
      error: "Telegram environment variables are missing",
    });
  }

  const receivedSecret =
    req.headers["x-telegram-bot-api-secret-token"];

  if (receivedSecret !== webhookSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const update = req.body;

  try {
    // Kullanıcı mesajı
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || "").trim();

      if (text === "/start") {
        await sendMessage(
          botToken,
          chatId,
          "Merhaba! 👋 Ben TripPilo AI.\n\nSeyahat planı hazırlamak için bir şehir adı yaz. Örnek: İstanbul"
        );
        return res.status(200).json({ ok: true });
      }

      if (text.startsWith("/")) {
        await sendMessage(
          botToken,
          chatId,
          "Seyahat planı oluşturmak için bir şehir adı yazabilirsin. Örnek: Kapadokya"
        );
        return res.status(200).json({ ok: true });
      }

      if (!text) {
        return res.status(200).json({ ok: true });
      }

      await sendMessage(
        botToken,
        chatId,
        `📍 ${text} için nasıl bir seyahat planı istersin?`,
        {
          inline_keyboard: [
            [
              { text: "🏛️ Kültür", callback_data: `plan|${text}|culture` },
              { text: "🍽️ Yemek", callback_data: `plan|${text}|food` },
            ],
            [
              { text: "🏞️ Doğa", callback_data: `plan|${text}|nature` },
              { text: "🎒 Genel gezi", callback_data: `plan|${text}|general` },
            ],
          ],
        }
      );
    }

    // Kullanıcı seyahat türünü seçti
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const data = callback.data || "";

      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id }),
      });

      const parts = data.split("|");
      if (parts[0] !== "plan" || parts.length < 3) {
        return res.status(200).json({ ok: true });
      }

      const destination = parts[1];
      const travelType = parts[2];

      await sendMessage(
        botToken,
        chatId,
        `⏳ ${destination} için seyahat planını hazırlıyorum...`
      );

      const origin = `https://${req.headers.host}`;

      const planResponse = await fetch(`${origin}/api/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, travelType }),
      });

      const result = await planResponse.json();

      if (!planResponse.ok || !result.plan) {
        await sendMessage(
          botToken,
          chatId,
          "Üzgünüm, plan oluşturulamadı. Lütfen tekrar dene."
        );
        return res.status(200).json({ ok: true });
      }

      // Telegram mesaj uzunluğu sınırına yaklaşmamak için böl
      const plan = String(result.plan);
      const chunks = plan.match(/[\s\S]{1,3500}/g) || [];

      for (const chunk of chunks) {
        await sendMessage(botToken, chatId, chunk);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram bot error:", error);

    // Telegram webhook'un tekrar tekrar gönderim yapmasını önle
    return res.status(200).json({ ok: true });
  }
}

async function sendMessage(botToken, chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text,
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("Telegram sendMessage failed:", details);
  }
}
```
