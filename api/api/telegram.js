const TELEGRAM_API = "https://api.telegram.org";

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const response = await fetch(
    `${TELEGRAM_API}/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Telegram API hatası");
  }

  return result;
}

async function sendText(chatId, text, extra = {}) {
  const chunks = text.match(/[\s\S]{1,3800}/g) || [""];

  for (const chunk of chunks) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: chunk,
      ...extra,
    });
  }
}

const cities = [
  ["İstanbul", "Istanbul"],
  ["Kapadokya", "Kapadokya"],
  ["Antalya", "Antalya"],
  ["İzmir", "Izmir"],
  ["Ankara", "Ankara"],
  ["Roma", "Roma"],
  ["Paris", "Paris"],
];

const travelTypes = [
  ["🏛️ Kültür", "culture"],
  ["🍽️ Yemek", "food"],
  ["🌿 Doğa", "nature"],
  ["👨‍👩‍👧‍👦 Aile", "family"],
  ["🧭 Genel gezi", "general"],
];

function cityKeyboard() {
  return {
    inline_keyboard: [
      cities.slice(0, 2).map(([label, value]) => ({
        text: label,
        callback_data: `city|${value}`,
      })),
      cities.slice(2, 4).map(([label, value]) => ({
        text: label,
        callback_data: `city|${value}`,
      })),
      cities.slice(4, 6).map(([label, value]) => ({
        text: label,
        callback_data: `city|${value}`,
      })),
      [{
        text: cities[6][0],
        callback_data: `city|${cities[6][1]}`,
      }],
    ],
  };
}

function typeKeyboard(destination) {
  return {
    inline_keyboard: travelTypes.map(([label, value]) => [{
      text: label,
      callback_data: `type|${value}|${destination}`,
    }]),
  };
}

async function showCities(chatId) {
  await sendText(
    chatId,
    "Merhaba! 👋 Ben TripPilo AI.\n\n" +
      "Senin için kişiselleştirilmiş bir seyahat planı hazırlayabilirim.\n\n" +
      "Nereye gitmek istiyorsun? Aşağıdan bir yer seçebilir veya şehir adını mesaj olarak yazabilirsin.",
    { reply_markup: cityKeyboard() }
  );
}

async function createPlan(chatId, destination, travelType, host) {
  await sendText(
    chatId,
    `✈️ ${destination} için gezi planını hazırlıyorum. Biraz bekle!`
  );

  const response = await fetch(`https://${host}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination, travelType }),
  });

  const data = await response.json();

  if (!response.ok || !data.plan) {
    throw new Error(data.error || "Plan oluşturulamadı.");
  }

  await sendText(chatId, data.plan, {
    reply_markup: {
      inline_keyboard: [[
        { text: "🔄 Yeni gezi planı", callback_data: "new" },
      ]],
    },
  });
}

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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const suppliedSecret =
    req.headers["x-telegram-bot-api-secret-token"];

  if (!token || !secret) {
    return res.status(500).json({
      error: "Telegram environment variables are missing.",
    });
  }

  if (suppliedSecret !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Telegram'ın webhook tekrarlarını ve boş güncellemelerini güvenle ele al.
  try {
    const update = req.body || {};
    const host = req.headers.host;

    if (!host) {
      return res.status(400).json({ error: "Missing host" });
    }

    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const messageId = callback.message?.message_id;
      const value = callback.data || "";

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id,
      });

      if (!chatId) {
        return res.status(200).json({ ok: true });
      }

      if (value === "new") {
        if (messageId) {
          await telegram("editMessageReplyMarkup", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] },
          }).catch(() => {});
        }

        await showCities(chatId);
        return res.status(200).json({ ok: true });
      }

      const parts = value.split("|");

      if (parts[0] === "city" && parts[1]) {
        const destination = parts[1];
        await sendText(
          chatId,
          `📍 ${destination} seçildi. Nasıl bir gezi istersin?`,
          { reply_markup: typeKeyboard(destination) }
        );
      } else if (parts[0] === "type" && parts[1] && parts[2]) {
        const typeLabels = {
          culture: "Kültür gezisi",
          food: "Yemek keşfi",
          nature: "Doğa gezisi",
          family: "Aile gezisi",
          general: "Genel gezi",
        };

        const travelType = typeLabels[parts[1]];
        const destination = parts.slice(2).join("|");

        if (!travelType || !destination) {
          await sendText(chatId, "Bu seçim geçerli değil. /start ile yeniden başla.");
          return res.status(200).json({ ok: true });
        }

        await createPlan(chatId, destination, travelType, host);
      }

      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    if (!message?.chat?.id) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = (message.text || "").trim();

    if (!text) {
      await sendText(chatId, "Lütfen bir şehir adı yaz veya /start komutunu kullan.");
      return res.status(200).json({ ok: true });
    }

    if (text === "/start" || text === "/help") {
      await showCities(chatId);
      return res.status(200).json({ ok: true });
    }

    if (text.startsWith("/")) {
      await sendText(chatId, "Başlamak için /start yazabilirsin.");
      return res.status(200).json({ ok: true });
    }

    // Kullanıcı istediği başka bir şehri de yazabilir.
    await sendText(
      chatId,
      `📍 ${text} için nasıl bir gezi istersin?`,
      { reply_markup: typeKeyboard(text) }
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("TripPilo Telegram hatası:", error.message);

    // Telegram'ın aynı güncellemeyi tekrar tekrar göndermesini önle.
    return res.status(200).json({ ok: true });
  }
}
