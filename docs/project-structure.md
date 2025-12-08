# Projektstruktur-Guidelines (home_controller_backend)

Ziel: Saubere, skalierbare Struktur fuer den WS-Adapter. Klare Trennung von Transport (WS), Domäne (Devices/Rooms), Persistenz (ioBroker States) und Utility.

## Vorschlag Verzeichnisbaum
```
home_controller_backend/
├─ admin/                 # ioBroker Admin UI (bestehend)
├─ docs/                  # Spezifikationen & Architektur (websocket-api.md, dieses Dokument)
├─ src/
│  ├─ main.ts             # Adapter-Einstieg, erstellt ioBroker Adapter, bootstrap
│  └─ lib/
│     ├─ websocket/       # WS-Transport & Protokoll
│     │  ├─ websocket-server.ts    # Server-Setup, Upgrade, Ping/Pong
│     │  ├─ routes.ts              # Routing von message.type -> Handler
│     │  ├─ handlers/              # register/getSnapshot/subscribe/setState/...
│     │  ├─ subscriptions/         # Subscription-Registry, Filter-Logic, lastSeqSeen
│     │  ├─ codec/                 # Encode/Decode, Kompression, Validation
│     │  └─ schemas/               # JSON-Schemas/Typen fuer Envelope/Payloads
│     ├─ services/        # Domänenlogik (ohne Transport)
│     │  ├─ device-service.ts      # Devices lesen/schreiben, mapping
│     │  ├─ room-service.ts        # Rooms & Metrics
│     │  ├─ snapshot-service.ts    # initialSnapshot/getSnapshot
│     │  ├─ state-change-service.ts# Deltas, Sequencing (seq/ts)
│     │  └─ subscription-service.ts# Filter anwenden, default/all vs. opt-in
│     ├─ repositories/    # ioBroker-Zugriffe, State-Reads/Writes, Config
│     │  ├─ state-repository.ts
│     │  ├─ device-config-repository.ts
│     │  └─ room-config-repository.ts
│     ├─ mappers/         # Mapping ioBroker <-> API-Modelle (Devices/Rooms/Capabilities)
│     ├─ models/          # Gemeinsame Typen (Device, Capability, Room, Metric, Envelope)
│     ├─ config/          # Adapter-/Env-Konfiguration, Defaults, Validation
│     ├─ logging/         # Zentraler Logger, ggf. Pino/Winston Wrapper
│     ├─ errors/          # Fehlerklassen + Error-Code Mapping (AUTH_FAILED, ...)
│     └─ utils/           # Kleine Helfer (ts/date/ids), keine Geschäftslogik
├─ test/                  # Unit-/Integrationstests (spiegeln src/ Struktur)
│  └─ websocket/...
├─ dist/                  # Build-Output (per tsconfig.build.json)
└─ scripts/ (optional)    # Dev-/Build-/Lint-/Release-Skripte
```

## Konventionen
- **Benennung**: kebab-case Dateien, klare Suffixe (`*-service.ts`, `*-repository.ts`, `*-handler.ts`).
- **Trennung**: Handler bleiben transport-nah (WebSocket), rufen Services; Services rufen Repositories; keine Transport-Logik in Services/Repos.
- **Typen**: Gemeinsame Interfaces in `models/`, Message-Schemas in `websocket/schemas/`.
- **Validation**: Eingehende WS-Nachrichten via Schema/Validator (z.B. Ajv) in `websocket/codec`.
- **Sequencing**: `state-change-service` vergibt `seq`/`ts`; `subscriptions` wendet Filter an.
- **Tests**: Spiegeln Struktur (z.B. `test/services/device-service.test.ts`), Mocks in `test/__mocks__/` falls noetig.
- **Konfig**: Alle Defaults in `config/`; Adapter-Optionen zentral aus ioBroker-Config abgeleitet.

## WS-spezifische Dateien (Orientierung)
- `websocket-server.ts`: Start, Upgrade, Ping/Pong, Close-Codes.
- `routes.ts`: Dispatch auf Handler pro `type`.
- `handlers/register-handler.ts`: Auth, lastSeqSeen, Compression Negotiation, send `registered`.
- `handlers/snapshot-handler.ts`: `initialSnapshot`/`getSnapshot`.
- `handlers/subscribe-handler.ts` / `unsubscribe-handler.ts`: Filter pflegen.
- `handlers/set-state-handler.ts`: Eingehende Writes.
- `handlers/help-handler.ts`: Befehlsuebersicht.
- `subscriptions/*`: Verwaltung der aktiven Filter pro Client.
- `schemas/*`: JSON-Schemas fuer Envelope, register, subscribe, setState, stateChange, batch, deviceListChanged, error.

## Build & Lint
- TypeScript Build: `tsconfig.build.json` → Output nach `dist/`.
- Lint/Format: eslint + prettier (bereits vorhanden). CI sollte `npm run lint && npm test && npm run build` fahren.


