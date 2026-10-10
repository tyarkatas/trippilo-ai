
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "TripPilo Telegram Bot",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken || !webhookSecret) {
    console.error("Telegram environment variables are missing.");

    return res.status(500).json({
      ok: false,
      error: "Telegram configuration is missing",
    });
  }

  const receivedSecret =
    req.headers["x-telegram-bot-api-secret-token"];

  if (receivedSecret !== webhookSecret) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
    });
  }

  try {
    const update = req.body || {};

    // Normal mesajlar
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || "").trim();

      if (text === "/start") {
        await sendMessage(
          botToken,
          chatId,
          "Merhaba! Ben TripPilo AI.\n\nSeyahat plani hazirlamak icin bir sehir adi yaz. Ornek: Istanbul"
        );

        return res.status(200).json({ ok: true });
      }

      if (text.startsWith("/")) {
        await sendMessage(
          botToken,
          chatId,
          "Seyahat plani olusturmak icin bir sehir adi yazabilirsin. Ornek: Kapadokya"
        );

        return res.status(200).json({ ok: true });
      }

      if (!text) {
        return res.status(200).json({ ok: true });
      }

      // Uzun şehir adlarının callback verisini aşırı büyütmesini önle
      const destination = text.slice(0, 60);

      await sendMessage(
        botToken,
        chatId,
        destination + " icin nasil bir seyahat plani istersin?",
        {
          inline_keyboard: [
            [
              {
                text: "Kultur",
                callback_data: "plan|culture|" + encodeURIComponent(destination),
              },
              {
                text: "Yemek",
                callback_data: "plan|food|" + encodeURIComponent(destination),
              },
            ],
            [
              {
                text: "Doga",
                callback_data: "plan|nature|" + encodeURIComponent(destination),
              },
              {
                text: "Genel gezi",
                callback_data: "plan|general|" + encodeURIComponent(destination),
              },
            ],
          ],
        }
      );

      return res.status(200).json({ ok: true });
    }

    // Buton secimleri
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const data = callback.data || "";

      await answerCallback(botToken, callback.id);

      if (!chatId) {
        return res.status(200).json({ ok: true });
      }

      const parts = data.split("|");

      if (parts.length !== 3 || parts[0] !== "plan") {
        return res.status(200).json({ ok: true });
      }

      const travelType = parts[1];
      let destination;

      try {
        destination = decodeURIComponent(parts[2]);
      } catch {
        await sendMessage(botToken, chatId, "Sehir bilgisi okunamadi. Lutfen tekrar dene.");
        return res.status(200).json({ ok: true });
      }

      const validTypes = ["culture", "food", "nature", "general"];

      if (!validTypes.includes(travelType)) {
        return res.status(200).json({ ok: true });
      }

      await sendMessage(
        botToken,
        chatId,
        destination + " icin seyahat planini hazirliyorum. Lutfen bekle..."
      );

      const host = req.headers.host;

      if (!host) {
        await sendMessage(
          botToken,
          chatId,
          "Sunucu adresi bulunamadi. Lutfen daha sonra tekrar dene."
        );

        return res.status(200).json({ ok: true });
      }

      const planResponse = await fetch(
        "https://" + host + "/api/plan",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            destination,
            travelType,
          }),
        }
      );

      const result = await planResponse.json();

      if (!planResponse.ok || !result.plan) {
        console.error("Plan API returned an error:", planResponse.status);

        await sendMessage(
          botToken,
          chatId,
          "Uzgunum, seyahat plani olusturulamadi. Lutfen daha sonra tekrar dene."
        );

        return res.status(200).json({ ok: true });
      }

      const plan = String(result.plan);
      const chunks = plan.match(/[\s\S]{1,3500}/g) || [];

      for (const chunk of chunks) {
        await sendMessage(botToken, chatId, chunk);
      }

      return res.status(200).json({ ok: true });
    }

    // Desteklenmeyen Telegram guncellemesi
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram handler error:", error?.message || error);

    return res.status(200).json({ ok: true });
  }
}

async function answerCallback(botToken, callbackId) {
  if (!callbackId) return;

  const response = await fetch(
    "https://api.telegram.org/bot" +
      botToken +
      "/answerCallbackQuery",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callback_query_id: callbackId,
      }),
    }
  );

  if (!response.ok) {
    console.error("Failed to answer Telegram callback.");
  }
}

async function sendMessage(
  botToken,
  chatId,
  text,
  replyMarkup = null
) {
  const body = {
    chat_id: chatId,
    text: String(text),
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(
    "https://api.telegram.org/bot" +
      botToken +
      "/sendMessage",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const details = await response.text();

    console.error(
      "Telegram sendMessage failed:",
      response.status,
      details
    );
  }
}
