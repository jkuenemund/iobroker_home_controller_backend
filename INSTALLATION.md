# Installation des Adapters auf ioBroker

## Voraussetzungen

- Das Repository muss entweder **öffentlich** sein ODER
- SSH-Zugriff auf GitHub muss auf dem ioBroker-System konfiguriert sein

## Installationsmethoden

### Option 1: Öffentliches Repository (Empfohlen)

1. **Repository öffentlich machen:**
   - GitHub → Repository Settings → Danger Zone → "Change visibility" → "Make public"

2. **Installation über Admin-Interface:**
   - ioBroker Admin öffnen
   - **Adapter** → **Aus GitHub installieren**
   - Git-URL eingeben: `https://github.com/jkuenemund/iobroker_home_controller_backend.git`
   - **Installieren** klicken

3. **Installation über CLI:**
   ```bash
   cd /opt/iobroker
   sudo -u iobroker npm install https://github.com/jkuenemund/iobroker_home_controller_backend.git
   ```

### Option 2: Privates Repository mit SSH

1. **SSH-Key auf ioBroker-System einrichten:**
   ```bash
   # Als iobroker-User
   sudo -u iobroker ssh-keygen -t ed25519 -C "iobroker@yourhost"
   sudo -u iobroker cat ~/.ssh/id_ed25519.pub
   ```

2. **Public Key zu GitHub hinzufügen:**
   - GitHub → Settings → SSH and GPG keys → "New SSH key"
   - Den öffentlichen Schlüssel einfügen

3. **Installation über SSH-URL:**
   ```bash
   cd /opt/iobroker
   sudo -u iobroker npm install git+ssh://git@github.com:jkuenemund/iobroker_home_controller_backend.git
   ```

### Option 3: Privates Repository mit Personal Access Token

1. **Personal Access Token erstellen:**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - "Generate new token" → Scopes: `repo` (für private Repos)

2. **Installation mit Token:**
   ```bash
   cd /opt/iobroker
   sudo -u iobroker npm install https://<TOKEN>@github.com/jkuenemund/iobroker_home_controller_backend.git
   ```

### Option 4: Lokale Installation (.tgz)

1. **Package erstellen:**
   ```bash
   cd /path/to/iobroker_home_controller_backend
   npm run build
   npm pack
   ```

2. **Auf ioBroker-System installieren:**
   ```bash
   cd /opt/iobroker
   sudo -u iobroker npm install /path/to/iobroker.home_controller_backend-0.0.2-beta.0.tgz
   ```

## Nach der Installation

1. **Adapter-Instanz erstellen:**
   ```bash
   iobroker add home_controller_backend
   ```

2. **Oder über Admin-Interface:**
   - **Adapter** → **home_controller_backend** → **➕ Instanz hinzufügen**

## Fehlerbehebung

### Fehler: "Cannot install ...: 0"

**Mögliche Ursachen:**
- Repository ist privat und kein SSH/Token konfiguriert
- Repository-Name falsch geschrieben
- Build-Dateien fehlen im Repository

**Lösungen:**
1. Prüfe, ob das Repository öffentlich ist: `https://github.com/jkuenemund/iobroker_home_controller_backend`
2. Prüfe den Repository-Namen (muss exakt sein)
3. Stelle sicher, dass `build/`-Verzeichnis committed ist:
   ```bash
   git ls-files build/ | head -5
   ```

### Fehler: "Cannot find module 'uuid'"

Dieser Fehler sollte nicht mehr auftreten, da `uuid` jetzt in `dependencies` statt `devDependencies` steht.

## Repository-Name

**Wichtig:** Der korrekte Repository-Name ist:
- `iobroker_home_controller_backend` (mit Unterstrich, alles kleingeschrieben)

Nicht zu verwechseln mit:
- `iobroker_home_controller_backend` (mit Unterstrich, alles kleingeschrieben)
