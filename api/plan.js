
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Bu istek desteklenmiyor.'
    })
  }

  try {
    const { destination, travelType } = req.body || {}

    if (!destination || !destination.trim()) {
      return res.status(400).json({
        error: 'Lütfen bir şehir veya ülke yaz.'
      })
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API anahtarı ayarlanmamış.'
      })
    }

    const prompt = `Destinasyon: ${destination}
Tatil türü: ${travelType || 'Genel gezi'}
Türkçe, anlaşılır bir seyahat planı hazırla. Ulaşım, yemek, aktiviteler ve pratik ipuçları öner. Doğrulanmamış fiyatları kesin bilgi olarak sunma.`

    const models = [
      'gemini-3.8-flash',
      'gemini-3.7-flash'
    ]

    let lastStatus = 503
    let lastError = ''

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{
                    text: 'Sen TripPilo AI adlı Türkçe seyahat asistanısın.'
                  }]
                },
                contents: [{
                  parts: [{ text: prompt }]
                }]
              })
            }
          )

          const raw = await response.text()
          let data

          try {
            data = JSON.parse(raw)
          } catch {
            data = {}
          }

          if (response.ok) {
            const plan = data.candidates?.[0]?.content?.parts
              ?.map(part => part.text || '')
              .join('\n')
              .trim()

            if (plan) {
              return res.status(200).json({ plan })
            }

            lastError = 'Model boş yanıt verdi.'
            lastStatus = 502
            break
          }

          lastStatus = response.status
          lastError = data.error?.message || 'Bilinmeyen API hatası'

          console.error(
            `Gemini ${model} hatası:`,
            lastStatus,
            lastError
          )

          if (attempt === 0 &&
              [429, 500, 502, 503, 504].includes(lastStatus)) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }

          break
        } catch (error) {
          lastError = error.message || 'Bağlantı hatası'
          lastStatus = 502
          break
        }
      }
    }

    return res.status(502).json({
      error: lastStatus === 503 || lastStatus === 429
        ? 'Gemini şu anda yoğun. Lütfen biraz sonra tekrar dene.'
        : 'Seyahat planı oluşturulamadı. Lütfen daha sonra tekrar dene.'
    })
  } catch (error) {
    console.error('TripPilo AI hatası:', error.message)

    return res.status(500).json({
      error: 'Sunucu hatası. Lütfen daha sonra tekrar dene.'
    })
  }
}
