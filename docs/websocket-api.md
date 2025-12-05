# WebSocket API Documentation

This document describes the WebSocket API for the Home Controller Adapter.

## Connection

Connect to the WebSocket server at:

```
ws://<host>:<port>
```

Default port: **8082** (configurable in adapter settings)

## Message Format

All messages are JSON objects with the following base structure:

```typescript
{
  "type": string,      // Required: Message type
  "id"?: string,       // Optional: Request ID for response matching
  "payload"?: object,  // Optional: Message-specific data
  "error"?: {          // Only in error responses
    "code": string,
    "message": string
  }
}
```

## Connection Flow

```
┌──────────┐                          ┌──────────┐
│  Client  │                          │  Server  │
└────┬─────┘                          └────┬─────┘
     │                                     │
     │ ──────── WebSocket Connect ───────► │
     │                                     │
     │ ──────── register ────────────────► │
     │ ◄─────── registered ────────────── │
     │                                     │
     │ ──────── getDevices ──────────────► │
     │ ◄─────── devices ──────────────── │
     │                                     │
     │ ──────── getRooms ────────────────► │
     │ ◄─────── rooms ────────────────── │
     │                                     │
```

---

## Client → Server Messages

### `register`

Register the client with the server. **Must be called first** before any other requests.

**Request:**
```json
{
  "type": "register",
  "id": "req-123",
  "payload": {
    "clientName": "Flutter Home App",
    "clientVersion": "1.0.0",
    "clientType": "mobile"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientName` | string | Yes | Human-readable name of the client |
| `clientVersion` | string | Yes | Client version |
| `clientType` | string | Yes | One of: `mobile`, `web`, `desktop`, `other` |

**Response:** [`registered`](#registered)

---

### `getDevices`

Get all configured devices.

**Request:**
```json
{
  "type": "getDevices",
  "id": "req-456"
}
```

**Response:** [`devices`](#devices)

---

### `getRooms`

Get all configured rooms.

**Request:**
```json
{
  "type": "getRooms",
  "id": "req-789"
}
```

**Response:** [`rooms`](#rooms)

---

## Server → Client Messages

### `registered`

Confirmation of successful registration.

```json
{
  "type": "registered",
  "id": "req-123",
  "payload": {
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "serverVersion": "0.0.1",
    "capabilities": ["devices", "rooms"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `clientId` | string | Unique ID assigned to this client (UUID) |
| `serverVersion` | string | Server version |
| `capabilities` | string[] | Available API features |

---

### `devices`

Response containing all devices.

```json
{
  "type": "devices",
  "id": "req-456",
  "payload": {
    "devices": {
      "livingroom_light": {
        "name": "Wohnzimmer Lampe",
        "type": "light",
        "room": "livingroom",
        "icon": "💡",
        "capabilities": [
          {
            "type": "toggle",
            "state": "zigbee.0.xxx.state",
            "description": "On/Off"
          }
        ],
        "manufacturer": "Ikea",
        "model": "Smart Light",
        "description": "Lampe im Wohnzimmer"
      }
    }
  }
}
```

#### Device Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name |
| `type` | string | Yes | Device type (e.g., `light`, `window`, `socket`) |
| `room` | string | Yes | Room ID |
| `icon` | string | Yes | Emoji icon |
| `capabilities` | array | Yes | List of device capabilities |
| `manufacturer` | string | No | Manufacturer name |
| `model` | string | No | Model name |
| `description` | string | No | Description |

#### Capability Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Capability type (e.g., `toggle`, `brightness`, `temperature`) |
| `state` | string | Yes | ioBroker state ID |
| `description` | string | No | Human-readable description |
| `min_value` | number | No | Minimum value (for numeric types) |
| `max_value` | number | No | Maximum value (for numeric types) |
| `unit` | string | No | Unit (e.g., `%`, `°C`) |
| `inverted` | boolean | No | Whether values are inverted |

---

### `rooms`

Response containing all rooms.

```json
{
  "type": "rooms",
  "id": "req-789",
  "payload": {
    "rooms": {
      "livingroom": {
        "name": "Wohnzimmer",
        "icon": "🛋️",
        "metrics": [
          {
            "type": "temperature",
            "state": "hm-rpc.0.xxx.TEMPERATURE",
            "label": "Temperatur",
            "unit": "°C"
          }
        ]
      }
    }
  }
}
```

#### Room Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name |
| `icon` | string | Yes | Emoji icon |
| `metrics` | array | No | List of room metrics |

#### Metric Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Metric type (e.g., `temperature`, `humidity`) |
| `state` | string | Yes | ioBroker state ID |
| `label` | string | No | Display label |
| `unit` | string | No | Unit |

---

### `error`

Error response.

```json
{
  "type": "error",
  "id": "req-123",
  "error": {
    "code": "NOT_REGISTERED",
    "message": "Client must register first"
  }
}
```

#### Error Codes

| Code | Description |
|------|-------------|
| `NOT_REGISTERED` | Client must register before making this request |
| `INVALID_MESSAGE` | Message format is invalid (not JSON or missing type) |
| `UNKNOWN_TYPE` | Unknown message type |
| `INTERNAL_ERROR` | Server-side error |

---

## Example Client (Node.js)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8082');

ws.on('open', () => {
  // Register
  ws.send(JSON.stringify({
    type: 'register',
    id: 'req-1',
    payload: {
      clientName: 'Test Client',
      clientVersion: '1.0.0',
      clientType: 'other'
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg);

  if (msg.type === 'registered') {
    // Now we can request devices
    ws.send(JSON.stringify({
      type: 'getDevices',
      id: 'req-2'
    }));
  }
});
```

---

## Future Additions (Part 2)

The following features are planned for a future release:

### `subscribe` (Client → Server)

Subscribe to state changes for specific devices.

```json
{
  "type": "subscribe",
  "id": "req-sub-1",
  "payload": {
    "deviceIds": ["livingroom_light", "kitchen_window"]
  }
}
```

### `stateChange` (Server → Client)

Real-time state change notification.

```json
{
  "type": "stateChange",
  "payload": {
    "deviceId": "livingroom_light",
    "capability": "toggle",
    "state": "zigbee.0.xxx.state",
    "value": true,
    "timestamp": "2024-12-04T22:00:00.000Z"
  }
}
```
