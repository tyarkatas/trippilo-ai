
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Bu istek desteklenmiyor.'
    })
  }

  const lat = Number(req.body?.lat)
  const lon = Number(req.body?.lon)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      error: 'Konum bilgisi geçersiz.'
    })
  }

  const query = `
    [out:json][timeout:25];
    (
      node(around:5000,${lat},${lon})[tourism];
      way(around:5000,${lat},${lon})[tourism];
      node(around:5000,${lat},${lon})[historic];
      way(around:5000,${lat},${lon})[historic];
      node(around:5000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
      way(around:5000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
      node(around:5000,${lat},${lon})[highway=bus_stop];
      node(around:5000,${lat},${lon})[public_transport];
    );
    out center tags 100;
  `

  const servers = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ]

  for (const server of servers) {
    try {
      const response = await fetch(server, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: 'data=' + encodeURIComponent(query)
      })

      if (!response.ok) continue

      const data = await response.json()

      return res.status(200).json({
        elements: data.elements || []
      })
    } catch {
      // Sıradaki sunucuyu dene.
    }
  }

  return res.status(502).json({
    error: 'Mekân servisine ulaşılamadı. Tekrar dene.'
  })
}
