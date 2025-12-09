# Raum-Metriken in der Admin-Sidebar (Konzept & Umsetzungsschritte)

## Zielbild
- In der Sidebar unter „Räume“ eine ausklappbare Sektion **Metrics** pro Raum.
- Erste Ebene: kompaktes Listing mit Name, Wert+Einheit, Status-Badge (OK/Warn/Alarm/No Data), Zeitstempel „vor X min“.
- Zweite Ebene (aufklappbar je Metrik): Detailkarte mit Mini-Sparkline/History, letzter 10 Werte, ggf. Ziel-/Schwellwert-Badges und Link „In Chart öffnen“. (Trend zunächst weggelassen.)
- Bedienung: Gleicher Chevron-/Icon-Stil wie bei den Capabilities; Lazy-Load der Detaildaten beim Aufklappen.
- Filter oben: „Alle / Kritisch / Favoriten“ + Suchfeld; Favoriten-Pin pro Metrik.

## Datenfluss / API (Vorschlag)
- Snapshot erweitert um `roomMetrics`:
  - Struktur: `roomMetrics: { [roomId: string]: Array<{ id: string; name: string; value: number|string; unit?: string; ts: number; status?: "ok"|"warn"|"alarm"|"nodata"; thresholds?: { warn?: number; alarm?: number; target?: number }; }> }`
  - Wird mit `initialSnapshot` und `snapshot` ausgeliefert.
- State-Änderungen:
  - Neuer WebSocket-Event `roomMetricsUpdateBatch` (gebatcht serverseitig, z.B. 1× pro Minute). Innerhalb des Batches mehrere Metric-Updates pro Raum zusammenfassen.
  - Keine Trend-Berechnung im Event; nur aktueller Wert + Status + ts.
- Backend-Ermittlung:
  - Mapping ioBroker-Objekte → Raum/Metric (Konfig oder Discovery).
  - Ableitung `status` aus Schwellwerten (warn/alarm) oder `ack=false` => nodata/freshness-check.
  - Aktuell keine Trend-Berechnung; nur aktuelle Werte liefern.

## Admin-UI Anpassungen (Tab)
- Sidebar-Struktur:
  - Unter jedem Raum: Abschnitt „Metrics“ mit Chevron.
  - Zeilen-Komponenten `MetricRow`: zeigt Kerninfos + Klick zum Aufklappen.
  - Detail-Komponente `MetricDetails`: rendert Sparkline (lightweight lib / canvas) + History-Liste (Trend-Anzeigen zunächst auslassen).
- State-Management im Admin-Tab:
  - Basis-Snapshot in globalem Zustand; Detail-Data per Lazy-Fetch/Subscribe.
  - Filterzustand (Favoriten, Kritisch, Suche) lokal im Tab-Store.
- Performance:
  - Nur Kerninfos im initialen Snapshot; Detaildaten nachladen bei Aufklapp-Event über dedizierte WS-Message `getRoomMetricDetails` oder durch Caching im Adapter.
  - Debounce beim Tippen im Suchfeld.

## Backend TODOs (Adapter)
1) Datenquelle definieren: Welche ioBroker-States werden als Raum-Metriken interpretiert? (z.B. `room.<roomId>.metrics.*`)
2) Snapshot-Service erweitern: `buildSnapshot` fügt `roomMetrics` hinzu.
3) StateChange-/Subscriptions erweitern:
   - Subscribe auf relevante Metric-States.
   - Auf State-Change → in serverseitigen Buffer aufnehmen; einmal pro Minute als `roomMetricsUpdateBatch` versenden (gefiltert analog Subscriptions).
4) Types ergänzen:
   - `websocket/types.ts` um Payloads für `roomMetricsUpdateBatch` und Snapshot-Schema.
5) (Optional) Trend/Status (später):
   - Wenn gewünscht, Trend separat nachrüsten; aktuell weggelassen.

## Admin-UI TODOs
1) Datenmodell im Frontend-Store um `roomMetrics` und Filterzustand erweitern.
2) Rendering:
   - `RoomList`/Sidebar-Komponente: Metrics-Sektion + Zeilen + Detailpanel.
   - Status-Badges (Farbcode), Trend-Icons, Zeitstempel-Formatter.
3) Interaktion:
   - Favoriten-Pin, Filterchips, Suchfeld.
   - On-expand → Lazy-Load Details (WS-Call) oder aus Cache.
4) Tests:
   - Snapshot-Rendering mit Mock-Daten.
   - WebSocket-Mock für `roomMetricsUpdate`.
   - Filterlogik (kritisch/favoriten/suche).

## Offene Punkte / Entscheidungen
- Welche Schwellwerte/Statuslogik? (Konfig vs. feste Defaults)
- Wie viele History-Punkte für Sparkline? (z.B. 20–50, begrenzen für Performance)
- Brauchen wir Persistenz von Favoriten pro Benutzer (admin UI) oder pro Instanz?
- Sollen Metrics auch in der Geräteliste sichtbar sein, falls es Raum-übergreifende KPIs gibt?

## Empfehlung für ersten Inkrement
1) Snapshot um `roomMetrics` mit Kerninfos (ohne Details) erweitern.
2) Sidebar-UI: Metric-Zeilen + Status + Aufklappbarer Detailbereich, Details zunächst direkt aus Snapshot (kein Lazy).
3) Danach: `roomMetricsUpdateBatch` (minütlich) + Lazy-Load Details/History nachrüsten.

