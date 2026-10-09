
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Bu istek desteklenmiyor.'
    })
  }

  const lat = Number(req.body?.lat)
  const lon = Number(req.body?.lon)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return res.status(400).json({
      error: 'Konum bilgisi geçersiz.'
    })
  }

  const query = `
    [out:json][timeout:10];
    (
      node(around:3000,${lat},${lon})[tourism];
      way(around:3000,${lat},${lon})[tourism];
      node(around:3000,${lat},${lon})[historic];
      way(around:3000,${lat},${lon})[historic];
      node(around:3000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
      way(around:3000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
      node(around:3000,${lat},${lon})[highway=bus_stop];
      node(around:3000,${lat},${lon})[public_transport];
    );
    out center tags 50;
  `

  const servers = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ]

  for (const server of servers) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        8000
      )

      let response

      try {
        response = await fetch(server, {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: 'data=' + encodeURIComponent(query),
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeoutId)
      }

      if (!response.ok) continue

      const data = await response.json()

      if (!Array.isArray(data.elements)) continue

      return res.status(200).json({
        elements: data.elements
      })
    } catch {
      // Bir sunucu başarısızsa sıradakini dene.
    }
  }

  return res.status(502).json({
    error: 'Mekân servisi şu anda yanıt vermiyor. Lütfen tekrar dene.'
  })
}
