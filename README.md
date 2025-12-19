# Next.js sample app using Google Cloud (App Engine + Cloud SQL + Secret Manager)

This sample shows a Next.js app with a simple add/remove items interface that connects to Cloud SQL (PostgreSQL) on App Engine.

**Features:**
- Add and delete items from Cloud SQL database
- Clean table-based UI showing all items
- Cloud Build CI/CD pipeline
- Environment variable configuration (Secret Manager support available)

**Files:**
- `pages/index.js` — Main UI with items table and add/delete functionality
- `pages/api/items.js` — API endpoint to GET all items or POST new item
- `pages/api/items/[id].js` — API endpoint to DELETE item by ID
- `pages/api/db.js` — Simple DB test endpoint
- `lib/db.js` — Database connection pool manager
- `scripts/init-db.sql` — Database schema and sample data
- `scripts/init-db.js` — Migration runner script
- `app.yaml` — App Engine configuration
- `cloudbuild.yaml` — Cloud Build configuration

## Quick Start

### 1. Initialize the database

After deploying your app, run the migration to create the `items` table and insert sample data:

```bash
# Set environment variables matching your app.yaml
export DB_USER="myuser"
export DB_PASSWORD="Ashu@123"
export DB_NAME="mydb"
export INSTANCE_CONNECTION_NAME="focus-vertex-481519-n4:us-central1:cloud-project"

# Run the migration (requires Cloud SQL Proxy or App Engine environment)
node scripts/init-db.js
```

**Alternative:** Connect to Cloud SQL via Cloud SQL Proxy and run the SQL directly:

```bash
# Start Cloud SQL Proxy
cloud-sql-proxy focus-vertex-481519-n4:us-central1:cloud-project

# In another terminal, connect with psql
psql "host=127.0.0.1 user=myuser dbname=mydb" < scripts/init-db.sql
```

### 2. Deploy and test

The app is already configured for Cloud Build deployment. Push to trigger:

```bash
git add .
git commit -m "Add items CRUD functionality"
git push
```

Visit your App Engine URL to see the items table and add/remove items.

## Database Schema

The app uses a simple `items` table:

```sql
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

- `GET /api/items` — List all items
- `POST /api/items` — Add new item (body: `{name, description}`)
- `DELETE /api/items/[id]` — Delete item by ID
- `GET /api/db` — Test DB connection (returns current timestamp)

## Deployment steps (high-level)

1. Enable APIs and create resources:

```bash
gcloud services enable appengine.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com
gcloud app create --region=YOUR_APP_ENGINE_REGION
```

2. Create a Cloud SQL instance (Postgres example):

```bash
gcloud sql instances create my-postgres-instance --database-version=POSTGRES_15 --region=YOUR_SQL_REGION
gcloud sql users set-password postgres --instance=my-postgres-instance --password="YOUR_DB_ROOT_PASSWORD"
gcloud sql databases create mydb --instance=my-postgres-instance
```

3. Get the instance connection name (used by App Engine to mount the socket):

```bash
gcloud sql instances describe my-postgres-instance --format='value(connectionName)'
# -> PROJECT:REGION:INSTANCE
```

4. Create a secret in Secret Manager containing the DB user, password, and database name. Example payload (adapt to your DB user):

```bash
gcloud secrets create db-credentials --replication-policy="automatic"
gcloud secrets versions add db-credentials --data-file=- <<EOF
{
  "user": "postgres",
  "password": "YOUR_DB_PASSWORD",
  "database": "mydb"
}
EOF
```

5. Grant App Engine default service account access to Secret Manager and Cloud SQL:

```bash
PROJECT_ID=$(gcloud config get-value project)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

6. Update `app.yaml`:

- Replace `INSTANCE_CONNECTION_NAME` value with your instance connection name (PROJECT:REGION:INSTANCE) or provide it at deploy time.
- Optionally set `SECRET_NAME` if you used a different name.

7. Deploy to App Engine:

```bash
gcloud app deploy --project=$PROJECT_ID --quiet
```

Notes & troubleshooting

- App Engine will run the `gcp-build` script if present — that's why the project uses `gcp-build` to run `next build` during deploy.
- The app code reads `SECRET_NAME` and `INSTANCE_CONNECTION_NAME` from environment variables. You can set them in `app.yaml` or pass them at deploy time:

```bash
gcloud app deploy --set-env-vars=INSTANCE_CONNECTION_NAME=PROJECT:REGION:INSTANCE,SECRET_NAME=db-credentials
```

- If you run locally for development, you can create a `.env` with `SECRET_NAME` and `GOOGLE_CLOUD_PROJECT`, but the Secret Manager client will attempt to use your local gcloud credentials. For local testing you may prefer to set DB connection details via env vars and bypass Secret Manager in `lib/db.js`.

If you want, I can:
- Add a Dockerfile and instructions for App Engine Flexible.
- Add a migration / seed script to create a sample table and rows.
- Add CI (Cloud Build) steps to automate deployment.

**Cloud Build (CI) Integration**

You can use Google Cloud Build to build the Next.js app and deploy to App Engine automatically.

- Add the `cloudbuild.yaml` file to the repo (already provided in this sample). The build performs:
  - `npm ci` and `npm run gcp-build` to build the Next.js app
  - `gcloud app deploy app.yaml` to deploy to App Engine

- The `cloudbuild.yaml` uses substitutions for the Cloud SQL instance connection name and secret name:
  - `_INSTANCE_CONNECTION_NAME` — Cloud SQL instance connection name (PROJECT:REGION:INSTANCE)
  - `_SECRET_NAME` — Secret Manager secret name storing DB credentials

Example trigger or manual build command (replace values):

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_INSTANCE_CONNECTION_NAME=PROJECT:REGION:INSTANCE,_SECRET_NAME=db-credentials
```

Create a Cloud Build trigger to deploy on push to `main`:

1. Go to Cloud Console -> Cloud Build -> Triggers -> "Create Trigger".
2. Select your repo (Cloud Source Repositories, GitHub, or Bitbucket) and branch (e.g. `main`).
3. Set the build configuration to use `cloudbuild.yaml` in the repo root.
4. Add trigger substitutions if desired, or rely on defaults in `cloudbuild.yaml`.

IAM: grant the Cloud Build service account deploy permission

Cloud Build runs under the Cloud Build service account: `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`.
Give it the following roles so it can deploy and (optionally) access secrets at build time:

```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# Allow Cloud Build to deploy to App Engine
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/appengine.deployer"

# Optional: allow Cloud Build to access Secret Manager (if you want build-time access)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Runtime IAM: allow App Engine runtime to access Secret Manager and Cloud SQL

The App Engine app runs under the App Engine default service account: `PROJECT_ID@appspot.gserviceaccount.com`.
Grant it the same roles as described earlier for runtime access:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

Testing a build quickly

To run the Cloud Build workflow locally (or from CI manually), use:

```bash
gcloud builds submit --config=cloudbuild.yaml . \
  --substitutions=_INSTANCE_CONNECTION_NAME=PROJECT:REGION:INSTANCE,_SECRET_NAME=db-credentials
```

After a successful build Cloud Build will deploy your app to App Engine.

# cloud-application-project