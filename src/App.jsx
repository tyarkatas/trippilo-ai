import { useState } from 'react'

export default function App() {
const [destination, setDestination] = useState('')
const [travelType, setTravelType] = useState('Kültür gezisi')
const [message, setMessage] = useState('')
const [loading, setLoading] = useState(false)

async function planTrip() {
if (!destination.trim()) {
setMessage('Lütfen önce gitmek istediğin şehri yaz.')
return
}


setLoading(true)
setMessage('✈️ Seyahat planın hazırlanıyor...')

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
  console.error('Seyahat planı hatası:', error)
  setMessage(
    error.message || 'Bir hata oluştu. Lütfen tekrar dene.'
  )
} finally {
  setLoading(false)
}


}

return (
<div
style={{
maxWidth: '900px',
margin: '0 auto',
padding: '24px',
fontFamily: 'Arial, sans-serif',
color: '#1f2937'
}}
>
<header
style={{
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
flexWrap: 'wrap',
gap: '12px'
}}
>
<h1 style={{ color: '#2563eb', margin: 0 }}>
TripPilo AI </h1> <span>Yapay zekâ destekli seyahat planlayıcısı</span> </header>


  <main style={{ marginTop: '40px' }}>
    <h2>Hayalindeki seyahati planla ✈️</h2>
    <p>Gitmek istediğin şehri ve seyahat türünü seç.</p>

    <label
      htmlFor="destination"
      style={{ display: 'block', marginBottom: '8px' }}
    >
      Nereye gitmek istiyorsun?
    </label>

    <input
      id="destination"
      type="text"
      value={destination}
      onChange={(event) => setDestination(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !loading) {
          planTrip()
        }
      }}
      placeholder="Örn. İstanbul, Kapadokya, Roma"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '14px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        fontSize: '16px',
        marginBottom: '18px'
      }}
    />

    <label
      htmlFor="travelType"
      style={{ display: 'block', marginBottom: '8px' }}
    >
      Seyahat türü
    </label>

    <select
      id="travelType"
      value={travelType}
      onChange={(event) => setTravelType(event.target.value)}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        padding: '14px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        fontSize: '16px',
        marginBottom: '20px',
        backgroundColor: '#fff'
      }}
    >
      <option value="Kültür gezisi">Kültür gezisi</option>
      <option value="Deniz tatili">Deniz tatili</option>
      <option value="Doğa tatili">Doğa tatili</option>
      <option value="Romantik tatil">Romantik tatil</option>
      <option value="Aile tatili">Aile tatili</option>
      <option value="Macera">Macera</option>
      <option value="Yeme içme turu">Yeme içme turu</option>
    </select>

    <button
      type="button"
      onClick={planTrip}
      disabled={loading}
      style={{
        width: '100%',
        padding: '15px',
        backgroundColor: loading ? '#94a3b8' : '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: loading ? 'wait' : 'pointer'
      }}
    >
      {loading ? 'Plan hazırlanıyor...' : 'Seyahat planımı oluştur'}
    </button>

    {message && (
      <div
        role="status"
        aria-live="polite"
        style={{
          marginTop: '24px',
          padding: '18px',
          borderRadius: '8px',
          backgroundColor: '#f1f5f9',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere'
        }}
      >
        {message}
      </div>
    )}
  </main>

  <footer
    style={{
      marginTop: '48px',
      paddingTop: '18px',
      borderTop: '1px solid #e2e8f0',
      color: '#64748b',
      fontSize: '13px'
    }}
  >
    TripPilo AI · Seyahatini keşfet.
  </footer>
</div>

)
}
