# Harn-Kan Notification Service

Stores which deal categories each user wants, turns every `deal.created` event into in-app and push notifications for nearby users who want that category, and tells participants when a deal they paid into is cancelled or expires (`deal.cancelled`, `deal.expired`).

Node.js + Express 5 + TypeScript, MongoDB (Mongoose), RabbitMQ (`amqplib`).

## Run

MongoDB and RabbitMQ run from `../docker-dependencies`, which also creates the
shared `harnkan-net` network. Start that first, then:

```bash
docker compose up -d --build
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
| `EXPO_ACCESS_TOKEN` | no | Only when enhanced push security is on in the Expo project |
| `USER_SERVICE_URL` | yes | e.g. `http://localhost:3000`; used for the nearby user lookup |

The service exits on startup if a required variable is missing.

## REST API

All routes need a JWT: `Authorization: Bearer <token>` first, then cookie `token`. The user id is the claim `id`. Errors use `{ code, message, timestamp }`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/notifications/preferences` | `{ userId, categories, updatedAt }`. A user who never saved gets `categories: []`, `updatedAt: null`; nothing is written. |
| `PUT` | `/api/notifications/preferences` | Body `{ "categories": ["DRINK"] }`. Replaces the whole set; dedupes; `[]` turns everything off. Stores the values in `notification_prefs` in `notification_db`, keyed by the JWT user ID. 400 for a value outside `DRINK` / `FOOD` (exact match). |
| `GET` | `/api/notifications` | `{ unreadCount, items }`, items newest first. Each item has `type`: `DEAL_CREATED`, `DEAL_CANCELLED` or `DEAL_EXPIRED`. |
| `PATCH` | `/api/notifications/{id}/read` | Marks one of the caller's notifications read and returns it; repeating is harmless. 404 if unknown or not the caller's. |
| `PUT` | `/api/notifications/devices` | Body `{ "token": "ExponentPushToken[...]", "platform": "ios" \| "android" }`. Registers the device for push; safe to repeat. A token registered by another user moves to the caller. 400 for a token that is not an Expo push token. |
| `DELETE` | `/api/notifications/devices/{token}` | Stops push to that device. Always `204`; only the caller's own token is removed. |
| `GET` | `/health` | Liveness, no auth |

Existing preference documents using the old `categories` field are migrated to
`notification_prefs` when the service connects to MongoDB.

## Messaging

| Item | Value |
| --- | --- |
| Exchange | `harnkan.events`, topic, durable |
| Queue (owned here) | `notification.deal-created`, durable, bound with `deal.created` |
| Queue (owned here) | `notification.deal-closed`, durable, bound with `deal.cancelled` and `deal.expired` |
| Prefetch / ack | 10, manual |

- `deal.created` notifies users within 500 m of the deal who subscribe to its category, except the creator. User Service answers who is nearby; users without a location from the last 24 hours are not included.
- `deal.cancelled` / `deal.expired` notify each user in `participantIds` (the people being refunded), regardless of preferences. An empty list is acked with nothing created.
- A malformed message, or coordinates User Service rejects with a 400, is acked and dropped. A failure such as MongoDB or User Service being down is requeued. For `deal.created` the requeue waits 5 seconds, and an event more than 30 minutes old is acked and dropped instead, so nobody is told about an old deal as new; `deal.cancelled` / `deal.expired` requeue immediately and are never dropped this way. The unique `(eventId, userId)` index makes redeliveries harmless.

## Push

Pushes always go through the Expo Push API. The inbox in MongoDB stays the source of truth; push is best-effort.

- Every notification pushes to all registered devices of its recipient: `deal.created` to nearby subscribers, `deal.cancelled` / `deal.expired` to participants.
- The push runs after the message is acked, and only for notifications created by that delivery, so a redelivery never pushes twice and a push failure never requeues.
- Each push has `data: { type, dealId, notificationId }` so the app can open the deal and mark the notification read.
- Tokens that Expo reports as `DeviceNotRegistered` are deleted. Other failures are logged and not retried; push receipts are not checked yet.
- Device tokens live in the `device_tokens` collection, unique by token (a user can have several devices).
