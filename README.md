# Harn-Kan Notification Service

Stores which deal categories each user wants and turns every `deal.created` event into in-app notifications for those users.

Node.js + Express 5 + TypeScript, MongoDB (Mongoose), RabbitMQ (`amqplib`).

## Run

```bash
docker compose up -d --build                        
docker compose up -d --build notification-service   
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

