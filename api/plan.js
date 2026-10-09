import OpenAI from 'openai'

export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Bu istek desteklenmiyor.' })
}

try {
const { destination, travelType } = req.body || {}

```
if (!destination?.trim()) {
  return res.status(400).json({
    error: 'Lütfen bir şehir veya ülke yaz.'
  })
}

if (!process.env.OPENAI_API_KEY) {
  return res.status(500).json({
    error: 'Sunucuda API anahtarı ayarlanmamış.'
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
      content:
        'Sen TripPilo AI adlı Türkçe seyahat asistanısın. ' +
        'Kullanıcıya düzenli, anlaşılır bir gezi planı hazırla. ' +
        'Güncel olarak doğrulanmamış fiyatları ve müsaitlikleri kesin bilgi gibi sunma. ' +
        'Gezilecek yerler, yemekler, ulaşım ve pratik öneriler ver.'
    },
    {
      role: 'user',
      content:
        `Destinasyon: ${destination}\n` +
        `Tatil türü: ${travelType || 'Genel gezi'}\n` +
        'Bana örnek bir seyahat planı hazırla.'
    }
  ]
})

return res.status(200).json({
  plan: completion.choices[0]?.message?.content || 'Plan oluşturulamadı.'
})
```

} catch (error) {
console.error('TripPilo AI hatası:', error.message)

```
return res.status(500).json({
  error: 'Plan oluşturulamadı. API ayarlarını ve kullanım limitini kontrol et.'
})
```

}
}
