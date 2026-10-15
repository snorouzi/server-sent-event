# NestJS SSE Demo

A small, self-contained example of **Server-Sent Events (SSE)** with NestJS and a
vanilla JavaScript frontend. It shows the full flow:

```text
HTTP POST /events  ->  NestJS backend  ->  SSE broadcast  ->  every connected browser
```

## 1. What is SSE?

Server-Sent Events is a one-way, HTTP-based way for a server to push messages to
a browser over a single long-lived connection:

- The client opens a normal HTTP request with `Accept: text/event-stream`.
- The server keeps that request open and writes `text/event-stream` chunks as
  they become available.
- The browser's built-in `EventSource` API consumes them, and reconnects
  automatically if the connection drops.

SSE is unidirectional (server to client). Data sent from the browser to the
server still uses a normal HTTP request, for example `POST /events`, which this
example then broadcasts to all connected clients. SSE is a good fit when you only
need server-to-client push (notifications, job progress, live updates) without
the overhead of WebSockets.

## 2. How this example works

```text
src/
├── events/
│   ├── events.controller.ts   # GET /events (SSE stream) and POST /events (broadcast)
│   ├── events.service.ts      # in-memory registry of connected SSE clients
│   ├── events.module.ts
│   └── events.service.spec.ts # unit tests for the broadcast registry
├── app.module.ts
└── main.ts                    # serves the static frontend from public/
public/
├── index.html                 # demo page
├── style.css
└── app.js                     # EventSource + fetch, no framework
test/
└── app.e2e-spec.ts
```

The request flow:

```text
Browser Tab A ──┐
Browser Tab B ──┼──> GET /events  ──> NestJS  (each connection becomes one Subject)
Browser Tab C ──┘                          |
                                           | in-memory Set of clients
POST /events { "message": "Hello" }  ─────> broadcast to every Subject
```

`EventsService` keeps one RxJS `Subject` per connected client in a `Set`. Each
`GET /events` call subscribes to its own subject, and Nest unsubscribes when the
HTTP response closes, which removes that client from the set. `POST /events`
pushes the parsed JSON body into every subject, so all connected clients receive
the same event. Nothing is persisted, so a restart clears all state.

## 3. Install

```bash
npm install
```

## 4. Run

```bash
npm run start:dev
```

The app starts on <http://localhost:3000> (override with `PORT=4000 npm run start:dev`).

## 5. Open the frontend

Visit <http://localhost:3000> and the demo page opens. It shows:

- a connection status pill (`Connected`, `Reconnecting...`, `Disconnected`),
- a form with a message input and an event type input,
- a live list of received events with the time each one arrived.

Fill in the form, submit it, and every connected tab receives the event.

Open the page in several tabs or windows to watch a single `POST` fan out to all
of them. Open or close a tab and every page updates its `clients: N` counter
immediately, because the backend publishes a `clients` event whenever a client
connects or disconnects.

## 6. Test with curl

Subscribe in one terminal:

```bash
curl -N http://localhost:3000/events
```

It prints a `clients` event (the number of connected SSE clients) followed by
every broadcast:

```text
event: clients
id: 1
data: {"clients":1}

event: message
id: 2
data: {"message":"Hello SSE","type":"test"}
```

Then, in another terminal, post an event:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello SSE","type":"test"}'
```

The first terminal prints:

```text
event: message
id: 2
data: {"message":"Hello SSE","type":"test"}
```

and the POST response confirms the broadcast:

```json
{
  "success": true,
  "message": "Event broadcast successfully",
  "clients": 1,
  "data": { "message": "Hello SSE", "type": "test" }
}
```

`-N` disables curl's output buffering, which is what keeps the stream visible.

## 7. Test multiple clients

Run the subscriber command in three terminals:

```bash
curl -N http://localhost:3000/events
```

Post once from a fourth terminal:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello everyone","type":"broadcast"}'
```

All three terminals print the same event, and the response reports
`"clients": 3`. Kill one of the three (`Ctrl+C`), post again, and the response
now reports `"clients": 2` while the two remaining terminals keep receiving
events.

The same thing in a browser: open <http://localhost:3000> in three tabs, submit
the form in one of them, and watch the event appear in all three.

## 8. Event format

The body of `POST /events` is arbitrary JSON and is forwarded unchanged:

```text
event: message
data: {"message":"Hello","type":"test"}
```

On the client, subscribe to the named event with
`eventSource.addEventListener('message', ...)` (a named event needs an explicit
listener; the default `message` event would arrive on `onmessage`).

## 9. Error handling

Backend:

- Nest's JSON body parser rejects malformed JSON with `400` before the handler
  runs.
- The handler rejects bodies that are not a JSON object (arrays, `null`,
  strings) with `400` and a message.
- Posting when nobody is connected is not an error: the response says
  `Event broadcast successfully (no connected SSE clients)` with `"clients": 0`.
- Disconnected clients are removed when Nest unsubscribes from the stream, and a
  client that fails mid-broadcast is dropped from the set instead of breaking the
  broadcast for everyone else.

Frontend:

- The status pill reflects `EventSource` state (`open` -> connected, `error`
  -> reconnecting).
- `EventSource` reconnects on its own after a dropped connection; the page
  recreates the connection if the browser has fully closed it.
- POST errors and network failures are shown next to the send button.

## 10. CORS

No CORS configuration is used. The frontend is served by the same NestJS server
(`main.ts` calls `app.useStaticAssets(join(__dirname, '..', 'public'))`), so the
page uses relative URLs:

```javascript
const eventSource = new EventSource('/events');

await fetch('/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, type }),
});
```

## 11. Tests

```bash
npm test        # unit tests for the broadcast registry
npm run test:e2e # HTTP tests for the page, static assets and POST /events
npm run lint
```

## 12. License

This project is licensed under the MIT License. See the [`LICENSE`](./LICENSE)
file for details.