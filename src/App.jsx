
import { useState } from 'react'
import './App.css'

export default function App() {
  const [destination, setDestination] = useState('')
  const [travelType, setTravelType] = useState('Kültür gezisi')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function planTrip() {
    const city = destination.trim()

    if (!city) {
      setMessage('Lütfen gitmek istediğin şehri yaz.')
      return
    }

    setLoading(true)
    setMessage('Seyahat planın hazırlanıyor…')

    try {
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
  }

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
          <span className="eyebrow">
            KEŞFET · PLANLA · YOLA ÇIK
          </span>
          <h2>Hayalindeki seyahati planla</h2>
          <p>
            Şehrini seç ve sana özel bir seyahat planı oluştur.
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
                onChange={(event) =>
                  setDestination(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) {
                    planTrip()
                  }
                }}
                placeholder="İstanbul, Türkiye"
              />
            </div>

            <div className="field-group">
              <label htmlFor="travelType">Seyahat türü</label>
              <select
                id="travelType"
                value={travelType}
                onChange={(event) =>
                  setTravelType(event.target.value)
                }
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
            {loading
              ? 'Plan hazırlanıyor…'
              : '✦ Seyahat planımı oluştur'}
          </button>
        </section>

        {message && (
          <section className="plan-result" aria-live="polite">
            <div className="result-heading">
              <div>
                <span className="eyebrow">SEYAHAT REHBERİN</span>
                <h3>Seyahat planın</h3>
              </div>
            </div>
            <div className="plan-content">
              {message.split('\n').map((line, index) => (
                <p className="plan-paragraph" key={index}>
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        TripPilo AI · Seyahatini keşfet.
      </footer>
    </div>
  )
}
