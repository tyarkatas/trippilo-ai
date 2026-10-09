import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const categories = [
  { id: 'tourism', label: 'Turistik yerler', icon: '📸' },
  { id: 'restaurant', label: 'Restoranlar', icon: '🍽️' },
  { id: 'cafe', label: 'Kafeler', icon: '☕' },
  { id: 'hotel', label: 'Oteller', icon: '🛏️' },
  { id: 'hospital', label: 'Hastaneler', icon: '🏥' },
  { id: 'pharmacy', label: 'Eczaneler', icon: '💊' },
  { id: 'taxi', label: 'Taksi durakları', icon: '🚕' },
  { id: 'atm', label: 'ATM’ler', icon: '🏧' },
  { id: 'transport', label: 'Toplu taşıma', icon: '🚌' }
]

function getCategory(tags = {}) {
  if (['hospital', 'clinic'].includes(tags.amenity)) return 'hospital'
  if (tags.amenity === 'pharmacy') return 'pharmacy'
  if (tags.amenity === 'taxi') return 'taxi'
  if (tags.amenity === 'atm') return 'atm'

  if (['restaurant', 'fast_food', 'food_court'].includes(tags.amenity)) {
    return 'restaurant'
  }

  if (['cafe', 'ice_cream'].includes(tags.amenity)) return 'cafe'

  if (['hotel', 'hostel', 'guest_house'].includes(tags.tourism)) {
    return 'hotel'
  }

  if (
    tags.tourism ||
    tags.historic ||
    tags.amenity === 'museum' ||
    tags.leisure === 'park'
  ) {
    return 'tourism'
  }

  if (
    tags.highway === 'bus_stop' ||
    tags.public_transport ||
    tags.railway === 'station' ||
    tags.amenity === 'bus_station'
  ) {
    return 'transport'
  }

  return null
}

function MapUpdater({ center }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, { duration: 1 })
    }
  }, [center, map])

  return null
}

function makeIcon(emoji) {
  return L.divIcon({
    className: 'trip-map-marker',
    html: `<span>${emoji}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  })
}

export default function App() {
  const [destination, setDestination] = useState('')
  const [travelType, setTravelType] = useState('Kültür gezisi')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState('')
  const [center, setCenter] = useState(null)
  const [places, setPlaces] = useState([])
  const [selected, setSelected] = useState([])
  const [activeCategories, setActiveCategories] = useState(
    categories.map((category) => category.id)
  )
  const [route, setRoute] = useState([])

  async function findPlaces(point) {
    setMapLoading(true)
    setMapError('')
    setPlaces([])
    setSelected([])
    setRoute([])

    const [lat, lon] = point

    const query = `
      [out:json][timeout:25];
      (
        node(around:5000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
        way(around:5000,${lat},${lon})[amenity~"restaurant|cafe|hospital|clinic|pharmacy|taxi|atm|fast_food|bus_station"];
        node(around:5000,${lat},${lon})[tourism];
        way(around:5000,${lat},${lon})[tourism];
        node(around:5000,${lat},${lon})[historic];
        way(around:5000,${lat},${lon})[historic];
        node(around:5000,${lat},${lon})[highway=bus_stop];
        node(around:5000,${lat},${lon})[public_transport];
      );
      out center tags 100;
    `

    try {
      const response = await fetch(
        'https://overpass-api.de/api/interpreter',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'data=' + encodeURIComponent(query)
        }
      )

      if (!response.ok) {
        throw new Error('Mekân verileri şu anda alınamıyor. Tekrar dene.')
      }

      const data = await response.json()

      const found = (data.elements || [])
        .map((item) => {
          const itemLat = item.lat ?? item.center?.lat
          const itemLon = item.lon ?? item.center?.lon
          const tags = item.tags || {}
          const category = getCategory(tags)

          if (itemLat == null || itemLon == null || !category) {
            return null
          }

          return {
            id: `${item.type}-${item.id}`,
            name: tags.name || tags['name:en'] || categories.find(
              (item) => item.id === category
            )?.label || 'İsimsiz mekân',
            lat: itemLat,
            lon: itemLon,
            category,
            tags
          }
        })
        .filter(Boolean)

      setPlaces(found)

      if (found.length === 0) {
        setMapError('Bu bölgede kayıtlı mekân bulunamadı.')
      }
    } catch (error) {
      setMapError(error.message || 'Mekânlar yüklenemedi.')
    } finally {
      setMapLoading(false)
    }
  }

  async function planTrip() {
    if (!destination.trim()) {
      setMessage('Lütfen gitmek istediğin şehri yaz.')
      return
    }

    setLoading(true)
    setMessage('✈️ Seyahat planın hazırlanıyor...')
    setMapError('')

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          destination: destination.trim(),
          travelType
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Plan oluşturulamadı.')
      }

      setMessage(data.plan || 'Plan oluşturulamadı.')
    } catch (error) {
      setMessage(error.message || 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }

    try {
      const response = await fetch(
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
        encodeURIComponent(destination.trim())
      )

      if (!response.ok) throw new Error('Konum bulunamadı.')

      const results = await response.json()

      if (!results.length) {
        throw new Error('Şehir bulunamadı. Ülke adıyla birlikte dene.')
      }

      const point = [
        Number(results[0].lat),
        Number(results[0].lon)
      ]

      setCenter(point)
      await findPlaces(point)
    } catch (error) {
      setMapError(error.message || 'Harita konumu bulunamadı.')
    }
  }

  async function drawRoute() {
    if (!center || selected.length === 0) {
      setMapError('Önce haritadan en az bir mekânı rotana ekle.')
      return
    }

    setMapError('')

    const points = [
      center,
      ...selected.map((place) => [place.lat, place.lon])
    ]

    const coordinates = points
      .map(([lat, lon]) => `${lon},${lat}`)
      .join(';')

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
      )

      const data = await response.json()

      if (!response.ok || data.code !== 'Ok' || !data.routes?.length) {
        throw new Error('Bu noktalar için rota bulunamadı.')
      }

      const coordinatesOnMap = data.routes[0].geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      )

      setRoute(coordinatesOnMap)

      setMessage((current) =>
        `${current}\n\n🗺️ Rota: yaklaşık ${(data.routes[0].distance / 1000).toFixed(1)} km, araçla ${Math.round(data.routes[0].duration / 60)} dakika.`
      )
    } catch (error) {
      setMapError(error.message || 'Rota çizilemedi.')
    }
  }

  const visiblePlaces = places.filter((place) =>
    activeCategories.includes(place.category)
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark">✈</div>
        <div>
          <h1>TripPilo AI</h1>
          <p>Yapay zekâ destekli seyahat planlayıcısı</p>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">KEŞFET · PLANLA · YOLA ÇIK</span>
          <h2>Hayalindeki seyahati planla</h2>
          <p>Şehrini seç, seyahat planını oluştur ve yakındaki mekânları keşfet.</p>
        </section>

        <section className="planner-card">
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="destination">Nereye gitmek istiyorsun?</label>
              <input
                id="destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) planTrip()
                }}
                placeholder="İstanbul, Türkiye veya Roma, İtalya"
              />
            </div>

            <div className="field-group">
              <label htmlFor="travelType">Seyahat türü</label>
              <select
                id="travelType"
                value={travelType}
                onChange={(event) => setTravelType(event.target.value)}
              >
                <option>Kültür gezisi</option>
                <option>Deniz tatili</option>
                <option>Doğa tatili</option>
                <option>Romantik tatil</option>
                <option>Aile tatili</option>
                <option>Macera</option>
                <option>Yeme içme turu</option>
              </select>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={planTrip}
            disabled={loading}
          >
            {loading ? 'Plan hazırlanıyor...' : '✦ Seyahat planımı oluştur'}
          </button>
        </section>

        {message && (
          <section className="plan-result" aria-live="polite">
            <h3>✦ Seyahat planın</h3>
            <div className="plan-text">{message}</div>
          </section>
        )}

        <section className="map-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CANLI HARİTA</span>
              <h2>Rotan ve yakındaki mekânlar</h2>
            </div>
            {mapLoading && <span>Mekânlar yükleniyor…</span>}
          </div>

          <div className="category-filters">
            {categories.map((category) => (
              <button
                key={category.id}
                className={
                  activeCategories.includes(category.id)
                    ? 'filter-chip active'
                    : 'filter-chip'
                }
                onClick={() =>
                  setActiveCategories((current) =>
                    current.includes(category.id)
                      ? current.filter((id) => id !== category.id)
                      : [...current, category.id]
                  )
                }
              >
                {category.icon} {category.label}
              </button>
            ))}
          </div>

          <div className="map-frame">
            {center ? (
              <MapContainer
                center={center}
                zoom={13}
                scrollWheelZoom={true}
                className="map-canvas"
              >
                <MapUpdater center={center} />

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker
                  position={center}
                  icon={makeIcon('✈️')}
                >
                  <Popup>Aradığın şehir</Popup>
                </Marker>

                {visiblePlaces.map((place) => {
                  const category = categories.find(
                    (item) => item.id === place.category
                  )

                  return (
                    <Marker
                      key={place.id}
                      position={[place.lat, place.lon]}
                      icon={makeIcon(category?.icon || '📍')}
                    >
                      <Popup>
                        <strong>{place.name}</strong>
                        <p>{category?.label}</p>
                        <button
                          onClick={() =>
                            setSelected((current) =>
                              current.some((item) => item.id === place.id)
                                ? current.filter((item) => item.id !== place.id)
                                : [...current, place].slice(0, 6)
                            )
                          }
                        >
                          {selected.some((item) => item.id === place.id)
                            ? 'Rotadan çıkar'
                            : 'Rotaya ekle'}
                        </button>
                        <p>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Yol tarifi al
                          </a>
                        </p>
                      </Popup>
                    </Marker>
                  )
                })}

                {route.length > 0 && (
                  <Polyline
                    positions={route}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 6,
                      opacity: 0.9
                    }}
                  />
                )}
              </MapContainer>
            ) : (
              <div className="map-placeholder">
                <span>🗺️</span>
                <h3>Haritan burada görünecek</h3>
                <p>Şehrini yazıp seyahat planını oluştur.</p>
              </div>
            )}
          </div>

          <div className="map-toolbar">
            <span>
              {visiblePlaces.length} mekân gösteriliyor · {selected.length} durak seçildi
            </span>
            <button
              className="secondary-button"
              onClick={drawRoute}
              disabled={!center || selected.length === 0}
            >
              ↗ Seçili duraklar için rota çiz
            </button>
          </div>

          {mapError && <p className="inline-error">{mapError}</p>}

          <div className="places-grid">
            {visiblePlaces.slice(0, 30).map((place) => {
              const category = categories.find(
                (item) => item.id === place.category
              )
              const isSelected = selected.some(
                (item) => item.id === place.id
              )

              return (
                <article className="place-card" key={place.id}>
                  <div className="place-icon">{category?.icon}</div>
                  <div className="place-info">
                    <span className="place-category">{category?.label}</span>
                    <h3>{place.name}</h3>
                  </div>
                  <button
                    className={isSelected ? 'small-button selected' : 'small-button'}
                    onClick={() =>
                      setSelected((current) =>
                        isSelected
                          ? current.filter((item) => item.id !== place.id)
                          : [...current, place].slice(0, 6)
                      )
                    }
                  >
                    {isSelected ? '✓ Eklendi' : '+ Rotaya ekle'}
                  </button>
                </article>
              )
            })}
          </div>

          <p className="map-attribution">
            Harita ve mekân verileri OpenStreetMap katkıcılarından gelir.
            Bilgiler eksik veya güncel olmayabilir.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        TripPilo AI · Seyahatini keşfet.
      </footer>
    </div>
  )
}

