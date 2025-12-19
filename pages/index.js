import { useState, useEffect } from 'react'

export default function Home() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newItem, setNewItem] = useState({ name: '', description: '' })

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/items')
      const json = await res.json()
      if (json.success) {
        setItems(json.items)
      } else {
        setError(json.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.name.trim()) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      })
      const json = await res.json()
      if (json.success) {
        setNewItem({ name: '', description: '' })
        loadItems()
      } else {
        setError(json.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteItem(id) {
    if (!confirm('Delete this item?')) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        loadItems()
      } else {
        setError(json.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 10 }}>Next.js + Cloud SQL Demo</h1>
      <p style={{ color: '#666', marginBottom: 30 }}>Simple add/remove app using Google Cloud SQL (PostgreSQL) on App Engine</p>

      {error && (
        <div style={{ padding: 15, marginBottom: 20, background: '#fee', border: '1px solid #fcc', borderRadius: 5 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: 30, padding: 20, background: '#f5f5f5', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, marginBottom: 15 }}>Add New Item</h2>
        <form onSubmit={addItem}>
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Item name *"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={loading}
              required
            />
          </div>
          <div style={{ marginBottom: 15 }}>
            <textarea
              placeholder="Description (optional)"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 4, border: '1px solid #ccc', minHeight: 80 }}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newItem.name.trim()}
            style={{
              padding: '10px 20px',
              fontSize: 16,
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: 5,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !newItem.name.trim() ? 0.6 : 1
            }}
          >
            {loading ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      </div>

      <h2>Items ({items.length})</h2>
      {loading && items.length === 0 ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#666' }}>No items yet. Add one above!</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 15 }}>
          <thead>
            <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: 12, textAlign: 'left' }}>ID</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Name</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Description</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Created</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 12 }}>{item.id}</td>
                <td style={{ padding: 12, fontWeight: 500 }}>{item.name}</td>
                <td style={{ padding: 12, color: '#666' }}>{item.description || '-'}</td>
                <td style={{ padding: 12, fontSize: 14, color: '#999' }}>
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button
                    onClick={() => deleteItem(item.id)}
                    disabled={loading}
                    style={{
                      padding: '6px 12px',
                      fontSize: 14,
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
