import { Pool } from 'pg'

let poolPromise = null

// Bypass Secret Manager - use env vars directly
async function getDbConfig() {
  // Check if using env vars directly (bypass Secret Manager)
  if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
    console.log('Using DB credentials from environment variables')
    return {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    }
  }
  
  // Fallback: hardcoded for local testing (remove this in production)
  console.log('WARNING: Using hardcoded credentials - not recommended for production')
  return {
    user: 'myuser',
    password: 'Ashu@123',
    database: 'mydb'
  }
}

export async function getPool() {
  if (poolPromise) return poolPromise

  poolPromise = (async () => {
    const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME

    const cfg = await getDbConfig()

    // cfg expected to contain at least: user, password, database
    // If INSTANCE_CONNECTION_NAME is set, we'll connect via Unix socket mounted at /cloudsql/<INSTANCE>
    let poolConfig = {
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      max: cfg.max || 5,
      idleTimeoutMillis: cfg.idleTimeoutMillis || 60000,
    }

    if (instanceConnectionName) {
      // Connect using unix socket path
      // The socket directory should be `/cloudsql/<INSTANCE_CONNECTION_NAME>` on App Engine
      poolConfig.host = `/cloudsql/${instanceConnectionName}`
      // port can remain default (5432)
    } else if (cfg.host) {
      poolConfig.host = cfg.host
      if (cfg.port) poolConfig.port = cfg.port
    } else {
      throw new Error('No connection method: set INSTANCE_CONNECTION_NAME or provide host in secret payload')
    }

    const pool = new Pool(poolConfig)
    // test a connection once
    await pool.query('SELECT 1')
    return pool
  })()

  return poolPromise
}
