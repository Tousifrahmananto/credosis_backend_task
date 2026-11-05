# Deploying the backend demo

Repository: https://github.com/Tousifrahmananto/credosis_backend_task

## Hosting settings

Use one Node.js 24 instance, or build the included Dockerfile. For a native Node
service, run `npm ci --omit=dev --ignore-scripts` as the build command and `npm start`
as the start command. The project does not need a compilation step.

Set these environment variables through the host's secret/settings interface:

| Variable | Value |
| --- | --- |
| HOST | `0.0.0.0` so the host can reach the API |
| PORT | Use the host's assigned port; otherwise `3000` |
| DATABASE_PATH | A SQLite filename on the mounted persistent disk, e.g. `/app/data/bus-tracker.sqlite` |
| TRACKER_TOKEN_DEMO_BUS_01 | A new random secret with at least 32 characters |
| TRACKER_TOKEN_DEMO_BUS_02 | A different new random secret with at least 32 characters |

Use HTTPS for public access. Public reads and Swagger do not need tracker tokens.
Keep tokens out of repository files, build arguments and video recordings. The
container runs as the non-root `node` user; its database directory must be writable
by that user. Use one instance with the SQLite volume. The local Windows database
is not copied into the image; a new deployment starts with fresh demo seeds.

## Local Docker check

Start Docker Desktop's Linux engine first. From the project directory:

```powershell
docker build -t credosis-bus-tracker:demo .
docker volume create credosis-bus-data
docker run --name credosis-bus-demo --init -d -p 127.0.0.1:3001:3000 --env-file .env -e HOST=0.0.0.0 -e PORT=3000 -e DATABASE_PATH=/app/data/bus-tracker.sqlite --mount type=volume,source=credosis-bus-data,target=/app/data credosis-bus-tracker:demo
```

The explicit `-e` values override local-only settings from `.env`. Open
http://127.0.0.1:3001/docs. Port 3001 avoids the existing local development server.
The named volume keeps database contents outside the container's writable layer.

```powershell
docker inspect --format '{{.State.Health.Status}}' credosis-bus-demo
docker logs credosis-bus-demo
docker stop credosis-bus-demo
docker start credosis-bus-demo
```

After restarting, verify that accepted coordinates and `lastUpdated` remain the
same. Do not delete the named volume if you want to retain these readings.

## Checks after public deployment

1. Open `/docs` and execute `GET /routes`.
2. Execute `GET /routes/demo-mirpur-farmgate/buses` and confirm simulation labels.
3. Confirm a write without the right tracker token returns JSON 401.
4. Privately authorize one bus and submit a current UTC reading. Confirm the read
   endpoint reflects the update; repeat the timestamp to confirm JSON 409.
5. Restart the service and verify the exact reading survives on the persistent disk.

Use `/routes/demo-mirpur-farmgate/buses` as the host's HTTP health-check path. It
checks the route and database read; it intentionally does not require a write token.
Freshness changing to stale is normal and does not make the server unhealthy.

## Current verification

Native server hosting settings, restart persistence and API tests were checked
locally. Docker engine was unavailable during preparation, so the image build,
container permissions and container health check still need a real Docker run.
No public deployment or submission has been performed by the assistant.

Sources: [Docker Node.js guide](https://docs.docker.com/guides/nodejs/) and
[Docker persistent volumes](https://docs.docker.com/engine/storage/volumes/).
