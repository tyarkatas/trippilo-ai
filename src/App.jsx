
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

  if (
    ['restaurant', 'fast_food', 'food_court'].includes(tags.amenity)
  ) return 'restaurant'

  if (['cafe', 'ice_cream'].includes(tags.amenity)) return 'cafe'

  if (
    ['hotel', 'hostel', 'guest_house'].includes(tags.tourism)
  ) return 'hotel'

  if (
    tags.tourism ||
    tags.historic ||
    tags.amenity === 'museum' ||
    tags.leisure === 'park'
  ) return 'tourism'

  if (
    tags.highway === 'bus_stop' ||
    tags.public_transport ||
    tags.railway === 'station' ||
    tags.amenity === 'bus_station'
  ) return 'transport'

  return null
}

function MapUpdater({ center }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.flyTo(center, 13, { duration: 1 })
    }
  }, [center, map])

  return null
}

function makeIcon(emoji) {
  return L.divIcon({
    className: 'trip-map-marker',
    html: '<span>' + emoji + '</span>',
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  })
}

function PlanContent({ text }) {
  return (
    <div className="plan-content">
      {String(text || '').split('\n').map((line, index) => {
        const heading = /^\s{0,3}#{1,6}\s+/.test(line)
        const bullet = /^\s*([-*+]\s+|\d+[.)]\s+)/.test(line)

        const cleaned = line
          .replace(/^\s{0,3}#{1,6}\s+/, '')
          .replace(/^\s*([-*+]\s+|\d+[.)]\s+)/, '')
          .trim()

        if (!cleaned) {
          return <div className="plan-spacer" key={index} />
        }

        const content = cleaned
          .split(/(\*\*.*?\*\*)/g)
          .filter(Boolean)
          .map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i}>{part.slice(2, -2)}</strong>
              : part.replace(/\*/g, '')
          )

        if (heading) {
          return (
            <h4 className="plan-subheading" key={index}>
              {content}
            </h4>
          )
        }

        if (bullet) {
          return (
            <div className="plan-bullet" key={index}>
              <span>•</span>
              <div>{content}</div>
            </div>
          )
        }

        return (
          <p className="plan-paragraph" key={index}>
            {content}
          </p>
        )
      })}
    </div>
  )
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
    categories.map((item) => item.id)
  )
  const [route, setRoute] = useState([])
  const [routeSummary, setRouteSummary] = useState('')

  function togglePlace(place) {
    setRoute([])
    setRouteSummary('')

    setSelected((current) => {
      if (current.some((item) => item.id === place.id)) {
        return current.filter((item) => item.id !== place.id)
      }

      if (current.length >= 6) {
        setMapError('En fazla 6 durak seçebilirsin.')
        return current
      }

      setMapError('')
      return [...current, place]
    })
  }

  async function findPlaces(point) {
    setMapLoading(true)
    setMapError('')
    setPlaces([])
    setSelected([])
    setRoute([])
    setRouteSummary('')

    const [lat, lon] = point

    try {
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lat, lon })
      })

      let data

      try {
        data = await response.json()
      } catch {
        throw new Error('Sunucudan geçerli yanıt alınamadı.')
      }

      if (!response.ok) {
        throw new Error(
          data.error || 'Mekân verileri alınamadı.'
        )
      }

      const found = (data.elements || [])
        .map((item) => {
          const itemLat = item.lat ?? item.center?.lat
          const itemLon = item.lon ?? item.center?.lon
          const tags = item.tags || {}
          const category = getCategory(tags)

          if (
            itemLat == null ||
            itemLon == null ||
            !category
          ) {
            return null
          }

          return {
            id: item.type + '-' + item.id,
            name:
              tags.name ||
              tags['name:en'] ||
              categories.find(
                (entry) => entry.id === category
              )?.label ||
              'İsimsiz mekân',
            lat: Number(itemLat),
            lon: Number(itemLon),
            category,
            tags
          }
        })
        .filter(Boolean)

      setPlaces(found)

      if (!found.length) {
        setMapError(
          'Bu bölgede kayıtlı mekân bulunamadı. Başka bir şehir deneyebilirsin.'
        )
      }
    } catch (error) {
      setMapError(
        error.message || 'Mekânlar yüklenemedi.'
      )
    } finally {
      setMapLoading(false)
    }
  }

  async function planTrip() {
    const city = destination.trim()

    if (!city) {
      setMessage('Lütfen gitmek istediğin şehri yaz.')
      return
    }

    setLoading(true)
    setMessage('Seyahat planın hazırlanıyor…')
    setMapError('')
    setCenter(null)
    setPlaces([])
    setSelected([])
    setRoute([])
    setRouteSummary('')

    const planRequest = (async () => {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          destination: city,
          travelType
        })
      })

      let data

      try {
        data = await response.json()
      } catch {
        throw new Error('Plan sunucusundan geçerli yanıt alınamadı.')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Plan oluşturulamadı.')
      }

      return data.plan || 'Plan oluşturulamadı.'
    })()

    const locationRequest = (async () => {
      const response = await fetch(
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
        encodeURIComponent(city)
      )

      if (!response.ok) {
        throw new Error('Konum bulunamadı. Tekrar dene.')
      }

      const results = await response.json()

      if (!results.length) {
        throw new Error('Şehir bulunamadı. Ülke adıyla birlikte dene.')
      }

      return [
        Number(results[0].lat),
        Number(results[0].lon)
      ]
    })()

    try {
      setMessage(await planRequest)
    } catch (error) {
      setMessage(error.message || 'Plan oluşturulamadı.')
    } finally {
      setLoading(false)
    }

    try {
      const point = await locationRequest
      setCenter(point)
      await findPlaces(point)
    } catch (error) {
      setMapError(error.message || 'Harita konumu bulunamadı.')
    }
  }

  async function drawRoute() {
    if (!center) {
      setMapError('Önce gitmek istediğin şehri yazıp plan oluştur.')
      return
    }

    if (selected.length === 0) {
      setMapError('Önce haritadan en az bir mekânı rotana ekle.')
      return
    }

    setMapError('')
    setRoute([])
    setRouteSummary('')

    const points = [
      center,
      ...selected.map((place) => [place.lat, place.lon])
    ]

    const coordinates = points
      .map(([lat, lon]) => lon + ',' + lat)
      .join(';')

    try {
      const response = await fetch(
        'https://router.project-osrm.org/route/v1/driving/' +
        coordinates +
        '?overview=full&geometries=geojson'
      )

      if (!response.ok) {
        throw new Error('Rota sunucusuna ulaşılamadı. Tekrar dene.')
      }

      const data = await response.json()

      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new Error(
          'Bu noktalar için rota bulunamadı. Farklı duraklar deneyebilirsin.'
        )
      }

      const result = data.routes[0]

      setRoute(
        result.geometry.coordinates.map(([lon, lat]) => [lat, lon])
      )

      setRouteSummary(
        'Yaklaşık ' +
        (result.distance / 1000).toFixed(1) +
        ' km · araçla ' +
        Math.round(result.duration / 60) +
        ' dakika'
      )
    } catch (error) {
      setMapError(error.message || 'Rota çizilemedi.')
    }
  }

  function openGoogleMapsRoute() {
    if (!center) {
      setMapError(
        'Önce gitmek istediğin şehri yazıp seyahat planını oluştur.'
      )
      return
    }

    if (selected.length === 0) {
      const searchUrl =
        'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(destination.trim())

      window.open(searchUrl, '_blank', 'noopener,noreferrer')
      return
    }

    const last = selected[selected.length - 1]

    const params = new URLSearchParams({
      api: '1',
      origin: center[0] + ',' + center[1],
      destination: last.lat + ',' + last.lon,
      travelmode: 'driving'
    })

    const waypoints = selected
      .slice(0, -1)
      .map((place) => place.lat + ',' + place.lon)
      .join('|')

    if (waypoints) {
      params.set('waypoints', waypoints)
    }

    window.open(
      'https://www.google.com/maps/dir/?' + params.toString(),
      '_blank',
      'noopener,noreferrer'
    )
  }

  const visiblePlaces = places.filter(
    (place) => activeCategories.includes(place.category)
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">✈</div>
        <div>
          <h1>TripPilo AI</h1>
          <p>Yapay zekâ destekli seyahat planlayıcısı</p>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">KEŞFET · PLANLA · YOLA ÇIK</span>
          <h2>Hayalindeki seyahati planla</h2>
          <p>
            Şehrini seç, sana özel bir gezi planı oluştur ve yakınındaki
            mekânları keşfet.
          </p>
        </section>

        <section className="planner-card">
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="destination">
                Nereye gitmek istiyorsun?
              </label>
              <input
                id="destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) planTrip()
                }}
                placeholder="İstanbul, Türkiye veya Roma, İtalya"
                autoComplete="off"
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
            {loading ? 'Plan hazırlanıyor…' : '✦ Seyahat planımı oluştur'}
          </button>
        </section>

        {message && (
          <section className="plan-result" aria-live="polite">
            <div className="result-heading">
              <div>
                <span className="eyebrow">SANA ÖZEL ÖNERİLER</span>
                <h3>✦ Seyahat planın</h3>
              </div>
              {loading && (
                <span className="loading-pill">Hazırlanıyor</span>
              )}
            </div>
            <PlanContent text={message} />
          </section>
        )}

        <section className="map-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CANLI HARİTA</span>
              <h2>Rotan ve yakındaki mekânlar</h2>
            </div>
            {mapLoading && (
              <span className="loading-pill">Mekânlar yükleniyor…</span>
            )}
          </div>

          <div className="category-filters">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={
                  activeCategories.includes(category.id)
                    ? 'filter-chip active'
                    : 'filter-chip'
                }
                aria-pressed={activeCategories.includes(category.id)}
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
                scrollWheelZoom
                className="map-canvas"
              >
                <MapUpdater center={center} />

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker position={center} icon={makeIcon('✈️')}>
                  <Popup>Başlangıç: {destination}</Popup>
                </Marker>

                {visiblePlaces.map((place) => {
                  const category = categories.find(
                    (item) => item.id === place.category
                  )

                  const isSelected = selected.some(
                    (item) => item.id === place.id
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
                          type="button"
                          onClick={() => togglePlace(place)}
                        >
                          {isSelected ? 'Rotadan çıkar' : 'Rotaya ekle'}
                        </button>

                        <p>
                          <a
                            href={
                              'https://www.google.com/maps/search/?api=1&query=' +
                              place.lat +
                              ',' +
                              place.lon
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Mekânı Google Maps’te aç
                          </a>
                        </p>
                      </Popup>
                    </Marker>
                  )
                })}

                {selected.map((place, index) => (
                  <Marker
                    key={'stop-' + place.id}
                    position={[place.lat, place.lon]}
                    icon={makeIcon(String(index + 1))}
                  >
                    <Popup>
                      {index + 1}. durak: {place.name}
                    </Popup>
                  </Marker>
                ))}

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
                <p>
                  Yukarıya bir şehir yazıp seyahat planını oluştur.
                </p>
              </div>
            )}
          </div>

          <div className="map-toolbar">
            <span>
              {visiblePlaces.length} mekân gösteriliyor · {selected.length}/6
              {' '}durak seçildi
            </span>

            <div className="route-actions">
              <button
                className="secondary-button"
                onClick={drawRoute}
                disabled={!center || mapLoading}
              >
                ↗ Haritada rota çiz
              </button>

              <button
                className="google-button"
                onClick={openGoogleMapsRoute}
                disabled={!center}
              >
                Google Maps’te aç ↗
              </button>
            </div>
          </div>

          {routeSummary && (
            <p className="route-summary">🛣️ {routeSummary}</p>
          )}

          {selected.length > 0 && (
            <div className="selected-stops">
              <h3>Rotandaki duraklar</h3>
              <ol>
                {selected.map((place, index) => (
                  <li key={place.id}>
                    <span>{index + 1}. {place.name}</span>
                    <button
                      type="button"
                      onClick={() => togglePlace(place)}
                    >
                      Kaldır
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {mapError && (
            <p className="inline-error" role="status">
              {mapError}
            </p>
          )}

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
                    <span className="place-category">
                      {category?.label}
                    </span>
                    <h3>{place.name}</h3>
                  </div>

                  <button
                    className={
                      isSelected
                        ? 'small-button selected'
                        : 'small-button'
                    }
                    onClick={() => togglePlace(place)}
                    type="button"
                  >
                    {isSelected ? '✓ Eklendi' : '+ Rotaya ekle'}
                  </button>
                </article>
              )
            })}
          </div>

          <p className="map-attribution">
            Harita ve mekân verileri OpenStreetMap katkıcılarından gelir.
            Bilgiler eksik veya güncel olmayabilir. Rota tahminidir.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        TripPilo AI · Seyahatini keşfet.
      </footer>
    </div>
  )
}
