# WebSocket API Specification (home_controller_backend)

Ziel: stabile, WS-first Kommunikation zwischen Adapter und Flutter-App mit klarer Auth-, Heartbeat-, Snapshot- und Delta-Story. Diese Version integriert die App-Review-Punkte aus `iobroker_home_controller/specs/006-websocket-adapter/ws-review-and-proposal.md`.

## 1. Verbindung & Auth
- URL: `wss://<host>:<port>/ws/iobroker` (Standardport 8082, konfigurierbar). HTTP-Upgrade auf demselben Port wie Adapter-Webserver.
- TLS: Self-signed erlaubt; bei Fingerprint-/Zertifikatsfehler Close-Code **4006 CERT_ERROR**.
- Auth: genau ein Verfahren aktiv
  - Bevorzugt: **Basic Auth** im Upgrade-Request (über `Authorization: Basic ...`).
  - Alternative: vorhandenes Session-Cookie aus vorgelagertem Login (`POST /login`) wird akzeptiert.
  - Query-Token nur falls explizit konfiguriert.
- Bei Auth-Fehler: Close 4001 AUTH_FAILED (oder 4002 TOKEN_EXPIRED).

## 2. Heartbeat & Lifecycle
- Ping/Pong: Server sendet Ping alle **25–30s**; erwartet Pong innerhalb **10s**. Bei Timeout Close 4008 IDLE_TIMEOUT.
- Server kann Reconnect-Hints im Close-Reason mitsenden (`retryable=true/false`, `retryAfterMs` optional).
- Close-Codes (Auszug):
  - 4001 AUTH_FAILED
  - 4002 TOKEN_EXPIRED
  - 4003 RATE_LIMIT
  - 4004 PROTOCOL_VERSION_UNSUPPORTED
  - 4005 INVALID_PAYLOAD
  - 4006 CERT_ERROR
  - 4007 SERVER_OVERLOAD
  - 4008 IDLE_TIMEOUT

## 3. Envelope & Versionierung
Alle Nachrichten folgen diesem Schema:
```json
{
  "type": "stateChange",
  "id": "req-123",       // optional für korrelierte Antworten
  "seq": 123456,         // serverseitig monoton steigend
  "ts": "2025-01-07T12:34:56.789Z",
  "version": "1.0",      // Schema-Version
  "payload": { ... },
  "error": { "code": "...", "message": "...", "details": {} } // nur bei Fehlern
}
```
- `seq` auf allen Server→Client-Events; Client→Server optional.
- `ts` immer UTC ISO-8601.
- `version` referenziert das Nachrichtenschema (aktuell "1.0").

## 4. Registrierung & Server-Info
### Client → Server `register`
```json
{
  "type": "register",
  "id": "req-1",
  "payload": {
    "clientName": "Flutter Home App",
    "clientVersion": "1.0.0",
    "clientType": "mobile",
    "lastSeqSeen": 123450,              // optional für Re-Sync
    "acceptCompression": true           // optional
  }
}
```

### Server → Client `registered`
```json
{
  "type": "registered",
  "id": "req-1",
  "payload": {
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "serverVersion": "0.0.1",
    "protocolVersion": "1.0",
    "schemaVersion": "1.0",
    "capabilities": [
      "devices",
      "rooms",
      "stateChange",
      "subscribe",
      "setState",
      "batch",
      "compression"
    ],
    "limits": {
      "maxMsgBytes": 131072,
      "maxEventsPerSecond": 50,
      "supportsBatch": true,
      "supportsCompression": true,
      "defaultSubscription": "all"    // all | none
    }
  }
}
```

### Optional `info`/`health`
- HTTP `GET /health` oder WS-Nachricht `info` mit denselben Feldern wie `registered` (ohne Client-Bindung), inklusive `supportsCompression`, `supportsSubscribeFilters`.

## 5. Initialdaten (Snapshot)
- Devices: kompletter Snapshot inkl. aktueller Werte.
- Rooms/Metrics: enthalten ebenfalls `value` und `ts`.
- Varianten:
  1) WS `initialSnapshot` direkt nach `registered`.
  2) Client ruft `getSnapshot` (WS) oder `GET /snapshot` (HTTP) auf.

### `initialSnapshot` / `getSnapshot` Response
```json
{
  "type": "initialSnapshot",
  "payload": {
    "devices": { ... wie unten ... },
    "rooms": { ... wie unten ... },
    "seq": 123456
  }
}
```

## 6. Datenmodelle
### Device
- `id`: string
- `name`: string
- `type`: string (z.B. light, window, socket)
- `room`: string
- `icon`: string (Emoji)
- `iconKey`: string (App-Icon Registry Key)
- `capabilities`: Capability[]
- `manufacturer`?: string
- `model`?: string
- `description`?: string

### Capability
- `type`: string (toggle, brightness, temperature, position, open_closed, ...)
- `state`: string (ioBroker state id)
- `description`?: string
- `min`?: number
- `max`?: number
- `unit`?: string
- `inverted`?: boolean
- `value`: any   // im Snapshot verpflichtend

### Room
- `id`: string
- `name`: string
- `icon`: string (Emoji)
- `metrics`?: Metric[]

### Metric
- `type`: string (temperature, humidity, ...)
- `state`: string
- `label`?: string
- `unit`?: string
- `value`?: any
- `ts`?: string

## 7. Client → Server Nachrichten
- `register` (s.o.)
- `getDevices`, `getRooms`, `getSnapshot` (liefert identische Strukturen wie `initialSnapshot`)
- `subscribe`
```json
{
  "type": "subscribe",
  "id": "req-sub-1",
  "payload": {
    "deviceIds": ["livingroom_light"],
    "rooms": ["livingroom"],
    "capabilityTypes": ["toggle", "position"]
  }
}
```
- `unsubscribe` mit gleichen Filtern (leerer Payload => alles abmelden).
- `setState`
```json
{
  "type": "setState",
  "id": "req-set-1",
  "payload": {
    "deviceId": "livingroom_light",
    "capability": "toggle",
    "state": "zigbee.0.xxx.state",
    "value": true,
    "ack": false
  }
}
```
- `help`

## 8. Server → Client Nachrichten
- `registered`
- `initialSnapshot` oder `snapshot` (auf Anfrage)
- `devices` / `rooms` (falls getrennt abgefragt)
- `stateChange`
```json
{
  "type": "stateChange",
  "seq": 123457,
  "ts": "2025-01-07T12:35:10.000Z",
  "payload": {
    "deviceId": "livingroom_light",
    "capability": "toggle",
    "state": "zigbee.0.xxx.state",
    "value": true,
    "quality": "good"
  }
}
```
- `stateChangeBatch` (Array von `stateChange` Payloads) für Burst-Situationen.
- `deviceListChanged` (add/update/remove eines Geräts inkl. Capabilities).
- `error` (Schema s. Envelope).
- `throttleHint` optional bei Rate-Limits.

## 9. Ordering, Re-Sync & Defaults
- Alle Events tragen `seq` + `ts`.
- Default-Subscription: **all** Geräte/Rooms nach `registered`, sofern nicht anders konfiguriert. Client kann sofort ein `subscribe` senden, um zu filtern.
- Reconnect: Client darf `lastSeqSeen` im `register` senden. Server versucht fehlende Deltas nachzuliefern; falls nicht möglich, fordert neuer Snapshot an (`type: error`, code `RESYNC_REQUIRED`).

## 10. Backpressure, Limits & Kompression
- Limits werden in `registered.limits` übermittelt (`maxMsgBytes`, `maxEventsPerSecond`, `supportsBatch`, `supportsCompression`).
- Bei Überlast: `stateChangeBatch` oder `throttleHint`; harter Fall: Close 4003 RATE_LIMIT.
- Kompression: permessage-deflate, falls beide Seiten es ankündigen (`acceptCompression` im Register, `supportsCompression` im Registered).

## 11. Fehlercodes (Error Messages)
- AUTH_FAILED, TOKEN_EXPIRED, PERMISSION_DENIED
- UNSUPPORTED_VERSION / PROTOCOL_VERSION_UNSUPPORTED
- INVALID_PAYLOAD / INVALID_MESSAGE
- RATE_LIMIT / SERVER_OVERLOAD
- CERT_ERROR
- UNKNOWN_TYPE
- NOT_REGISTERED
- RESYNC_REQUIRED

## 12. Close-Verhalten
- Harte Fehler (Auth/Version/Cert) => Close mit passendem Code.
- Weiche Fehler (invalid payload, unknown type) => `type: error`, Verbindung bleibt offen.

## 13. Beispielablauf
1) WS-Connect (TLS, Basic Auth).
2) Server Ping/Pong etabliert.
3) Client `register` (optional `lastSeqSeen`, `acceptCompression`).
4) Server `registered` (+Limits).
5) Server sendet `initialSnapshot` oder Client ruft `getSnapshot`.
6) Server pusht `stateChange`/`deviceListChanged`; Client nutzt `seq` für Ordering.
7) Bei Filterbedarf: Client sendet `subscribe`/`unsubscribe`.
8) Bei Steuerung: Client sendet `setState`, Server bestätigt über Status-Change-Event oder optional `ack`.
