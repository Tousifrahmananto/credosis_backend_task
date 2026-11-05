# Dhaka bus tracker: Credosis demo

A backend demo of the bus-tracking idea discussed for Credosis Phase 02.
We are building and reviewing one step at a time.

## Step 1: discover routes

Implemented: `GET /routes` returns one sample route and its ordered stops.
Unknown endpoints return a JSON 404 error.

All service data is fictional. Stop coordinates are approximate and the API
labels its response `dataMode: simulated`. This is not an official bus service,
verified route, timetable or source of live travel information.

Project location: `G:\credosis-bus-tracker`.

Run with Node.js 18 or newer:

```powershell
npm ci
npm test
npm start
```

Open http://127.0.0.1:3000/docs for **Swagger UI**. Expand `GET /routes`,
select **Try it out**, then **Execute** to call the running API.
The OpenAPI 3.0 document is available at http://127.0.0.1:3000/openapi.json.
Swagger assets are served locally; no CDN is needed.

For a direct API call, open http://127.0.0.1:3000/routes or run:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/routes | ConvertTo-Json -Depth 6
```

The server listens locally on port 3000. Stop it with Ctrl+C.

## Later steps (not implemented)

1. Bus locations for a selected route with timestamps and stale-data flags.
2. Authenticated, validated GPS updates and persistent storage.
3. Extend Swagger documentation alongside each endpoint, then record the demo walkthrough.

Step 1 has no database, location updates, authentication, arrival estimates or deployment.
The integration test starts a real local HTTP server and checks the route response,
sample coordinate bounds and JSON 404 handling.
It also checks the published documentation example against the real API response,
the Swagger page and its JavaScript/CSS assets.

## Backend evaluation criteria

Credosis asks backend candidates to demonstrate API functionality, code structure,
data handling, validation and error handling using Swagger UI or Scalar.

| Criterion | Current evidence | Remaining work |
| --- | --- | --- |
| API functionality | Working `GET /routes`, tested over HTTP | Bus location reads and GPS updates |
| Code structure | Separate app, server, route data and OpenAPI document | Add each feature in a small step |
| Data handling | Ordered stops, stable IDs, explicit simulation label | Persist bus location updates |
| Validation | Test checks sample coordinate bounds | Validate external GPS inputs when the write endpoint is added |
| Error handling | JSON 404 for unknown endpoints and unsupported methods | Authentication, invalid-input and missing-bus errors |
| API demonstration | Swagger UI at `/docs`, examples and response schemas | Document new endpoints as they are implemented |

This is an early milestone, not the completed recruitment submission. The final
demo needs one core feature with 2-3 supporting features, accessible repository
and demonstration links, plus a 3-5 minute walkthrough. The supplied deadline is
8 November 2026 at 11:59 PM Bangladesh time. AI assistance is permitted, but the
candidate must understand and explain the code.

## Push this milestone to GitHub

The project has its own Git repository. The lockfile belongs in Git;
`node_modules`, `.env` files and logs are ignored. Create an empty GitHub repository,
then use its actual URL in the command below:

```powershell
Set-Location G:\credosis-bus-tracker
git add .
git commit -m "Add route discovery API and Swagger documentation"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Check `git status` before committing. GitHub authentication is required for the
push. This project has not been pushed, deployed or submitted by the assistant.

Express setup follows the [official Express example](https://expressjs.com/en/starter/hello-world/).
Swagger assets follow the [official Swagger UI installation documentation](https://swagger.io/docs/open-source-tools/swagger-ui/usage/installation/).
