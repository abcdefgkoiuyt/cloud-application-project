import { getPool } from '../../../lib/db'

export default async function handler(req, res) {
  const { id } = req.query

  try {
    const pool = await getPool()

    if (req.method === 'DELETE') {
      // Delete an item by id
      const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [id])
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Item not found' })
      }
      res.status(200).json({ success: true, item: result.rows[0] })
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (err) {
    console.error('DB error', err)
    res.status(500).json({ success: false, error: err.message })
  }
}
