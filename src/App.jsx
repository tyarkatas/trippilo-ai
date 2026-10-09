import { useState } from 'react'
import './App.css'

function App() {
const [destination, setDestination] = useState('')
const [travelType, setTravelType] = useState('Deniz tatili')
const [message, setMessage] = useState('')

function planTrip() {
if (!destination.trim()) {
setMessage('Lütfen önce gitmek istediğin şehri yaz.')
return
}
setMessage(`${destination} için ${travelType} planlama talebin hazır!`)
}

return (
<div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}> <h2>✈️ TripPilo <span style={{ color: '#168bce' }}>AI</span></h2> <span>Akıllı seyahat asistanınız</span> </header>

```
  <section style={{ background: 'white', padding: '32px', borderRadius: '20px', marginTop: '25px', boxShadow: '0 8px 30px #173b6010' }}>
    <p style={{ color: '#168bce', fontWeight: 'bold' }}>✦ YENİ NESİL SEYAHAT DENEYİMİ</p>
    <h1>Hayalindeki seyahati birlikte planlayalım.</h1>
    <p>Gitmek istediğin yeri seç, tatil tarzını belirle ve keşfetmeye başla.</p>

    <label htmlFor="destination">Nereye gitmek istiyorsun?</label>
    <input
      id="destination"
      value={destination}
      onChange={(e) => setDestination(e.target.value)}
      placeholder="Örn. Antalya, İstanbul, Kapadokya"
      style={{ display: 'block', width: '100%', padding: '14px', margin: '10px 0 20px', border: '1px solid #ccd9e5', borderRadius: '10px' }}
    />

    <label htmlFor="travelType">Nasıl bir tatil istiyorsun?</label>
    <select
      id="travelType"
      value={travelType}
      onChange={(e) => setTravelType(e.target.value)}
      style={{ display: 'block', width: '100%', padding: '14px', margin: '10px 0 20px', border: '1px solid #ccd9e5', borderRadius: '10px', background: 'white' }}
    >
      <option>Deniz tatili</option>
      <option>Kültür ve gezi</option>
      <option>Doğa ve macera</option>
      <option>Aile tatili</option>
      <option>Lüks tatil</option>
    </select>

    <button onClick={planTrip} style={{ width: '100%', padding: '15px', border: 'none', borderRadius: '10px', background: '#168bce', color: 'white' }}>
      Seyahatimi Planla →
    </button>

    {message && <p role="status" style={{ padding: '12px', background: '#e8f5ff', borderRadius: '8px' }}>{message}</p>}
  </section>

  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '24px' }}>
    <article style={{ background: 'white', padding: '22px', borderRadius: '16px' }}>
      <h2>🏨</h2><h3>Oteller</h3><p>Konaklama seçeneklerini keşfet.</p>
    </article>
    <article style={{ background: 'white', padding: '22px', borderRadius: '16px' }}>
      <h2>🧭</h2><h3>Turlar</h3><p>Sana uygun deneyimleri bul.</p>
    </article>
    <article style={{ background: 'white', padding: '22px', borderRadius: '16px' }}>
      <h2>🚗</h2><h3>Transfer</h3><p>Ulaşımını kolaylaştır.</p>
    </article>
  </div>

  <footer style={{ textAlign: 'center', padding: '30px 0', color: '#687d90' }}>
    © 2026 TripPilo AI · Yeni yerler keşfet.
  </footer>
</div>


)
}

export default App
