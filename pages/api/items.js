import { getPool } from '../../lib/db'

export default async function handler(req, res) {
  try {
    const pool = await getPool()

    if (req.method === 'GET') {
      // List all items
      const result = await pool.query('SELECT * FROM items ORDER BY created_at DESC')
      res.status(200).json({ success: true, items: result.rows })
    } else if (req.method === 'POST') {
      // Add a new item
      const { name, description } = req.body
      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' })
      }
      const result = await pool.query(
        'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *',
        [name, description || '']
      )
      res.status(201).json({ success: true, item: result.rows[0] })
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (err) {
    console.error('DB error', err)
    res.status(500).json({ success: false, error: err.message })
  }
}
