
import OpenAI from 'openai'

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

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'API anahtarı sunucuda ayarlanmamış.'
      })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen TripPilo AI adlı Türkçe seyahat asistanısın. Kullanıcıya anlaşılır bir seyahat planı hazırla. Fiyatları ve müsaitliği doğrulamadan kesin bilgi olarak sunma. Ulaşım, yemek, aktiviteler ve pratik ipuçları öner.'
        },
        {
          role: 'user',
          content: `Destinasyon: ${destination}\nTatil türü: ${travelType || 'Genel gezi'}\nBana örnek bir seyahat planı hazırla.`
        }
      ]
    })

    return res.status(200).json({
      plan: completion.choices[0]?.message?.content || 'Plan oluşturulamadı.'
    })
  } catch (error) {
    console.error('TripPilo AI hatası:', error.message)

    return res.status(500).json({
      error: 'Plan oluşturulamadı. API ayarlarını ve kullanım limitini kontrol et.'
    })
  }
}