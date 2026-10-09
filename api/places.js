
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({
      error: 'Bu istek desteklenmiyor.'
    })
  }

  let lat
  let lon

  try {
    lat = Number(req.body?.lat)
    lon = Number(req.body?.lon)
  } catch (error) {
    console.error('Konum bilgisi okunamadı:', error?.message)
    return res.status(400).json({
      error: 'Konum bilgisi okunamadı.'
    })
  }

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 || lat > 90 ||
    lon < -180 || lon > 180
  ) {
    return res.status(400).json({
      error: 'Konum bilgisi geçersiz.'
    })
  }

  const query = `
    [out:json][timeout:8];
    (
      nwr(around:3000,${lat},${lon})[tourism];
      nwr(around:3000,${lat},${lon})[historic];
      nwr(around:3000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
      node(around:3000,${lat},${lon})[highway=bus_stop];
      node(around:3000,${lat},${lon})[public_transport];
    );
    out center tags 40;
  `

  const servers = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ]

  for (const server of servers) {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      2500
    )

    try {
      const response = await fetch(server, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'TripPiloAI/1.0'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      })

      if (!response.ok) {
        console.error(
          'Overpass HTTP hatası:',
          server,
          response.status
        )
        continue
      }

      const data = await response.json()

      if (!Array.isArray(data.elements)) {
        console.error(
          'Overpass geçersiz yanıt döndürdü:',
          server
        )
        continue
      }

      res.setHeader(
        'Cache-Control',
        'public, s-maxage=60, stale-while-revalidate=120'
      )

      return res.status(200).json({
        elements: data.elements
      })
    } catch (error) {
      console.error(
        'Overpass bağlantı hatası:',
        server,
        error?.name,
        error?.message
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return res.status(502).json({
    error: 'Mekân servisine ulaşılamadı. Lütfen tekrar dene.'
  })
}
