# WebSocket API – Implementation Plan (Spec-Driven)

Ziel: Schrittweise Umsetzung der WebSocket-Spezifikation (siehe `docs/websocket-api.md`) im Adapter `home_controller_backend`. Fokus auf stabile Basis (Auth, Heartbeat, Envelope), danach Snapshot/Deltas, Filter, Backpressure/Compression.

## Phasen & Deliverables
1) Fundament: Transport & Envelope
   - WebSocket-Server mit Ping/Pong (25–30s; Timeout 10s; Close 4008).
   - Auth (Basic, optional Session-Cookie), Close 4001/4002/4006.
   - Common Envelope mit `seq`, `ts`, `version`; Error-Mapping (Error-Codes).
   - Compression negotiation (permessage-deflate) optional.
   - Deliverable: Verbindungsaufbau + `register`/`registered` roundtrip inkl. Limits.

2) Snapshot-Pfade
   - `initialSnapshot` nach `registered` oder `getSnapshot` Handler.
   - Devices + Rooms inkl. `value` + `ts`; `seq` im Snapshot.
   - Deliverable: Konsistenter Snapshot aus Repositories/Services.

3) Subscriptions & Filter
   - `subscribe`/`unsubscribe` mit Filtern (deviceIds, rooms, capabilityTypes).
   - Default-Subscription: all (konfigurierbar).
   - Verwaltung pro Client (Subscription Registry).
   - Deliverable: Filter wirken auf ausgehende Events.

4) Deltas & Re-Sync
   - `stateChange` + optional `stateChangeBatch`.
   - Sequencing via `state-change-service` (monotone `seq`, UTC `ts`).
   - Reconnect mit `lastSeqSeen`; falls Luecken: `RESYNC_REQUIRED` oder Nachlieferung, sonst Snapshot-Anforderung.
   - Deliverable: Live-Events mit Ordering, einfache Re-Sync-Story.

5) Writes & Acks
   - `setState` Handler (write to ioBroker state).
   - Optional Bestätigung via nachfolgendem `stateChange` oder ack-Flag.
   - Deliverable: Runde-trip Write funktioniert; Fehler -> `error` oder Close bei hartem Fehler.

6) Backpressure & Limits
   - Limits in `registered` (`maxMsgBytes`, `maxEventsPerSecond`, `supportsBatch`, `supportsCompression`).
   - `throttleHint` bei softer Rate-Limit, Close 4003 bei hart.
   - Deliverable: Batching + Hinweise bei Flut.

7) Admin/Config Integration
   - Adapter-Config spiegelt Limits/Defaults (Port, Auth-Mode, defaultSubscription, compression).
   - Mapping ioBroker-Konfig -> Services/Reops.
   - Deliverable: Admin setzt relevante Optionen, Server nutzt sie.

8) Tests & Tooling
   - Unit: Handlers, Services (Snapshot, Subscriptions, StateChange, SetState).
   - Integration: Register->Snapshot->Subscribe->StateChange Flow; Reconnect mit `lastSeqSeen`.
   - Lint/Format im CI (`npm run lint && npm test && npm run build`).

## Technische To-dos (Kurzliste)
- websocket-server: Upgrade, Ping/Pong, Close-Codes, Compression.
- routes/handlers: register, getSnapshot, subscribe, unsubscribe, setState, help.
- schemas/codec: Envelope + Payload-Validation (Ajv).
- services: snapshot, state-change (seq/ts), subscription (filters), device/room loading.
- repositories: state access + config access.
- errors/logging: zentrales Mapping Error-Code -> Close/Error Message.

## Offene Punkte (Team-Entscheidungen, falls Anpassung gewuenscht)
- Auth-Mode final: Basic + optional Session-Cookie (aktuell so geplant).
- Default-Subscription konfigurierbar? (Standard: all).
- Re-Sync-Strategie: Luecken nachliefern vs. immer Snapshot bei grosser Luecke.

## Manuelle Test-Checkpoints (zwischendrin)
- Phase 1 (Fundament):  
  - Mit `wscat`/`websocat` verbinden (Basic-Header), erwarten: `registered` mit Limits, Ping/Pong sichtbar (Server-Ping alle ~25–30s).  
  - Negative: falsche Basic-Creds -> Close 4001; TLS Fingerprint-Fail -> 4006.
- Phase 2 (Snapshot):  
  - Nach `registered` `initialSnapshot` erhalten; alternativ `getSnapshot` senden und Snapshot prüfen (Devices/Rooms mit value+ts, seq gesetzt).  
  - Inhalt sanity-check (capabilities, iconKey, unit nur einmal).
- Phase 3 (Subscribe/Filter):  
  - `subscribe` mit deviceIds/rooms/capabilityTypes; dann simulierte State-Aenderung nur fuer gefilterte Entities empfangen.  
  - `unsubscribe` leer -> keine Events mehr.
- Phase 4 (Deltas/Re-Sync):  
  - Serien von `stateChange`/`stateChangeBatch` mit steigender seq/ts beobachten.  
  - Reconnect mit `lastSeqSeen`; falls Luecke simuliert, entweder Deltas nachgeliefert oder `RESYNC_REQUIRED` und danach Snapshot holen.
- Phase 5 (Writes):  
  - `setState` senden, ioBroker-State pruefen, erwartetes `stateChange` als Bestaetigung sehen.  
  - Negative: unguelitges Payload -> `type:error` mit code `INVALID_PAYLOAD`, Verbindung bleibt offen.
- Phase 6 (Backpressure/Limits):  
  - Flut erzeugen (z.B. Script) -> erwarten `stateChangeBatch` oder `throttleHint`; bei Ueberschreitung hart Close 4003.  
  - Kompression: mit `--permessage-deflate` testen, `supportsCompression` true im `registered`.


