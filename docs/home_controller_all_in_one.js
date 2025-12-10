/**
 * ioBroker Home Controller - All-in-One Script (Capability-Parameter Architecture)
 * 
 * Kombiniert alle Module in einer Datei für einfache Verwendung in ioBroker.
 * Basiert auf den modularen Scripts, aber ohne Import-Abhängigkeiten.
 * 
 * NEUE ARCHITEKTUR: Capability-Parameter System
 * - Capabilities als Objekte mit eingebetteten Parametern
 * - Unterstützung für inverted, min/max values, units, multi-state
 * - Flexiblere und erweiterbare Gerätekonfiguration
 * 
 * Verwendung:
 * 1. Dieses Script in ioBroker JavaScript-Adapter kopieren
 * 2. Geräte-Definitionen unten anpassen
 * 3. Script ausführen → automatischer Abgleich
 * 
 * Autor: AI Assistant "Ralf"
 * Datum: Dezember 2024 - Capability-Parameter Migration
 */

// ===========================
// DUMMY TEST KONFIGURATION
// ===========================
// Dieses Skript ist die Test-Variante und nutzt ausschließlich Dummy-States,
// damit keine echten Geräte in der Testumgebung erforderlich sind.
const DUMMY_ROOT = '0_userdata.0.testdummy';

// ===========================
// GERÄTE-DEFINITIONEN (NEUE ARCHITEKTUR)
// ===========================

const RAW_DEVICE_DEFINITIONS = [

    // ===== FLUR EG (FLOOR_EG) =====
    {
        deviceId: 'floor_eg_socket',
        config: {
            name: 'Flur EG Steckdose',
            type: 'socket',
            room: 'floor_eg',
            icon: '🔌',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.7cb03eaa0a08e281.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.7cb03eaa0a08e281.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.7cb03eaa0a08e281.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Osram Socket',
            description: 'Variable Steckdose Flur EG'
        }
    },
    {
        deviceId: 'floor_eg_light_main',
        config: {
            name: 'Flur EG Deckenlicht',
            type: 'light',
            room: 'floor_eg',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'shelly.0.shellyplus1pm#b48a0a219a70#1.Relay0.Switch',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'shelly.0.shellyplus1pm#b48a0a219a70#1.online',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'wifi_signal_strength',
                    state: 'shelly.0.shellyplus1pm#b48a0a219a70#1.rssi',
                    min_value: -100,
                    max_value: 0,
                    unit: 'dBm',
                    description: 'WiFi Signalstärke'
                },
                {
                    type: 'update_available',
                    state: 'shelly.0.shellyplus1pm#b48a0a219a70#1.firmware',
                    description: 'Firmware Update verfügbar'
                }
            ],
            manufacturer: 'Shelly',
            model: 'Shelly Plus 1PM',
            description: 'WiFi Controller für Flur EG Deckenlicht, geschaltet über Bewegungsmelder'
        }
    },
    // ===== Badezimmer EG (BATHROOM_EG) =====
    {
        deviceId: 'bathroom_eg_window',
        config: {
            name: 'Badezimmer EG Fenster',
            type: 'window',
            room: 'bathroom_eg',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392823.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392823.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392823.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB7FD.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Badezimmer EG mit Rolladen und Öffnungssensor'
        }
    },
    // ===== BÜRO (OFFICE) =====
    {
        deviceId: 'office_socket_printer',
        config: {
            name: 'Drucker',
            type: 'socket',
            room: 'office',
            icon: '🔌',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.7cb03eaa0a08b8f1.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.7cb03eaa0a08b8f1.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.7cb03eaa0a08b8f1.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Smart Socket',
            description: 'Steckdose für Drucker am Schreibtisch im Büro'
        }
    },
    {
        deviceId: 'office_window',
        config: {
            name: 'Bürofenster',
            type: 'window',
            room: 'office',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392923.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392923.1.STOP', // Stop-Funktion
                    // Optional: Separate UP/DOWN States (falls nicht definiert, wird state auf min/max gesetzt)
                    // up: 'hm-rpc.0.REQ0392923.1.UP',     // Optional: separater UP-State
                    // down: 'hm-rpc.0.REQ0392923.1.DOWN', // Optional: separater DOWN-State
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392923.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB7E8.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Büro mit Rolladen und Öffnungssensor'
        }
    },

    // ===== ESSZIMMER (DININGROOM) =====
    {
        deviceId: 'diningroom_light_window',
        config: {
            name: 'Esszimmer Fenster Lampe',
            type: 'light',
            room: 'diningroom',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.f84477fffe7b13ea.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'dimming',
                    state: 'zigbee.0.f84477fffe7b13ea.brightness',
                    min_value: 0,
                    max_value: 254,
                    unit: '%',
                    step: 1,
                    description: 'Helligkeit'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.f84477fffe7b13ea.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.f84477fffe7b13ea.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Smart Light',
            description: 'Dimmbare Lampe im Esszimmer Fenster'
        }
    },
    {
        deviceId: 'diningroom_window',
        config: {
            name: 'Esszimmer Fenster',
            type: 'window',
            room: 'diningroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392808.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392808.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392808.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB7DA.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Esszimmer mit Rolladen und Öffnungssensor'
        }
    }, {
        deviceId: 'diningroom_window_terrace',
        config: {
            name: 'Esszimmer Terrassentür',
            type: 'window',
            room: 'diningroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392891.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392891.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392891.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DBE995103B.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Terrassentür Esszimmer mit Rolladen und Öffnungssensor'
        }
    },

    // ===== Wohnzimmer (LIVINGROOM) =====
    {
        deviceId: 'livingroom_light_window',
        config: {
            name: 'Wohnzimmer Fenster Lampe',
            type: 'light',
            room: 'livingroom',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.6cfd22fffe4f4148.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'dimming',
                    state: 'zigbee.0.6cfd22fffe4f4148.brightness',
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    step: 1,
                    description: 'Helligkeit'
                },
                {
                    type: 'color_temperature',
                    state: 'zigbee.0.6cfd22fffe4f4148.colortemp',
                    min_value: 2700,
                    max_value: 6500,
                    unit: 'K',
                    description: 'Farbtemperatur'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.6cfd22fffe4f4148.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.6cfd22fffe4f4148.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Ikea',
            model: 'Smart Light',
            description: 'Lampe im Wohnzimmer Fenster'
        }
    },
    {
        deviceId: 'livingroom_light_floor_lamp',
        config: {
            name: 'Wohnzimmer Stehlampe',
            type: 'light',
            room: 'livingroom',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.842e14fffe43bc70.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'dimming',
                    state: 'zigbee.0.842e14fffe43bc70.brightness',
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    step: 1,
                    description: 'Helligkeit'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.842e14fffe43bc70.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.842e14fffe43bc70.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Ikea',
            model: 'Smart Light',
            description: 'Stehlampe im Wohnzimmer'
        }
    },
    {
        deviceId: 'livingroom_window',
        config: {
            name: 'Wohnzimmer Fenster',
            type: 'window',
            room: 'livingroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392804.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392804.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392804.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Wohnzimmer mit Rolladen und Öffnungssensor'
        }
    }, {
        deviceId: 'livingroom_window_terrace',
        config: {
            name: 'Wohnzimmer Terrassentür',
            type: 'window',
            room: 'livingroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0393126.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0393126.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0393126.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DBE9951047.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Terrassentür Wohnzimmer mit Rolladen und Öffnungssensor'
        }
    }, {
        deviceId: 'livingroom_tv_light',
        config: {
            name: 'Wohnzimmer TV Licht',
            type: 'light',
            room: 'livingroom',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.group_902.state',
                    description: 'TV Licht Ein/Aus Steuerung'
                },
                {
                    type: 'dimming',
                    state: 'zigbee.0.group_902.brightness',
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    step: 1,
                    description: 'Helligkeit'
                }
            ],
            manufacturer: 'Ikea',
            model: 'Smart Light',
            description: 'TV Licht Wohnzimmer'
        }
    }, {
        deviceId: 'livingroom_tv',
        config: {
            name: 'Wohnzimmer TV',
            type: 'light',
            room: 'livingroom',
            icon: '📺',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.0.REQ0191627.1.STATE',
                    description: 'TV Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0191627.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },

            ],
            manufacturer: 'Homematic',
            model: 'Homematic Switch',
            description: 'TV Wohnzimmer'
        }
    }, {
        deviceId: 'livingroom_vitrine_light',
        config: {
            name: 'Wohnzimmer Vitrinen Licht',
            type: 'light',
            room: 'livingroom',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.0.REQ0191627.2.STATE',
                    description: 'Vitrinen Licht Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0191627.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },

            ],
            manufacturer: 'Homematic',
            model: 'Homematic Switch',
            description: 'Vitrinen Licht Wohnzimmer'
        }
    },
    // ===== KÜCHE (KITCHEN) =====
    {
        deviceId: 'kitchen_window',
        config: {
            name: 'Küche Fenster',
            type: 'window',
            room: 'livingroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392785.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392785.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392785.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB7F2.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Küche mit Rolladen und Öffnungssensor'
        }
    },
    // ===== Hauswirtschaftsraum (HOUSEHOLD) =====
    {
        deviceId: 'household_window',
        config: {
            name: 'Hauswirtschaftsraum Fenster',
            type: 'window',
            room: 'livingroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0393117.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0393117.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0393117.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD898A44B9.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Hauswirtschaftsraum mit Rolladen und Öffnungssensor'
        }
    },
    // ===== FLUR OG (FLOOR_OG) =====
    {
        deviceId: 'floor_og_light_main',
        config: {
            name: 'Flur OG Deckenlicht',
            type: 'light',
            room: 'floor_og',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'shelly.0.shellyplus1pm#441793d5193c#1.Relay0.Switch',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'shelly.0.shellyplus1pm#441793d5193c#1.online',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'wifi_signal_strength',
                    state: 'shelly.0.shellyplus1pm#441793d5193c#1.rssi',
                    min_value: -100,
                    max_value: 0,
                    unit: 'dBm',
                    description: 'WiFi Signalstärke'
                },
                {
                    type: 'update_available',
                    state: 'shelly.0.shellyplus1pm#441793d5193c#1.firmware',
                    description: 'Firmware Update verfügbar'
                }
            ],
            manufacturer: 'Shelly',
            model: 'Shelly Plus 1PM',
            description: 'Deckenlicht im OG Flur'
        }
    },
    {
        deviceId: 'floor_og_light_vase',
        config: {
            name: 'Flur OG Vase',
            type: 'light',
            room: 'floor_og',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.7cb03eaa0a08e093.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.7cb03eaa0a08e093.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.7cb03eaa0a08e093.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Smart Light',
            description: 'Beleuchtete Vase im OG Flur'
        }
    },
    {
        deviceId: 'floor_og_window',
        config: {
            name: 'Flur OG Fenster',
            type: 'window',
            room: 'floor_og',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'klf200.0.products.3.currentPosition',
                    stop: 'klf200.0.products.3.stop', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: true, // ⭐ VELUX INVERSION: 0=offen, 100=geschlossen
                    description: 'Rollladenposition (Velux invertiert)'
                }
            ],
            manufacturer: 'Velux',
            model: 'KLF200',
            description: 'Fenster im OG Flur mit Velux Rolladen (invertierte Werte)'
        }
    },
    // ===== ABSTELLRAUM (STORAGE) =====
    {
        deviceId: 'storage_window',
        config: {
            name: 'Abstellraum Fenster',
            type: 'window',
            room: 'storage',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'klf200.0.products.4.currentPosition',
                    stop: 'klf200.0.products.4.stop', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: true, // ⭐ VELUX INVERSION: 0=offen, 100=geschlossen
                    description: 'Rollladenposition (Velux invertiert)'
                }
            ],
            manufacturer: 'Velux',
            model: 'KLF200',
            description: 'Abstellraum Fenster mit Velux Rolladen (invertierte Werte)'
        }
    },
    // ===== MULTIFUNKTIONSRAUM (MFR) =====
    {
        deviceId: 'mfr_window',
        config: {
            name: 'Multifunktionsraum Fenster',
            type: 'window',
            room: 'multi_function_room',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'klf200.0.products.5.currentPosition',
                    stop: 'klf200.0.products.5.stop', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: true, // ⭐ VELUX INVERSION: 0=offen, 100=geschlossen
                    description: 'Rollladenposition (Velux invertiert)'
                }
            ],
            manufacturer: 'Velux',
            model: 'KLF200',
            description: 'Multifunktionsraum Fenster mit Velux Rolladen (invertierte Werte)'
        }
    },
    {
        deviceId: 'mfr_switch_tv',
        config: {
            name: 'Multifunktionsraum TV',
            type: 'switch',
            room: 'multi_function_room',
            icon: '💻',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.1.0031626998E078.4.STATE',
                    description: 'TV Ein/Aus Steuerung'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Switch',
            description: 'TV im Multifunktionsraum'
        }
    },
    {
        deviceId: 'mfr_switch_crosser',
        config: {
            name: 'Multifunktionsraum Crosser',
            type: 'switch',
            room: 'multi_function_room',
            icon: '👟',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.1.0031626998E078.8.STATE',
                    description: 'TV Ein/Aus Steuerung'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Switch',
            description: 'Crosser im Multifunktionsraum'
        }
    },
    // ===== Badezimmer OG (BATHROOM_OG) =====
    {
        deviceId: 'bathroom_og_window',
        config: {
            name: 'Badezimmer OG Fenster',
            type: 'window',
            room: 'bathroom_og',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392824.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392824.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392824.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB69D.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Badezimmer EG mit Rolladen und Öffnungssensor'
        }
    }, {
        deviceId: 'bathroom_og_heater',
        config: {
            name: 'Badezimmer OG Heizung',
            type: 'heater',
            room: 'floor_og',
            icon: '🔥',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.7cb03eaa0a0a32bd.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.7cb03eaa0a0a32bd.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.7cb03eaa0a0a32bd.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Osram',
            model: 'Osram Plug',
            description: 'Heizung im Badezimmer OG'
        }
    },

    // ===== KINDERZIMMER JOEL =====
    {
        deviceId: 'joel_socket_camera',
        config: {
            name: 'Joel Kamera',
            type: 'socket',
            room: 'joel',
            icon: '📹',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.a4c13847b4eb73c0.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.a4c13847b4eb73c0.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.a4c13847b4eb73c0.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Smart Socket',
            description: 'BabyPhone Kamera über Joels Bett'
        }
    },
    {
        deviceId: 'joel_socket_toniebox',
        config: {
            name: 'Joel Toniebox',
            type: 'socket',
            room: 'joel',
            icon: '🎵',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.8c6fb9fffe14305e.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.8c6fb9fffe14305e.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.8c6fb9fffe14305e.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Smart Socket',
            description: 'Toniebox im Kinderzimmer Joel'
        }
    },
    {
        deviceId: 'joel_window',
        config: {
            name: 'Joel Fenster',
            type: 'window',
            room: 'joel',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0393121.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0393121.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0393121.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB62F.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Joel mit Rolladen und Öffnungssensor'
        }
    },
    // ===== Spielzimmer (PLAYROOM) =====
    {
        deviceId: 'playroom_window',
        config: {
            name: 'Spielzimmer Fenster',
            type: 'window',
            room: 'playroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392848.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392848.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392848.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB621.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Spielzimmer mit Rolladen und Öffnungssensor'
        }
    },

    // ===== Garten (GARDEN) =====
    {
        deviceId: 'garden_garbage_light',
        config: {
            name: 'Garten Mülltonnen Licht',
            type: 'light',
            room: 'garden',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.1.00161F299C095D.2.STATE',
                    description: 'Mülltonnen Licht Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.1.00161F299C095D.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Licht',
            description: 'Mülltonnen Licht im Garten'
        }
    },
    {
        deviceId: 'garden_garage_door_light',
        config: {
            name: 'Garagentor Licht',
            type: 'light',
            room: 'garden',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.1.00161F299C095D.6.STATE',
                    description: 'Garagentor Licht Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.1.00161F299C095D.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Licht',
            description: 'Garagentor Licht'
        }
    },
    {
        deviceId: 'garden_driveway_light',
        config: {
            name: 'Auffahrt Licht',
            type: 'light',
            room: 'garden',
            icon: '💡',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'hm-rpc.1.00259BE9950495.18.STATE',
                    description: 'Auffahrt Licht Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.1.00161F299C095D.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Licht',
            description: 'Auffahrt Licht'
        }
    },

    // ===== HAUS-STEUERUNG (HOUSE CONTROL) =====
    {
        deviceId: 'house_control_blinds_down_all',
        config: {
            name: 'Alle Rolläden schließen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.DOWN_ALL',
                    description: 'Schließt alle Rolläden im gesamten Haus'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Schließen aller Rolläden im Haus'
        }
    },
    {
        deviceId: 'house_control_blinds_down_eg',
        config: {
            name: 'Rolläden EG schließen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.DOWN_EG',
                    description: 'Schließt alle Rolläden im EG'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Schließen der Rolläden im EG'
        }
    },
    {
        deviceId: 'house_control_blinds_down_og',
        config: {
            name: 'Rolläden OG schließen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.DOWN_OG',
                    description: 'Schließt alle Rolläden im OG'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Schließen der Rolläden im OG'
        }
    },
    {
        deviceId: 'house_control_blinds_down_velux',
        config: {
            name: 'Rolläden Velux schließen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.DOWN_VELUX',
                    description: 'Schließt alle Rolläden im Velux'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Schließen der Velux Rolläden'
        }
    },
    {
        deviceId: 'house_control_blinds_up_all',
        config: {
            name: 'Alle Rolläden öffnen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.UP_ALL',
                    description: 'Öffnet alle Rolläden im gesamten Haus'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Öffnen aller Rolläden im Haus'
        }
    },
    {
        deviceId: 'house_control_blinds_up_eg',
        config: {
            name: 'Rolläden EG öffnen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.UP_EG',
                    description: 'Öffnet alle Rolläden im EG'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Öffnen der Rolläden im EG'
        }
    },
    {
        deviceId: 'house_control_blinds_up_og',
        config: {
            name: 'Rolläden OG öffnen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.UP_OG',
                    description: 'Öffnet alle Rolläden im OG'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Öffnen der Rolläden im OG'
        }
    },
    {
        deviceId: 'house_control_blinds_up_velux',
        config: {
            name: 'Rolläden Velux öffnen',
            type: 'button',
            room: 'houseControl',
            icon: '🪟',
            capabilities: [
                {
                    type: 'trigger',
                    state: 'javascript.0.scriptTrigger.Rolladensteuerung.UP_VELUX',
                    description: 'Öffnet alle Rolläden im Velux'
                }
            ],
            manufacturer: 'ioBroker',
            model: 'Script Trigger',
            description: 'Trigger zum Öffnen der Velux Rolläden'
        }
    },
    // ===== SCHLAFZIMMER (BEDROOM) =====
    {
        deviceId: 'bedroom_socket_camera',
        config: {
            name: 'Schlafzimmer Kamera',
            type: 'socket',
            room: 'bedroom',
            icon: '📹',
            capabilities: [
                {
                    type: 'toggle',
                    state: 'zigbee.0.142d41fffee542c7.state',
                    description: 'Ein/Aus Steuerung'
                },
                {
                    type: 'device_available',
                    state: 'zigbee.0.142d41fffee542c7.available',
                    description: 'Gerät online/offline Status'
                },
                {
                    type: 'signal_strength',
                    state: 'zigbee.0.142d41fffee542c7.link_quality',
                    min_value: 0,
                    max_value: 255,
                    unit: 'LQI',
                    description: 'Zigbee Signalstärke'
                }
            ],
            manufacturer: 'Unknown',
            model: 'Smart Socket',
            description: 'BabyPhone Kamera über dem Schlafzimmerbett'
        }
    },
    {
        deviceId: 'bedroom_window',
        config: {
            name: 'Schlafzimmer Fenster',
            type: 'window',
            room: 'bedroom',
            icon: '🪟',
            capabilities: [
                {
                    type: 'blind_position',
                    state: 'hm-rpc.0.REQ0392791.1.LEVEL',
                    stop: 'hm-rpc.0.REQ0392791.1.STOP', // Stop-Funktion
                    min_value: 0,
                    max_value: 100,
                    unit: '%',
                    inverted: false, // Homematic Standard: 0=geschlossen, 100=offen
                    description: 'Rollladenposition mit Stop-Funktion'
                },
                {
                    type: 'device_available',
                    state: 'hm-rpc.0.REQ0392791.0.UNREACH',
                    inverted: true, // Homematic UNREACH wird zu available invertiert
                    description: 'Gerät online/offline Status (Homematic invertiert)'
                },
                {
                    type: 'open_closed',
                    state: 'hm-rpc.1.0007DD899FB632.1.STATE'
                }
            ],
            manufacturer: 'Homematic',
            model: 'Homematic Rolladen',
            description: 'Fenster Schlafzimmer mit Rolladen und Öffnungssensor'
        }
    },
];

// ===========================
// DUMMY HILFSFUNKTIONEN
// ===========================

function slugifyName(value, fallback = 'device') {
    const replacements = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
    let base = (value || fallback || '').toString().toLowerCase();
    Object.entries(replacements).forEach(([k, v]) => {
        base = base.replace(new RegExp(k, 'g'), v);
    });
    base = base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return base || fallback.toLowerCase();
}

const CAPABILITY_SUFFIX_MAP = {
    toggle: 'toggle',
    dimming: 'brightness',
    color_temperature: 'colortemp',
    device_available: 'available',
    signal_strength: 'link_quality',
    wifi_signal_strength: 'wifi_rssi',
    update_available: 'update_available',
    open_closed: 'open_closed',
    trigger: 'trigger',
    thermostat: 'thermostat',
    temperature: 'temperature',
    humidity: 'humidity',
    fan_speed: 'fan_speed',
    power_monitoring: 'power',
    energy_total: 'energy_total',
    battery_level: 'battery_level',
    battery_voltage: 'battery_voltage',
    firmware_version: 'firmware',
    maintenance_required: 'maintenance_required',
    error_status: 'error_status',
    window_sensor: 'window_sensor',
    door_sensor: 'door_sensor',
    motion_sensor: 'motion_sensor',
    air_quality: 'air_quality',
    pressure: 'pressure',
    luminance: 'luminance'
};

function buildDummyStateIds(deviceSlug, capability) {
    const base = `${DUMMY_ROOT}.${deviceSlug}`;

    if (capability.type === 'blind_position') {
        const root = `${base}.blind`;
        /** @type {Record<string, string>} */
        const blindIds = { state: `${root}_position` };
        if (capability.stop) blindIds.stop = `${root}_stop`;
        if (capability.up) blindIds.up = `${root}_up`;
        if (capability.down) blindIds.down = `${root}_down`;
        if (capability.position_feedback) blindIds.position_feedback = `${root}_feedback`;
        return blindIds;
    }

    const suffix = CAPABILITY_SUFFIX_MAP[capability.type] || capability.type;
    /** @type {Record<string, string>} */
    const ids = { state: `${base}.${suffix}` };
    if (capability.stop) ids.stop = `${base}.${suffix}_stop`;
    if (capability.up) ids.up = `${base}.${suffix}_up`;
    if (capability.down) ids.down = `${base}.${suffix}_down`;
    if (capability.position_feedback) ids.position_feedback = `${base}.${suffix}_feedback`;
    return ids;
}

function rewriteDevicesToDummy(defs) {
    return defs.map(({ deviceId, config }) => {
        const deviceSlug = slugifyName(config?.name, deviceId);
        const capabilities = Array.isArray(config.capabilities)
            ? config.capabilities.map(cap => {
                const dummyIds = buildDummyStateIds(deviceSlug, cap);
                return { ...cap, ...dummyIds };
            })
            : [];
        return { deviceId, config: { ...config, capabilities } };
    });
}

function getDummyCommon(capability, key) {
    const baseName = capability.description || capability.type;
    const common = {
        name: `${baseName} (${key})`,
        type: 'boolean',
        role: 'state',
        read: true,
        write: true
    };

    switch (capability.type) {
        case 'toggle':
            return { ...common, role: 'switch', type: 'boolean' };
        case 'device_available':
            return { ...common, role: 'indicator.reachable', type: 'boolean' };
        case 'signal_strength':
            return { ...common, role: 'value.signal', type: 'number', min: 0, max: 255, unit: 'LQI' };
        case 'wifi_signal_strength':
            return { ...common, role: 'value.rssi', type: 'number', min: -100, max: 0, unit: 'dBm' };
        case 'dimming':
            return {
                ...common,
                role: 'level.dimmer',
                type: 'number',
                min: capability.min_value ?? 0,
                max: capability.max_value ?? 100,
                unit: capability.unit ?? '%'
            };
        case 'color_temperature':
            return {
                ...common,
                role: 'level.color.temperature',
                type: 'number',
                min: capability.min_value ?? 2700,
                max: capability.max_value ?? 6500,
                unit: capability.unit ?? 'K'
            };
        case 'temperature':
            return {
                ...common,
                role: 'value.temperature',
                type: 'number',
                unit: capability.unit ?? '°C'
            };
        case 'humidity':
            return {
                ...common,
                role: 'value.humidity',
                type: 'number',
                unit: capability.unit ?? '%'
            };
        case 'blind_position':
            if (key === 'state') {
                return {
                    ...common,
                    role: 'level.blind',
                    type: 'number',
                    min: capability.min_value ?? 0,
                    max: capability.max_value ?? 100,
                    unit: capability.unit ?? '%'
                };
            }
            if (key === 'stop') return { ...common, role: 'button.stop', type: 'boolean' };
            if (key === 'up') return { ...common, role: 'button.up', type: 'boolean' };
            if (key === 'down') return { ...common, role: 'button.down', type: 'boolean' };
            return { ...common, role: 'state', type: 'boolean' };
        case 'open_closed':
            return { ...common, role: 'sensor.window', type: 'boolean' };
        case 'trigger':
            return { ...common, role: 'button', type: 'boolean' };
        case 'update_available':
            return { ...common, role: 'indicator.update', type: 'boolean' };
        default:
            return common;
    }
}

function collectDummyStates(defs) {
    const states = [];
    defs.forEach(({ deviceId, config }) => {
        const deviceSlug = slugifyName(config?.name, deviceId);
        if (Array.isArray(config.capabilities)) {
            config.capabilities.forEach(cap => {
                const dummyIds = buildDummyStateIds(deviceSlug, cap);
                Object.entries(dummyIds).forEach(([key, id]) => {
                    states.push({ id, common: getDummyCommon(cap, key) });
                });
            });
        }
    });
    return states;
}

function ensureFoldersForState(stateId) {
    const parts = stateId.split('.');
    if (parts.length < 2) return;

    // Spezieller Umgang mit 0_userdata.0, damit nicht fälschlich "0_userdata" als Folder angelegt wird
    let idx = 0;
    let current = '';
    if (parts[0] === '0_userdata' && parts[1] === '0') {
        current = '0_userdata.0';
        idx = 2;
        if (!existsObject(current)) {
            setObject(current, {
                type: 'folder',
                common: { name: 'Userdata Root' },
                native: {}
            });
        }
    }

    for (; idx < parts.length - 1; idx++) {
        const part = parts[idx];
        current = current ? `${current}.${part}` : part;
        if (!existsObject(current)) {
            setObject(current, {
                type: 'folder',
                common: { name: part },
                native: {}
            });
        }
    }
}

function ensureDummyState(stateId, common) {
    if (!existsState(stateId)) {
        const initial =
            common.type === 'boolean'
                ? false
                : common.type === 'number'
                    ? (common.min !== undefined ? common.min : 0)
                    : '';
        createState(stateId, initial, {
            name: common.name,
            type: common.type,
            role: common.role,
            read: common.read !== false,
            write: common.write !== false,
            min: common.min,
            max: common.max,
            unit: common.unit
        });
    }
}

function ensureDummyObjects(stateList) {
    stateList.forEach(({ id, common }) => ensureDummyState(id, common));
}

const DEVICE_DEFINITIONS = rewriteDevicesToDummy(RAW_DEVICE_DEFINITIONS);
const DUMMY_STATES = collectDummyStates(DEVICE_DEFINITIONS);

// ===========================
// ROOM DUMMY UNTERSTÜTZUNG
// ===========================

function buildDummyRoomMetricId(roomId, metric) {
    const roomSlug = slugifyName(roomId, roomId);
    const metricSlug = slugifyName(metric.type, metric.type);
    return `${DUMMY_ROOT}.room.${roomSlug}.${metricSlug}`;
}

function rewriteRoomsToDummy(rooms) {
    const clone = {};
    Object.entries(rooms || {}).forEach(([roomId, cfg]) => {
        if (cfg && Array.isArray(cfg.metrics)) {
            const metrics = cfg.metrics.map(m => ({
                ...m,
                state: buildDummyRoomMetricId(roomId, m)
            }));
            clone[roomId] = { ...cfg, metrics };
        } else {
            clone[roomId] = cfg;
        }
    });
    return clone;
}

function collectDummyRoomStates(rooms) {
    const states = [];
    Object.entries(rooms || {}).forEach(([roomId, cfg]) => {
        if (cfg && Array.isArray(cfg.metrics)) {
            cfg.metrics.forEach(metric => {
                const id = metric.state || buildDummyRoomMetricId(roomId, metric);
                // Verwende getDummyCommon mit einem minimalen Capability-ähnlichen Objekt
                const capLike = {
                    type: metric.type,
                    unit: metric.unit,
                    description: metric.type
                };
                const common = getDummyCommon(capLike, 'state');
                states.push({ id, common });
            });
        }
    });
    return states;
}

// ===========================
// ROOM-DEFINITIONEN (NEUE ARCHITEKTUR)
// ===========================

const RAW_ROOM_DEFINITIONS = {
    'office': {
        name: 'Büro',
        icon: '🏢',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B6B.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B6B.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'diningroom': {
        name: 'Esszimmer',
        icon: '🍽️',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31BFF.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31BFF.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'floor_eg': {
        name: 'Flur EG',
        icon: '🚪',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31C07.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31C07.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'floor_og': {
        name: 'Flur OG',
        icon: '🪜',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B93.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B93.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'joel': {
        name: 'Joel',
        icon: '👶',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B7E.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B7E.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'secondChild': {
        name: '2. Kinderzimmer',
        icon: '👶',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B5F.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B5F.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'bedroom': {
        name: 'Schlafzimmer',
        icon: '🛏️',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B7A.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B7A.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'livingroom': {
        name: 'Wohnzimmer',
        icon: '🛋️',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31BFF.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31BFF.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'kitchen': {
        name: 'Küche',
        icon: '🍳',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B67.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B67.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'bathroom_eg': {
        name: 'Badezimmer EG',
        icon: '🚿',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B5D.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B5D.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'bathroom_og': {
        name: 'Badezimmer OG',
        icon: '🚿',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A7DE31.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A7DE31.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'garage': {
        name: 'Garage',
        icon: '🚗'
    },
    'garden': {
        name: 'Garten',
        icon: '🌱'
    },
    'storage': {
        name: 'Abstellraum',
        icon: '📦'
    },
    'household': {
        name: 'Hauswirtschaftsraum',
        icon: '🏠'
    },
    'houseControl': {
        name: 'Haussteuerung',
        icon: '🏠'
    },
    'multi_function_room': {
        name: 'Multifunktionsraum',
        icon: '🎯',
        metrics: [
            { type: 'temperature', state: 'hm-rpc.1.000C9A49A31B69.1.ACTUAL_TEMPERATURE', unit: '°C', decimals: 1, aggregation: 'latest' },
            { type: 'humidity', state: 'hm-rpc.1.000C9A49A31B69.1.HUMIDITY', unit: '%', decimals: 0, aggregation: 'latest' }
        ]
    },
    'playroom': {
        name: 'Spielzimmer',
        icon: '🎮'
    }
};

// ===========================
// CAPABILITY VALIDIERUNG
// ===========================

const ROOM_DEFINITIONS = rewriteRoomsToDummy(RAW_ROOM_DEFINITIONS);
const DUMMY_ROOM_STATES = collectDummyRoomStates(ROOM_DEFINITIONS);
const ALL_DUMMY_STATES = [...DUMMY_STATES, ...DUMMY_ROOM_STATES];

const VALID_CAPABILITIES = {
    'toggle': { type: 'boolean', required_state: true, description: 'Ein-/Ausschalten' },
    'dimming': { type: 'number', range: [0, 100], required_state: true, description: 'Helligkeit (0-100%)' },
    'color_temperature': { type: 'number', range: [2700, 6500], required_state: true, description: 'Farbtemperatur (2700K-6500K)' },
    'rgb': { type: 'string', format: 'hex', required_state: true, description: 'RGB Farbe (Hex-Format)' },
    'effects': { type: 'string', required_state: true, description: 'Lichteffekte' },
    'power_monitoring': { type: 'number', range: [0, 9999], required_state: true, description: 'Stromverbrauch (Watt)' },
    'scheduling': { type: 'object', required_state: true, description: 'Zeitpläne/Timer' },
    'window_sensor': { type: 'boolean', required_state: true, description: 'Fensterstatus (offen/geschlossen)' },
    'door_sensor': { type: 'boolean', required_state: true, description: 'Türstatus (offen/geschlossen)' },
    'motion_sensor': { type: 'boolean', required_state: true, description: 'Bewegungsmelder' },
    'temperature': { type: 'number', range: [-40, 80], required_state: true, description: 'Temperatur (°C)' },
    'humidity': { type: 'number', range: [0, 100], required_state: true, description: 'Luftfeuchtigkeit (%)' },
    'air_quality': { type: 'number', range: [0, 500], required_state: true, description: 'Luftqualität (ppm)' },
    'pressure': { type: 'number', range: [300, 1100], required_state: true, description: 'Luftdruck (hPa)' },
    'luminance': { type: 'number', range: [0, 100000], required_state: true, description: 'Helligkeit (Lux)' },
    'blind_position': { type: 'number', range: [0, 100], required_state: true, description: 'Rollladenposition (0=zu, 100=offen)' },
    'tilt_sensor': { type: 'boolean', required_state: true, description: 'Neigungssensor' },
    'thermostat': { type: 'number', range: [5, 35], required_state: true, description: 'Solltemperatur (°C)' },
    'fan_speed': { type: 'number', range: [0, 100], required_state: true, description: 'Lüftergeschwindigkeit (%)' },
    'trigger': { type: 'boolean', required_state: true, description: 'Trigger-Aktion (setzt auf true, Device setzt automatisch zurück)' },
    // Offen/Geschlossen als funktionale Capability (z.B. Sensoren)
    'open_closed': { type: 'boolean', required_state: true, description: 'Offen/Geschlossen Status' }
};

const VALID_META_CAPABILITIES = {
    'device_available': { type: 'boolean', description: 'Gerät online/offline Status (kann mit inverted Parameter invertiert werden)' },
    'signal_strength': { type: 'number', range: [0, 255], description: 'Zigbee Link Quality (0-255)' },
    'wifi_signal_strength': { type: 'number', range: [-100, 0], description: 'WiFi RSSI Signal Strength (dBm)' },
    'last_seen': { type: 'timestamp', description: 'Letzte Kommunikation mit dem Gerät' },
    'battery_level': { type: 'number', range: [0, 100], description: 'Batterie-Status (%)' },
    'battery_voltage': { type: 'number', range: [0, 5], description: 'Batteriespannung (V)' },
    'power_consumption': { type: 'number', range: [0, 9999], description: 'Aktueller Stromverbrauch (W)' },
    'energy_total': { type: 'number', range: [0, 999999], description: 'Gesamtenergieverbrauch (kWh)' },
    'firmware_version': { type: 'string', description: 'Firmware-Version des Geräts' },
    'update_available': { type: 'boolean', description: 'Firmware-Update verfügbar' },
    'error_status': { type: 'string', description: 'Aktueller Fehlerstatus' },
    'maintenance_required': { type: 'boolean', description: 'Wartung erforderlich' },
    // Sensors für Offen/Geschlossen (Fenster/Türen)
    'open_closed': { type: 'boolean', description: 'Offen/Geschlossen Status' }
};

// ===========================
// ROOM METRICS SCHEMA & VALIDATION
// ===========================

const VALID_ROOM_METRICS = {
    'temperature': { unit: '°C', description: 'Raumtemperatur' },
    'humidity': { unit: '%', description: 'Luftfeuchtigkeit' }
};

function validateRoomConfig(roomId, roomConfig) {
    const errors = [];
    const warnings = [];

    if (!roomConfig || typeof roomConfig !== 'object') {
        errors.push('roomConfig must be an object');
        return { valid: false, errors, warnings };
    }

    if (!roomConfig.name || typeof roomConfig.name !== 'string') {
        warnings.push('roomConfig.name missing - will fallback to roomId');
    }

    if (roomConfig.metrics !== undefined) {
        if (!Array.isArray(roomConfig.metrics)) {
            errors.push('metrics must be an array when provided');
        } else {
            roomConfig.metrics.forEach((m, idx) => {
                if (typeof m !== 'object' || m === null) {
                    errors.push(`metrics[${idx}] must be an object`);
                    return;
                }
                if (!m.type || typeof m.type !== 'string' || !VALID_ROOM_METRICS[m.type]) {
                    errors.push(`metrics[${idx}].type must be one of: ${Object.keys(VALID_ROOM_METRICS).join(', ')}`);
                }
                if (!m.state || typeof m.state !== 'string') {
                    errors.push(`metrics[${idx}].state is required and must be a string`);
                }
                if (m.unit !== undefined && typeof m.unit !== 'string') {
                    warnings.push(`metrics[${idx}].unit should be a string - falling back to default`);
                }
                if (m.decimals !== undefined && (typeof m.decimals !== 'number' || m.decimals < 0 || m.decimals > 3)) {
                    warnings.push(`metrics[${idx}].decimals should be a number between 0 and 3`);
                }
                if (m.aggregation !== undefined && m.aggregation !== 'latest') {
                    warnings.push(`metrics[${idx}].aggregation unsupported value "${m.aggregation}" (supported: 'latest')`);
                }
            });
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

function normalizeRoomConfigForStorage(roomId, roomConfig) {
    const name = (roomConfig && typeof roomConfig.name === 'string') ? roomConfig.name : roomId;
    const icon = (roomConfig && typeof roomConfig.icon === 'string') ? roomConfig.icon : '🏠';
    let metrics = [];
    if (roomConfig && Array.isArray(roomConfig.metrics)) {
        metrics = roomConfig.metrics
            .filter(m => m && typeof m === 'object' && typeof m.state === 'string' && VALID_ROOM_METRICS[m.type])
            .map(m => ({
                type: m.type,
                state: m.state,
                unit: typeof m.unit === 'string' ? m.unit : VALID_ROOM_METRICS[m.type].unit,
                decimals: typeof m.decimals === 'number' ? m.decimals : undefined,
                aggregation: m.aggregation === 'latest' || m.aggregation === undefined ? (m.aggregation || 'latest') : 'latest'
            }));
    }
    return JSON.stringify({ name, icon, metrics });
}

function validateDeviceConfig(deviceId, config) {
    const errors = [];
    const warnings = [];

    if (!deviceId || typeof deviceId !== 'string') {
        errors.push('deviceId must be a non-empty string');
    }

    if (!config.name || typeof config.name !== 'string') {
        errors.push('name is required and must be a string');
    }

    if (!config.type || typeof config.type !== 'string') {
        errors.push('type is required and must be a string');
    }

    if (!config.capabilities || !Array.isArray(config.capabilities)) {
        errors.push('capabilities must be an array');
    }

    // UNIFIED VALIDATION: Alle Capabilities in einem Array
    if (config.capabilities && Array.isArray(config.capabilities)) {
        config.capabilities.forEach((cap, index) => {
            if (typeof cap !== 'object' || cap === null) {
                errors.push(`capabilities[${index}] must be an object`);
                return;
            }

            if (!cap.type || typeof cap.type !== 'string') {
                errors.push(`capabilities[${index}].type is required and must be a string`);
                return;
            }

            // Validate gegen combined capability definitions
            const isValidCapability = VALID_CAPABILITIES[cap.type] || VALID_META_CAPABILITIES[cap.type];
            if (!isValidCapability) {
                errors.push(`Unknown capability type: ${cap.type}`);
                return;
            }

            // State validation
            if (!cap.state || typeof cap.state !== 'string') {
                errors.push(`capabilities[${index}].state is required and must be a string`);
            }

            // Parameter validation (nur für funktionale capabilities mit ranges)
            const capDef = VALID_CAPABILITIES[cap.type];
            if (capDef && capDef.range && cap.min_value !== undefined && cap.max_value !== undefined) {
                if (cap.min_value < capDef.range[0] || cap.max_value > capDef.range[1]) {
                    warnings.push(`capabilities[${index}]: range [${cap.min_value}-${cap.max_value}] exceeds recommended [${capDef.range[0]}-${capDef.range[1]}]`);
                }
            }

            // Inverted flag validation
            if (cap.inverted !== undefined && typeof cap.inverted !== 'boolean') {
                errors.push(`capabilities[${index}].inverted must be a boolean`);
            }
        });

        // Check für wichtige status capabilities
        const hasDeviceAvailable = config.capabilities.some(cap =>
            cap.type === 'device_available');
        const hasSignalStrength = config.capabilities.some(cap =>
            cap.type === 'signal_strength' || cap.type === 'wifi_signal_strength');

        if (!hasDeviceAvailable) {
            warnings.push('Consider adding device_available capability (use inverted: true for Homematic UNREACH states)');
        }
        if (!hasSignalStrength) {
            warnings.push('Consider adding signal_strength or wifi_signal_strength capability');
        }
    } else {
        errors.push('capabilities array is required');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// ===========================
// DEVICE MANAGEMENT
// ===========================

function createDeviceDataPoint(deviceId, config) {
    const stateId = `0_userdata.0.home_controller.devices.${deviceId}`;

    createState(stateId, JSON.stringify(config, null, 2), {
        name: `Device Config: ${config.name}`,
        type: 'string',
        read: true,
        write: true,
        desc: `Configuration for ${config.type} device: ${config.name}`,
        role: 'json'
    });

    console.log(`✅ Created device datapoint: ${stateId}`);
    console.log(`   Name: ${config.name}`);
    console.log(`   Type: ${config.type}`);

    // Unified Architektur: Alle Capabilities in einem Array
    if (config.capabilities && Array.isArray(config.capabilities)) {
        const capabilityNames = config.capabilities.map(cap => {
            const invertedFlag = cap.inverted ? ' (inverted)' : '';
            const unitInfo = cap.unit ? ` [${cap.unit}]` : '';
            const rangeInfo = (cap.min_value !== undefined && cap.max_value !== undefined) ?
                ` (${cap.min_value}-${cap.max_value})` : '';
            return `${cap.type}${invertedFlag}${unitInfo}${rangeInfo}`;
        });
        console.log(`   Capabilities: ${capabilityNames.join(', ')}`);
    }
}

function createRoomDataPoint(roomId, roomConfig) {
    const stateId = `0_userdata.0.home_controller.rooms.${roomId}`;

    // roomConfig kann entweder string (legacy) oder object mit name+icon(+metrics) sein
    let roomData;
    if (typeof roomConfig === 'string') {
        roomData = JSON.stringify({ name: roomConfig, icon: '🏠', metrics: [] });
    } else {
        const validation = validateRoomConfig(roomId, roomConfig);
        if (!validation.valid) {
            console.error(`❌ Invalid room config for ${roomId}:`);
            validation.errors.forEach(e => console.error(`   - ${e}`));
        }
        if (validation.warnings && validation.warnings.length > 0) {
            console.log(`⚠️ Warnings for room ${roomId}:`);
            validation.warnings.forEach(w => console.log(`   - ${w}`));
        }
        roomData = normalizeRoomConfigForStorage(roomId, roomConfig);
    }

    createState(stateId, roomData, {
        name: `Room: ${typeof roomConfig === 'string' ? roomConfig : roomConfig.name}`,
        type: 'string',
        read: true,
        write: true,
        desc: `Room configuration for ${roomId}`,
        role: 'json'
    });

    const displayName = typeof roomConfig === 'string' ? roomConfig : roomConfig.name;
    const displayIcon = typeof roomConfig === 'string' ? '🏠' : roomConfig.icon;
    console.log(`🏠 Created room datapoint: ${stateId} = ${displayIcon} ${displayName}`);
}

function ensureRoomExists(roomId, roomDefinitions = ROOM_DEFINITIONS) {
    const roomStateId = `0_userdata.0.home_controller.rooms.${roomId}`;

    if (!existsState(roomStateId)) {
        let roomConfig;

        if (roomDefinitions && roomDefinitions[roomId]) {
            roomConfig = roomDefinitions[roomId];
        } else {
            // Fallback für unbekannte Räume
            roomConfig = {
                name: roomId.charAt(0).toUpperCase() + roomId.slice(1),
                icon: '🏠'
            };
        }

        createRoomDataPoint(roomId, roomConfig);
        return true;
    }
    return false;
}

function addDevice(deviceId, config) {
    const validation = validateDeviceConfig(deviceId, config);
    if (!validation.valid) {
        console.error(`❌ Invalid device config for ${deviceId}:`);
        validation.errors.forEach(error => console.error(`   - ${error}`));
        return false;
    }

    if (validation.warnings && validation.warnings.length > 0) {
        console.log(`⚠️ Warnings for ${deviceId}:`);
        validation.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    createDeviceDataPoint(deviceId, config);

    if (config.room) {
        ensureRoomExists(config.room);
    }

    return true;
}

// ===========================
// SYNCHRONISATION
// ===========================

function configsAreEqual(config1, config2) {
    return JSON.stringify(config1) === JSON.stringify(config2);
}

function syncDevice(deviceId, desiredConfig) {
    const stateId = `0_userdata.0.home_controller.devices.${deviceId}`;

    if (!existsState(stateId)) {
        const success = addDevice(deviceId, desiredConfig);
        return success ? 'created' : 'error';
    }

    try {
        const currentState = getState(stateId);
        const currentConfig = JSON.parse(currentState.val);

        if (configsAreEqual(currentConfig, desiredConfig)) {
            console.log(`✓ Device ${deviceId} unchanged`);
            return 'unchanged';
        } else {
            setState(stateId, JSON.stringify(desiredConfig, null, 2));
            console.log(`🔄 Updated device ${deviceId}`);
            console.log(`   Name: ${desiredConfig.name}`);

            if (desiredConfig.room) {
                ensureRoomExists(desiredConfig.room);
            }

            return 'updated';
        }
    } catch (error) {
        console.error(`❌ Error syncing device ${deviceId}: ${error}`);
        return 'error';
    }
}

function syncAllDevices() {
    console.log('🔄 Syncing all device definitions...\n');

    let stats = {
        created: 0,
        updated: 0,
        unchanged: 0,
        errors: 0,
        total: DEVICE_DEFINITIONS.length
    };

    DEVICE_DEFINITIONS.forEach(({ deviceId, config }) => {
        const result = syncDevice(deviceId, config);
        stats[result]++;
    });

    console.log('\n📊 Sync Summary:');
    console.log('================');
    console.log(`✅ Created: ${stats.created}`);
    console.log(`🔄 Updated: ${stats.updated}`);
    console.log(`✓ Unchanged: ${stats.unchanged}`);
    if (stats.errors > 0) {
        console.log(`❌ Errors: ${stats.errors}`);
    }
    console.log(`📱 Total: ${stats.total} devices processed`);

    return stats;
}

// ===========================
// ROOM SYNCHRONISATION (like devices)
// ===========================

function roomConfigsAreEqualStringified(currentString, desiredNormalizedString) {
    try {
        // Compare as strings to avoid key-order issues (both are JSON.stringify outputs)
        return currentString === desiredNormalizedString;
    } catch (e) { return false; }
}

function syncRoom(roomId, desiredConfig) {
    const stateId = `0_userdata.0.home_controller.rooms.${roomId}`;

    if (!existsState(stateId)) {
        createRoomDataPoint(roomId, desiredConfig);
        return 'created';
    }

    try {
        const currentState = getState(stateId);
        const desiredNormalized = normalizeRoomConfigForStorage(roomId, desiredConfig);
        if (roomConfigsAreEqualStringified(currentState.val, desiredNormalized)) {
            console.log(`✓ Room ${roomId} unchanged`);
            return 'unchanged';
        } else {
            setState(stateId, desiredNormalized);
            console.log(`🔄 Updated room ${roomId}`);
            return 'updated';
        }
    } catch (error) {
        console.error(`❌ Error syncing room ${roomId}: ${error}`);
        return 'error';
    }
}

function syncAllRooms() {
    console.log('🔄 Syncing all room definitions...\n');
    const roomIds = Object.keys(ROOM_DEFINITIONS || {});
    let stats = { created: 0, updated: 0, unchanged: 0, errors: 0, total: roomIds.length };
    roomIds.forEach((roomId) => {
        const result = syncRoom(roomId, ROOM_DEFINITIONS[roomId]);
        stats[result]++;
    });
    console.log('\n📊 Room Sync Summary:');
    console.log('====================');
    console.log(`✅ Created: ${stats.created}`);
    console.log(`🔄 Updated: ${stats.updated}`);
    console.log(`✓ Unchanged: ${stats.unchanged}`);
    if (stats.errors > 0) console.log(`❌ Errors: ${stats.errors}`);
    console.log(`🏠 Total: ${stats.total} rooms processed`);
    return stats;
}

// ===========================
// DEVICE RETRIEVAL FUNCTIONS
// ===========================

/**
 * Holt Device-Konfiguration (originale State-IDs)
 * 
 * @param {string} deviceId - Device-ID
 * @returns {Object|null} Device-Konfiguration oder null falls nicht gefunden
 */
function getDeviceConfig(deviceId) {
    const stateId = `0_userdata.0.home_controller.devices.${deviceId}`;

    if (!existsState(stateId)) {
        console.error(`❌ Device ${deviceId} not found`);
        return null;
    }

    try {
        return JSON.parse(getState(stateId).val);
    } catch (error) {
        console.error(`❌ Error reading device ${deviceId}: ${error}`);
        return null;
    }
}

/**
 * Holt originale State-ID für eine bestimmte Capability (NEUE ARCHITEKTUR)
 * 
 * @param {string} deviceId - Device-ID
 * @param {string} capabilityType - Capability-Type
 * @returns {string|null} State-ID oder null
 */
function getStateId(deviceId, capabilityType) {
    const config = getDeviceConfig(deviceId);

    if (!config) {
        return null;
    }

    // Unified Architektur: Suche in capabilities array
    if (config.capabilities && Array.isArray(config.capabilities)) {
        const capability = config.capabilities.find(cap => cap.type === capabilityType);
        return capability ? capability.state : null;
    }

    return null;
}

/**
 * Holt alle State-IDs für ein Device (NEUE ARCHITEKTUR)
 * 
 * @param {string} deviceId - Device-ID  
 * @returns {string[]} Array mit allen State-IDs
 */
function getAllStateIds(deviceId) {
    const config = getDeviceConfig(deviceId);
    const stateIds = [];

    if (!config) {
        return stateIds;
    }

    // Sammle alle capabilities states (unified array)
    if (config.capabilities && Array.isArray(config.capabilities)) {
        config.capabilities.forEach(cap => {
            if (cap.state) {
                stateIds.push(cap.state);
            }
            // Multi-State Capabilities (für zukünftige Erweiterungen)
            ['up', 'down', 'stop', 'position_feedback'].forEach(key => {
                if (cap[key]) {
                    stateIds.push(cap[key]);
                }
            });
        });
    }

    return [...new Set(stateIds)]; // Remove duplicates
}

// ===========================
// ANZEIGE-FUNKTIONEN
// ===========================

function listAllDevices() {
    console.log('\n📋 All Home Controller Devices:');
    console.log('================================');

    const devices = [];

    $('0_userdata.0.home_controller.devices.*').each(function (id) {
        try {
            const config = JSON.parse(getState(id).val);
            const deviceId = id.split('.').pop();
            devices.push({
                id: deviceId,
                config: config
            });
        } catch (error) {
            console.log(`❌ Error reading ${id}: ${error}`);
        }
    });

    const devicesByRoom = {};
    devices.forEach(device => {
        const room = device.config.room || 'unknown';
        if (!devicesByRoom[room]) {
            devicesByRoom[room] = [];
        }
        devicesByRoom[room].push(device);
    });

    Object.entries(devicesByRoom).forEach(([room, roomDevices]) => {
        console.log(`\n🏠 ${room.toUpperCase()}:`);
        if (Array.isArray(roomDevices)) {
            roomDevices.forEach(device => {
                console.log(`  🔸 ${device.id}: ${device.config.name} (${device.config.type})`);

                // Unified Architektur: Alle Capabilities in einem Array
                if (device.config.capabilities && Array.isArray(device.config.capabilities)) {
                    const capabilityNames = device.config.capabilities.map(cap => {
                        const invertedFlag = cap.inverted ? ' (inverted)' : '';
                        const unitInfo = cap.unit ? ` [${cap.unit}]` : '';
                        const rangeInfo = (cap.min_value !== undefined && cap.max_value !== undefined) ?
                            ` (${cap.min_value}-${cap.max_value})` : '';
                        return `${cap.type}${invertedFlag}${unitInfo}${rangeInfo}`;
                    });
                    console.log(`     Capabilities: ${capabilityNames.join(', ')}`);
                }
            });
        }
    });

    console.log(`\n📊 Total: ${devices.length} devices in ${Object.keys(devicesByRoom).length} rooms`);
}

function listRoomMetrics() {
    console.log('\n🌡️ Room Metrics:');
    console.log('================');
    $('0_userdata.0.home_controller.rooms.*').each(function (id) {
        try {
            const cfg = JSON.parse(getState(id).val);
            const roomId = id.split('.').pop();
            const metrics = Array.isArray(cfg.metrics) ? cfg.metrics : [];
            if (metrics.length > 0) {
                console.log(`\n🏠 ${roomId}: ${cfg.name || roomId}`);
                metrics.forEach((m, idx) => {
                    console.log(`  • ${idx + 1}. ${m.type} → ${m.state} ${m.unit ? '[' + m.unit + ']' : ''}`);
                });
            }
        } catch (e) {
            console.log(`❌ Error reading ${id}: ${e}`);
        }
    });
}

function listAvailableCapabilities() {
    console.log('\n📚 Available Capabilities:');
    console.log('==========================');

    console.log('\n🔧 Functional Capabilities:');
    Object.entries(VALID_CAPABILITIES).forEach(([name, info]) => {
        const rangeInfo = ('range' in info) ? ` (${info.range[0]}-${info.range[1]})` : '';
        console.log(`  - ${name}: ${info.description}${rangeInfo}`);
    });

    console.log('\n🔍 Meta-Capabilities:');
    Object.entries(VALID_META_CAPABILITIES).forEach(([name, info]) => {
        const rangeInfo = ('range' in info) ? ` (${info.range[0]}-${info.range[1]})` : '';
        console.log(`  - ${name}: ${info.description}${rangeInfo}`);
    });
}

// ===========================
// SETUP-FUNKTIONEN
// ===========================

function ensureBaseStructure() {
    if (!existsState('0_userdata.0.home_controller')) {
        console.log('📁 Creating base folder structure...\n');

        setObject('0_userdata.0.home_controller', {
            type: 'folder',
            common: {
                name: 'Home Controller Configuration Root',
                desc: 'Root folder for Home Controller configuration'
            },
            native: {}
        });

        setObject('0_userdata.0.home_controller.devices', {
            type: 'folder',
            common: {
                name: 'Device Configurations',
                desc: 'Individual device configuration datapoints'
            },
            native: {}
        });

        setObject('0_userdata.0.home_controller.rooms', {
            type: 'folder',
            common: {
                name: 'Room Configurations',
                desc: 'Room configuration datapoints'
            },
            native: {}
        });

        console.log('✅ Base folder structure created\n');
        return true;
    }
    return false;
}

// ===========================
// SCRIPT EXECUTION
// ===========================

console.log('🏠 ioBroker Home Controller - All-in-One Device Manager');
console.log('========================================================');
console.log(`📱 Found ${DEVICE_DEFINITIONS.length} device definitions\n`);

// 1. Basis-Struktur sicherstellen
console.log('🔧 Ensuring base structure...');
ensureBaseStructure();

// 1b. Dummy States sicherstellen
console.log('\n🧪 Ensuring dummy states...');
ensureDummyObjects(ALL_DUMMY_STATES);

// 2. Device-Synchronisation
console.log('\n🔄 Starting device synchronization...');
const syncStats = syncAllDevices();

// 3. Aktueller Status
if (syncStats.created > 0 || syncStats.updated > 0) {
    console.log('\n📋 Current device configuration:');
    listAllDevices();
}

// 3b. Room-Synchronisation
console.log('\n🔄 Starting room synchronization...');
const roomStats = syncAllRooms();
if (roomStats.created > 0 || roomStats.updated > 0) {
    console.log('\n🌡️ Configured room metrics overview:');
    listRoomMetrics();
}

// 4. Verfügbare Funktionen
console.log('\n🛠️ Available Functions:');
console.log('=======================');
console.log('  - syncAllDevices() - Sync all device definitions');
console.log('  - addDevice(deviceId, config) - Add single device');
console.log('  - listAllDevices() - Show all devices');
console.log('  - listAvailableCapabilities() - Show all capabilities');
console.log('  - ensureRoomExists(roomId, roomName) - Create room');
console.log('  - getDeviceConfig(deviceId) - Get device configuration');
console.log('  - getStateId(deviceId, capability) - Get state ID for capability');
console.log('  - syncAllRooms() - Sync all room definitions');
console.log('  - listRoomMetrics() - Show configured room metrics');

console.log('\n💡 To add new devices:');
console.log('  1. Add to DEVICE_DEFINITIONS array at top of script');
console.log('  2. Include status capabilities like device_available and signal_strength');
console.log('  3. Use inverted: true for devices with reversed logic (e.g. Velux blinds)');
console.log('  4. Run script again → automatic sync!');

// Optional: Capabilities anzeigen
if (syncStats.created > 0) {
    console.log('\n📚 Available capabilities for new devices:');
    listAvailableCapabilities();
}

console.log('\n✅ Device configuration system ready!');
console.log('=====================================\n'); 