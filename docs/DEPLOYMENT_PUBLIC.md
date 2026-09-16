# Public deployment

## Web

Pushes to `main` deploy `apps/web` to GitHub Pages. The custom domain is `nexarobot.cloud` through `CNAME`.

The repository must have GitHub Pages configured to use **GitHub Actions** as its source. The workflow is `.github/workflows/pages.yml`.

## API

GitHub Pages cannot run `apps/api/server.mjs`. Deploy the API and worker to a Node-capable service, then set the frontend API base URL to that HTTPS origin. Required production services include a durable PostgreSQL-compatible database, object storage, queue, authentication secrets, and payment webhook credentials.

Do not expose the local SQLite database or filesystem artifact directory as a production service.

## Verification

```powershell
npm test
npm run factory-self-test
npm run verify-system
npm run build
```

After GitHub Actions succeeds, verify:

```powershell
Invoke-WebRequest https://nexarobot.cloud
```

The API must independently pass `/health` and `/ready` on its deployed host before the frontend is considered operational.
