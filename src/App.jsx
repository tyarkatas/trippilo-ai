
import { useState } from 'react'
import './App.css'

const PRODUCTS = [
  {
    id: 'travel_plan',
    title: 'Kişisel Seyahat Planı',
    description: 'Sana özel yapay zekâ destekli seyahat planı.',
    price: '1 USD'
  },
  {
    id: 'membership',
    title: 'TripPilo Pro — Yıllık Üyelik',
    description: 'TripPilo Pro üyeliği. 1 yıllık abonelik.',
    price: '2.500 USD / yıl'
  }
]

export default function App() {
  const [destination, setDestination] = useState('')
  const [travelType, setTravelType] = useState('Kültür gezisi')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState('')
  const [paymentInfo, setPaymentInfo] = useState(null)
  const [paymentError, setPaymentError] = useState('')

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

  async function startPayment(productType) {
    setPaymentLoading(productType)
    setPaymentInfo(null)
    setPaymentError('')

    try {
      const response = await fetch('/api/nowpayments-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_type: productType
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ödeme başlatılamadı.')
      }

      setPaymentInfo(data)
    } catch (error) {
      setPaymentError(
        error.message || 'Ödeme başlatılırken bir hata oluştu.'
      )
    } finally {
      setPaymentLoading('')
    }
  }

  async function copyPaymentAddress() {
    const address = paymentInfo?.pay_address

    if (!address) {
      setPaymentError('Kopyalanacak ödeme adresi bulunamadı.')
      return
    }

    try {
      await navigator.clipboard.writeText(address)
      setPaymentError('')
    } catch {
      setPaymentError(
        'Adres otomatik kopyalanamadı. Adresi seçip elle kopyalayabilirsin.'
      )
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

        <section className="planner-card">
          <span className="eyebrow">TRIPPILO AVANTAJLARI</span>
          <h2>Seyahatini bir adım öteye taşı</h2>
          <p>
            İhtiyacına uygun seçeneği belirleyerek ödeme işlemini
            başlatabilirsin.
          </p>

          <div className="form-grid">
            {PRODUCTS.map((product) => (
              <article className="plan-result" key={product.id}>
                <h3>{product.title}</h3>
                <p>{product.description}</p>
                <p>
                  <strong>{product.price}</strong>
                </p>

                <button
                  className="primary-button"
                  onClick={() => startPayment(product.id)}
                  disabled={Boolean(paymentLoading)}
                >
                  {paymentLoading === product.id
                    ? 'Ödeme hazırlanıyor…'
                    : 'Ödeme başlat'}
                </button>
              </article>
            ))}
          </div>

          {paymentError && (
            <p role="alert" className="plan-paragraph">
              {paymentError}
            </p>
          )}

          {paymentInfo && (
            <section className="plan-result" aria-live="polite">
              <h3>Ödeme isteği oluşturuldu</h3>

              <p>
                Sipariş numarası:{' '}
                <strong>{paymentInfo.order_id}</strong>
              </p>

              <p>
                Tutar: {paymentInfo.price_amount}{' '}
                {paymentInfo.price_currency?.toUpperCase()}
              </p>

              {paymentInfo.pay_currency && (
                <p>
                  Kripto para:{' '}
                  {paymentInfo.pay_currency.toUpperCase()}
                </p>
              )}

              {paymentInfo.pay_amount != null && (
                <p>Ödenecek miktar: {paymentInfo.pay_amount}</p>
              )}

              {paymentInfo.pay_address && (
                <>
                  <p>Ödeme adresi:</p>
                  <p style={{ overflowWrap: 'anywhere' }}>
                    {paymentInfo.pay_address}
                  </p>

                  <button
                    className="primary-button"
                    onClick={copyPaymentAddress}
                  >
                    Ödeme adresini kopyala
                  </button>
                </>
              )}

              <p>
                Bu yalnızca ödeme isteğinin oluşturulduğunu gösterir.
                Ödeme tamamlanmış sayılmaz; onay sunucudan doğrulanmalıdır.
              </p>
            </section>
          )}
        </section>
      </main>

      <footer className="app-footer">
        TripPilo AI · Seyahatini keşfet.
      </footer>
    </div>
  )
}
