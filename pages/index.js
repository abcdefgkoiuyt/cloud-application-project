import { useState } from 'react'

export default function Home() {
  const [msg, setMsg] = useState('No data yet')

  async function fetchDb() {
    setMsg('Loading...')
    try {
      const res = await fetch('/api/db')
      const json = await res.json()
      setMsg(JSON.stringify(json))
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
  }

  return (
    <main style={{padding: 40}}>
      <h1>Next.js + Google Cloud SQL (sample)</h1>
      <p>This demo app shows how to keep DB credentials in Secret Manager and query Cloud SQL.</p>
      <button onClick={fetchDb}>Call /api/db</button>
      <pre style={{marginTop:20, whiteSpace: 'pre-wrap'}}>{msg}</pre>
    </main>
  )
}
