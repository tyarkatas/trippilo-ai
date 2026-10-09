
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
        error: 'Gemini API anahtarı sunucuda ayarlanmamış.'
      })
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'Sen TripPilo AI adlı Türkçe seyahat asistanısın. Kullanıcıya anlaşılır bir seyahat planı hazırla. Fiyatları ve müsaitliği doğrulamadan kesin bilgi olarak sunma. Ulaşım, yemek, aktiviteler ve pratik ipuçları öner.'
            }]
          },
          contents: [{
            parts: [{
              text: `Destinasyon: ${destination}\nTatil türü: ${travelType || 'Genel gezi'}\nBana örnek bir seyahat planı hazırla.`
            }]
          }]
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API hatası:', response.status, data.error?.message)

      return res.status(500).json({
        error: 'Gemini yanıt veremedi. API anahtarını ve kullanım limitini kontrol et.'
      })
    }

    const plan = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('\n')
      .trim()

    return res.status(200).json({
      plan: plan || 'Plan oluşturulamadı.'
    })
  } catch (error) {
    console.error('TripPilo AI hatası:', error.message)

    return res.status(500).json({
      error: 'Plan oluşturulamadı. Lütfen daha sonra tekrar dene.'
    })
  }
}
