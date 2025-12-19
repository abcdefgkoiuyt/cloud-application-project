# Next.js sample app using Google Cloud (App Engine + Cloud SQL + Secret Manager)

This sample shows a minimal Next.js app that reads database credentials from Google Secret Manager and connects to Cloud SQL (Postgres) on App Engine.

Files added:
- `pages/index.js` — simple UI that calls the API route
- `pages/api/db.js` — server API that runs a small DB query
- `lib/db.js` — connects to Cloud SQL using credentials from Secret Manager
- `app.yaml` — App Engine configuration
- `package.json` — scripts and dependencies

Quick overview

- Store your DB credentials as a JSON secret in Secret Manager. The secret's payload should be JSON like:

```
{
  "user": "dbuser",
  "password": "secret-password",
  "database": "mydb",
  "host": "127.0.0.1",
  "port": 5432
}
```

- If you prefer to connect via Cloud SQL Unix socket (recommended on App Engine), set the environment variable `INSTANCE_CONNECTION_NAME` and the app will use the socket path `/cloudsql/INSTANCE_CONNECTION_NAME`. For socket mode you still need `user`, `password`, and `database` in the secret, but `host`/`port` are not required.

Deployment steps (high-level)

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