# Brainstorming: ioBroker.home_controller_backend

## Projektziel
Erstellung eines ioBroker Adapters (`home_controller_backend`), der als Backend für die `iobroker_home_controller` App dient. Der Adapter soll die bisherige REST-API und das manuelle Erstellungsskript (`home_controller_all_in_one.js`) ersetzen.

## Kernfunktionen

### 1. Device Management (Admin UI)
- **Ziel**: Ablösung des `home_controller_all_in_one.js` Scripts.
- **Funktion**:
    - Übersichtliche Darstellung aller konfigurierten Devices im Adapter-Admin.
    - Anlegen, Bearbeiten und Löschen von Devices.
    - Konfiguration der "Capabilities" pro Device (z.B. Mapping auf ioBroker States, Invertierung, Min/Max Werte).
    - Vermeidung von manuellen Skript-Ausführungen zur Erzeugung von Objekten.
- **Datenstruktur**:
    - Speicherung der Konfiguration in der Adapter-Konfiguration (`native` in `io-package.json` oder separates JSON-Objekt).
    - Orientierung an der bestehenden Struktur: `deviceId`, `config` (Name, Type, Room, Icon, Capabilities).

### 2. WebSocket Kommunikation
- **Ziel**: Performante Echtzeit-Kommunikation mit der App.
- **Funktion**:
    - Bereitstellung eines WebSocket-Servers (oder Nutzung des integrierten ioBroker WS-Mechanismus, falls passend - hier vermutlich eigener Namespace oder Socket für die App).
    - Übermittlung der Device-Liste an die App beim Start.
    - Push-Updates an die App bei Änderungen von überwachten ioBroker States.
    - Empfang von Steuerbefehlen aus der App und Setzen der entsprechenden ioBroker States.

### 3. State Synchronisation & Logik
- **Ziel**: Nahtlose Integration zwischen App-Logik und ioBroker-Objekten.
- **Funktion**:
    - Überwachung der in den Capabilities definierten States (`state`, `availability`, etc.).
    - Mapping von Werten (z.B. Invertierung bei Velux/Homematic, Skalierung).
    - Behandlung von Read-Only vs. Writeable States.

## Geplante Inkremente

### Inkrement 1: Kompatibilitäts-Modus & Admin UI (Read-Only)
- **Ziel**: Visuelle Darstellung der bestehenden Geräte-Konfigurationen, die vom `home_controller_all_in_one.js` Skript erzeugt wurden.
- **Funktion**:
    - Admin UI liest die States aus `0_userdata.0.home_controller.devices.*`.
    - Parsen der JSON-Inhalte dieser States.
    - Übersichtliche Darstellung als Tabelle/Liste im Adapter-Admin.
- **Datenhaltung**: Referenzierung der bestehenden Objekte in `0_userdata` (Single Source of Truth für dieses Inkrement).
- *Ergebnis*: Nutzer sieht die aktuellen Skript-generierten Devices im neuen Adapter-Admin.

### Inkrement 2: Basis-Struktur & WebSocket Server
- Aufsetzen des Adapters (bereits erfolgt).
- Implementierung des WebSocket-Servers.
- Definition des Kommunikations-Protokolls (Handshake, Device-List Request).
- *Ziel*: App kann sich verbinden und eine (noch statische oder leere) Liste empfangen.

### Inkrement 3: Admin UI (Editierbar) & Device-Erstellung
- Formulare zum Anlegen/Bearbeiten von Devices und Capabilities.
- Validierung der Eingaben (z.B. existiert der State?).
- *Ziel*: Volle Verwaltung der Devices ohne Code-Anpassung.

### Inkrement 4: State-Logik & Push-Updates
- Backend-Logik zum Abonnieren der konfigurierten States.
- Weiterleitung von Änderungen per WebSocket an die App.
- Umsetzung von Steuerbefehlen (App -> ioBroker).
- *Ziel*: Volle Funktionalität der Steuerung und Anzeige.

### Inkrement 5: Test-Modus / Mocking
- **Ziel**: Unterstützung der App-Entwicklung durch Bereitstellung von Dummy-Daten.
- **Funktion**:
    - Adapter-Option "Test-Modus" aktivieren.
    - Bereitstellung von statischen oder simulierten Gerätedaten über WebSocket, ohne Abhängigkeit von echten ioBroker-Geräten.
    - Ermöglicht Entwicklung und Testing der App (z.B. mit DevTools) ohne Live-System.
- *Details*: Werden später spezifiziert.

## Offene Punkte / Fragen
- Soll der Adapter einen eigenen Port für WebSockets öffnen oder sich in einen bestehenden Web-Adapter (z.B. `socketio`) einklinken? (Präferenz: Eigener Port oder Integration in `web` Adapter, um Ports zu sparen).
- Wie gehen wir mit der Authentifizierung um?
- Sollen die Devices weiterhin als Objekte im `0_userdata` oder unter dem Adapter-Namespace `home_controller_backend.0` gespiegelt werden, oder arbeitet der Adapter rein als Gateway (Proxy)? (Präferenz: Gateway-Ansatz, um Redundanz zu vermeiden).
