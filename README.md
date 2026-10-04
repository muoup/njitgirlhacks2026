# loam gnome

A soil monitor for garden beds, built for GirlHacks 2026 at NJIT.

Every plant gets a monitor in its soil and a mushroom in an enchanted grove. The
mushroom glows green when the plant is fine, amber when it is worth a look, and
wilts red when something needs doing today, so one glance tells you which plant
needs you.

## How it works

```
 monitor (Arduino)  ──readings──▶  server (Bun + Elysia)  ◀──session──  frontend (React)
 soil, light, air,                 auth, storage, calibration,          the grove, the trail,
 warmth, leaf colour               Gemini insights and chat             the shed, the mentors
                                          │
                                          ▼
                              Tiger Cloud / PostgreSQL
```

1. A monitor beside the plant measures soil moisture, light, air quality,
   pressure, temperature and leaf colour, and uploads them with the plant's own
   API key.
2. The server stores the raw samples and turns them into readings a gardener can
   use: a position on a 0–100 scale and a word such as *Dry*, *Damp* or *Bright*.
3. Gemini writes a short overview for each plant and picks what to show for it
   from a fixed kit of blocks (readings, chart, meter, stat, steps), along with
   the order of the garden's trail. The model chooses and writes; every number,
   scale and healthy range comes from the data.
4. The frontend draws the result.

There are three places in the app:

- **The garden** (`/dashboard`): a trail through your plants, starting with the
  ones that need you. Each stop has the plant's readings and a note on how it is
  doing, with history over the last 24 hours or 7 days.
- **The potting shed** (`/shed`): where you start gardens and add plants. Each
  plant comes with a key for its monitor.
- **The mentor** (`/mentor`): Burdock the gnome and Moss the wizard answer
  questions about your plants. They know the same things and say them
  differently. Changes they propose to your garden only happen once you approve
  them.

## Repository layout

| Path | What it is |
| --- | --- |
| `frontend/` | React 19 app served by Bun, with Tailwind 4 and React Router |
| `server/` | Bun/Elysia API: Better Auth sessions, PostgreSQL storage, sensor ingestion, the Gemini harness |
| `sensorapp/` | PlatformIO firmware for the Arduino Uno R4 WiFi monitor |
| `dev.sh`, `prod.sh` | Launch the frontend and server together |

## Quick start

You need [Bun](https://bun.com) (the project was built on 1.4).

```bash
(cd frontend && bun install)
(cd server && bun install)
cp frontend/.env.example frontend/.env
cp server/.env.example server/.env
./dev.sh
```

The frontend is at http://localhost:3000 and the server at http://localhost:3001,
with interactive API docs at http://localhost:3001/openapi.

With `DATABASE_URL` left empty the server runs on fixture data and in-memory
auth, and seeds a demo account:

- Email: `demo@grove.local`
- Password: `GroveDemo2026!`

In this mode nothing survives a restart, and creating or removing gardens and
plants returns `501`. For those, and for durable accounts, connect a database.

## Configuration

Each service loads its own `.env`; the examples document every setting.

| Setting | Where | Needed for |
| --- | --- | --- |
| `BUN_PUBLIC_API_URL` | `frontend/.env` | Always. The server's origin as the browser reaches it |
| `BETTER_AUTH_URL`, `FRONTEND_ORIGINS` | `server/.env` | Always. The server's public origin and the frontend origins allowed to call it |
| `BETTER_AUTH_SECRET` | `server/.env` | Production. Optional in development |
| `DATABASE_URL`, `DEVICE_API_KEY_ENCRYPTION_KEY` | `server/.env` | Real storage. See [server/TIGER_SETUP.md](server/TIGER_SETUP.md) |
| `GOOGLE_VERTEX_PROJECT` | `server/.env` | The mentor and generated insights. See [server/VERTEX_SETUP.md](server/VERTEX_SETUP.md) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `server/.env` | Google sign-in. Email and password work without it |

Without Vertex credentials the app still runs; the mentor reports an error
instead of replying, and the dashboard shows readings without generated
overviews.

## Checks

```bash
(cd server && bun run typecheck && bun test)
(cd frontend && bun run typecheck && bun test && bun run build)
```

The server's tests run against an embedded PostgreSQL and never call Google.

## Deployment

```bash
./prod.sh          # database-backed, after Tiger setup
./prod.sh --demo   # fixtures and in-memory auth
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for ports, environment and reverse-proxy
timeouts.

## The monitor

`sensorapp/` targets an Arduino Uno R4 WiFi with:

| Sensor | Connection |
| --- | --- |
| Soil moisture | `A0` |
| Grove air quality | `A1` |
| Light | `A2` |
| SPL07-003 barometer (pressure, temperature) | I2C, `0x77` |
| TCS34725 colour sensor | I2C |
| Green, yellow and red LEDs for soil state | pins `7`, `6`, `5` |

Build and upload with PlatformIO:

```bash
cd sensorapp
pio run -t upload
pio device monitor
```

The colour sensor's library is not in the repository; place it in
`sensorapp/lib/Grove_I2C_Color_Sensor_TCS3472/` before building.

On `main` the sketch polls the sensors once a second, prints them to serial and
lights an LED for the soil. Uploading readings over WiFi is in progress on the
`arduino-ble` branch. The contract it uploads to is in
[server/FIRMWARE_API.md](server/FIRMWARE_API.md), which also has a `curl` example
for sending a reading by hand.

## Further reading

- [server/README.md](server/README.md): routes, storage, authentication and the agent's limits
- [server/AGENT_PROTOCOL.md](server/AGENT_PROTOCOL.md): how the Gemini harness builds context, writes insights and keeps memory
- [server/FIRMWARE_API.md](server/FIRMWARE_API.md): the ingestion contract for monitors
- [server/TIGER_SETUP.md](server/TIGER_SETUP.md) and [server/VERTEX_SETUP.md](server/VERTEX_SETUP.md): database and Gemini setup
- [frontend/README.md](frontend/README.md): frontend configuration and build
