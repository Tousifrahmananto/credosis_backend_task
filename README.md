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

Run with Node.js 22.13 or newer (the start scripts use native optional `.env` loading and SQLite):

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

## Step 2: inspect bus locations

Implemented: `GET /routes/demo-mirpur-farmgate/buses` returns two fictional
bus readings with coordinates, UTC `lastUpdated` timestamps and `isStale` flags.
The response includes `checkedAt` and `staleAfterSeconds: 120`. A reading is
stale when it is **at least two minutes old**. Responses use `Cache-Control: no-store`.

On the first database creation, the samples start 30 seconds and five minutes old.
Saved timestamps survive restarts and stay fixed until an authorized location
update, so both eventually become stale without updates.
These are demonstration coordinates, not moving or live buses. No ETA is calculated.

In Swagger, expand the **Buses** endpoint and use route ID `demo-mirpur-farmgate`.
Try `no-such-route` to see the documented JSON 404, `{"error":"Route not found"}`.
An existing route with no assigned buses returns HTTP 200 with `buses: []`.

```powershell
Invoke-RestMethod http://127.0.0.1:3000/routes/demo-mirpur-farmgate/buses | ConvertTo-Json -Depth 6
```

## Step 3: authenticated GPS updates

Implemented: `POST /buses/{id}/location` updates the coordinates and reading time
for an existing bus. Each bus uses a separate secret bearer token:

- `demo-bus-01`: `TRACKER_TOKEN_DEMO_BUS_01`
- `demo-bus-02`: `TRACKER_TOKEN_DEMO_BUS_02`

Local development tokens are stored in `.env` and ignored by Git. To set up a new
checkout, generate tokens once (this command refuses to overwrite an existing file):

```powershell
node -e "const fs=require('node:fs'); const crypto=require('node:crypto'); fs.writeFileSync('.env', ['TRACKER_TOKEN_DEMO_BUS_01='+crypto.randomBytes(32).toString('hex'), 'TRACKER_TOKEN_DEMO_BUS_02='+crypto.randomBytes(32).toString('hex')].join('\n')+'\n', {flag:'wx'});"
npm start
```

If `.env` already exists, keep it and run `npm start`. Environment variables take
precedence over `.env`. Empty or shorter-than-32-character tokens disable updates
for that bus with HTTP 503. Restart the server after changing tokens.

In Swagger UI:

1. Open `.env` locally and copy the value for `TRACKER_TOKEN_DEMO_BUS_01`.
2. Click **Authorize**, paste the token without `Bearer`, then authorize.
3. Expand `POST /buses/{id}/location`, click **Try it out** and use `demo-bus-01`.
4. Enter numeric `latitude` and `longitude`. Replace `recordedAt` with a fresh UTC
   timestamp from `(Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")`.
5. Execute, then call `GET /routes/demo-mirpur-farmgate/buses` to see the new reading.

Example body (replace the timestamp before sending):

```json
{
  "latitude": 23.799,
  "longitude": 90.371,
  "recordedAt": "2026-11-05T10:00:00.000Z"
}
```

Latitude must be between -90 and 90, longitude between -180 and 180. Numeric
strings, unknown fields, missing fields and invalid calendar dates are rejected.
`recordedAt` must be canonical UTC ISO with milliseconds, no later than server time
and strictly newer than the saved timestamp. Old readings can still be stale;
freshness is based on observation time, not the time the request arrived.

| Status | Meaning |
| --- | --- |
| 200 | Updated bus, visible immediately through the read endpoint |
| 400 | Invalid fields, coordinates, timestamp or malformed JSON |
| 401 | Token missing or incorrect for this bus |
| 404 | Unknown bus |
| 409 | Reading is older than or equal to the saved timestamp |
| 413 | JSON body exceeds 1 KB |
| 415 | Unsupported content type or encoding |
| 503 | Bus token is missing or too short in server configuration |

Rejected updates do not modify bus data. Tokens are not exposed through the API or
Swagger document. Keep `.env` and tokens out of Git, screenshots and walkthroughs.
This remains a local demo; use HTTPS and rotate development tokens before public use.

## Step 4: persistent bus locations

Accepted GPS updates now persist in `data/bus-tracker.sqlite`. The server creates
the directory and table automatically, then inserts missing demo buses without
overwriting saved locations or refreshing their timestamps.

SQLite is used instead of the originally discussed MongoDB so this small demo
can run without a separate database service or account. It uses Node's built-in
`node:sqlite`; no database dependency was added. Node may print its experimental
SQLite warning on supported Node 22/24 versions.

The `buses` table stores the bus ID, route ID, coordinates and reading time.
Parameterized SQL protects values, coordinate constraints protect stored data,
and an atomic `UPDATE ... WHERE recorded_at < ?` rejects older/duplicate writes.
Storage failures return a JSON 503; unreadable database files stop startup rather
than being silently replaced. Tokens stay in environment variables, outside the database.

To check persistence manually, submit a location through Swagger, note its
`lastUpdated`, stop the server, run `npm start` again and read the route's buses.
The coordinates and timestamp should be unchanged; `isStale` can change as time passes.

`DATABASE_PATH` optionally selects another file. Default: `data/bus-tracker.sqlite`
relative to the working directory. The database and sidecar files are ignored by
Git. Tests use separate in-memory or temporary databases, never your demo data.

This synchronous local store suits one small demo instance. Deployment needs a
persistent disk for the SQLite file; ephemeral hosting can lose saved data. Use a
shared database before running multiple application instances.

## Later steps (not implemented)

1. Deployment with durable storage.
2. Demo walkthrough and submission.

The current demo has no arrival estimates or deployment. Seed data and tracker
updates remain simulated; only the saved readings persist.
The integration test starts a real local HTTP server and checks the route response,
sample coordinate bounds and JSON 404 handling.
It also checks the published documentation example against the real API response,
the Swagger page and its JavaScript/CSS assets.
Bus tests cover the exact freshness boundary, unchanged reading timestamps,
route filtering, coordinates, cache headers, documented fields, empty routes and unknown routes.
GPS write tests cover per-bus tokens, missing configuration, coordinate limits,
zero coordinates, invalid timestamps, malformed/oversized JSON, replay rejection,
unchanged data after rejection and immediate read-after-write behavior.
Persistence tests reopen the database in another Node process, check seeds do not
reset saved timestamps, enforce replay protection after reopening, exercise a real
SQLite write lock and reject an unreadable database.

## Backend evaluation criteria

Credosis asks backend candidates to demonstrate API functionality, code structure,
data handling, validation and error handling using Swagger UI or Scalar.

| Criterion | Current evidence | Remaining work |
| --- | --- | --- |
| API functionality | Route discovery, bus-location reads and authenticated GPS updates, tested over HTTP | Deployment |
| Code structure | Separate app, server, route data and OpenAPI document | Add each feature in a small step |
| Data handling | Ordered stops, stable IDs, SQLite persistence, UTC timestamps and computed stale flags | Durable hosting disk |
| Validation | Per-bus tokens, coordinate bounds/types, strict UTC timestamps, atomic newer-reading writes, body limit and unknown-field rejection | Check on deployed instance |
| Error handling | JSON errors for invalid input/authentication, missing resources, stale writes, oversized bodies, configuration and storage failures | Check on deployed instance |
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
Persistence uses [Node's built-in SQLite API](https://nodejs.org/api/sqlite.html).
