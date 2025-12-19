import { getPool } from '../../lib/db'

export default async function handler(req, res) {
  try {
    const pool = await getPool()
    const result = await pool.query('SELECT NOW() as now')
    res.status(200).json({ success: true, time: result.rows[0].now })
  } catch (err) {
    console.error('DB error', err)
    res.status(500).json({ success: false, error: err.message })
  }
}
