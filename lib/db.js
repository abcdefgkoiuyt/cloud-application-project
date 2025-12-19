import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { Pool } from 'pg'

let poolPromise = null

async function getSecretPayload(secretName) {
  const client = new SecretManagerServiceClient()
  
  // Log authentication info for debugging
  const authClient = await client.auth.getClient()
  console.log('Auth client type:', authClient.constructor.name)
  if (authClient.email) {
    console.log('Service account email:', authClient.email)
  }
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
  console.log('Project ID:', projectId)
  console.log('SECRET_NAME:', secretName)
  
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not set')
  }
  if (!secretName) {
    throw new Error('SECRET_NAME environment variable is required')
  }
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`
  console.log('Accessing secret:', name)
  
  const [version] = await client.accessSecretVersion({ name })
  const payload = version.payload && version.payload.data ? Buffer.from(version.payload.data, 'base64').toString('utf8') : null
  if (!payload) throw new Error('Secret payload empty')
  return JSON.parse(payload)
}

export async function getPool() {
  if (poolPromise) return poolPromise

  poolPromise = (async () => {
    const secretName = process.env.SECRET_NAME
    const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME

    const cfg = await getSecretPayload(secretName)

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
