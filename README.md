# Harn-Kan Notification Service

Stores which deal categories each user wants and turns every `deal.created` event into in-app notifications for those users.

Node.js + Express 5 + TypeScript, MongoDB (Mongoose), RabbitMQ (`amqplib`).

## Run

The whole system runs from the shared `../compose.yaml` (MongoDB, RabbitMQ and every service). From the `harnkan/` folder:

```bash
docker compose up -d --build                        # everything
docker compose up -d --build notification-service   # rebuild after a code change
```

Locally with watch mode, against the same shared Mongo and RabbitMQ (stop the `notification-service` container first so two consumers don't share the queue):

```bash
cp .env.example .env   # fill in passwords and JWT_SECRET from ../.env
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode with `tsx`, reads `.env` |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm test` | Jest with an in-memory MongoDB (no Docker needed) |
| `npm run typecheck` | `tsc --noEmit` |

`npm test` runs Node with `--experimental-vm-modules`. The MongoDB driver loads `os` with a dynamic `import()`, which fails inside Jest's sandbox without that flag, and every connection is then rejected with "Missing required sub-document 'driver'".

## Configuration

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Default `3002` |
| `MONGO_URI` | yes | e.g. `mongodb://notification_service_app:<password>@localhost:27017/notification_db` |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | yes | |
| `JWT_SECRET` | yes | Must match User Service; HS256 |

The service exits on startup if a required variable is missing.

## REST API

All routes need a JWT: `Authorization: Bearer <token>` first, then cookie `token`. The user id is the claim `id`. Errors use `{ code, message, timestamp }`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `PUT` | `/api/notifications/preferences` | Body `{ "categories": ["DRINK"] }`. Replaces the whole set; dedupes; `[]` turns everything off. 400 for a value outside `DRINK` / `FOOD` (exact match). |
| `GET` | `/api/notifications` | The caller's notifications, newest first |
| `GET` | `/health` | Liveness, no auth |

## Messaging

| Item | Value |
| --- | --- |
| Exchange | `harnkan.events`, topic, durable |
| Queue (owned here) | `notification.deal-created`, durable, bound with `deal.created` |
| Prefetch / ack | 10, manual |

For each event: invalid message → ack and drop; otherwise insert one notification per subscriber except the creator, then ack; any non-duplicate error → `nack` with requeue. Idempotency comes from the unique `(eventId, userId)` index plus `insertMany({ ordered: false })`, so a redelivery fills in only what is missing.

The connection uses amqplib's built-in recovery: it retries at startup (RabbitMQ boots slower) and reconnects forever after that, re-declaring the topology and consumer each time.

### Test without Deal Service

Publish through the RabbitMQ management API. `{"routed":true}` means the queue is bound. Send it twice to confirm no duplicate notifications.

```bash
curl -u guest:guest -H 'Content-Type: application/json' -X POST http://localhost:15672/api/exchanges/%2F/harnkan.events/publish -d '{"properties":{"delivery_mode":2,"content_type":"application/json","message_id":"evt-1","type":"deal.created"},"routing_key":"deal.created","payload_encoding":"string","payload":"{\"eventId\":\"evt-1\",\"eventType\":\"deal.created\",\"occurredAt\":\"2026-10-16T10:00:00Z\",\"dealId\":\"deal-1\",\"creatorId\":\"creator\",\"category\":\"DRINK\",\"shopName\":\"Cafe Amazon\",\"lat\":13.75,\"lng\":100.5}"}'
```

