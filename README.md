# Mappy

Mappy ist ein leichtgewichtiges Web-Projekt für Mindmaps und freie Diagramme auf einem großen Canvas.

## Features

- Großer pannbarer und zoombarer Canvas mit Grid-Hintergrund
- Karten erstellen, verschieben, bearbeiten und löschen
- Kartentext standardmäßig zentriert
- Kartengröße pro Karte per Ziehen ändern und Kartenfarbe per Kontextmenü wählen
- Karten mit verschiedenen Verbindungstypen verbinden (durchgezogen, gestrichelt, gerichtet, gerichtet + gestrichelt)
- Verbindung auswählen, Richtung umdrehen und löschen
- Neue, direkt verbundene Karte per Drag vom `+`-Handle einer bestehenden Karte
- Daten-Export/Import als JSON (inkl. Kartenposition, Größe, Farbe, Text/Formatierung, Verbindungen, Kamera)
- Bild-Export als PNG aus dem belegten Board-Bereich

## Bedienung

- Hintergrund ziehen: Canvas bewegen (Pan)
- Mausrad: Zoom
- `Karte erstellen`: Modus aktivieren und auf den Canvas klicken
- Karte klicken: Text direkt bearbeiten (zentriert)
- Beim Editieren erscheint über der Karte ein kleines Text-Stilmenü (`B`, `I`, `U`, links/zentriert/rechts)
- Karte ziehen (Drag & Drop): Karte verschieben
- Karte unten rechts am Handle ziehen: Größe ändern
- Rechtsklick auf Karte: Farb-Kontextmenü mit Preset-Farben
- Verbindungstyp in der Toolbar wählen
- `Verbinden`: erste Karte klicken, dann zweite Karte klicken (mit gewähltem Typ)
- `+` an einer Karte ziehen und loslassen: neue verbundene Karte erstellen
- Verbindung anklicken: Verbindung auswählen
- Verbindungstyp während Auswahl ändern: Dropdown in der Toolbar
- `Richtung umdrehen`: ausgewählte gerichtete Verbindung invertieren
- `Entf` oder `Backspace`: ausgewählte Verbindung löschen
- `Daten exportieren`: aktuelles Board als JSON-Datei speichern
- `Daten importieren`: JSON-Datei laden und Board-Zustand wiederherstellen
- `Bild exportieren`: aktuelles Board als PNG speichern
- `ESC`: aktiven Modus verlassen
- `Ansicht zentrieren`: Kamera zur Mitte zurücksetzen

## Projektstruktur

- `index.html`: Layout, Toolbar und Script-Einbindung
- `styles.css`: UI-Styles, Canvas und Karten-Design
- `js/core.js`: Konstanten, DOM-Referenzen, globaler Zustand, Basis-Utilities
- `js/ui.js`: UI- und Auswahl-Logik (Modi, Menüs, Edge-Toolbar-Sync)
- `js/graph.js`: Karten-/Verbindungslogik, Geometrie, Quick-Create, Pan/Zoom-Helfer
- `js/io.js`: Import/Export (JSON + PNG)
- `js/events.js`: Event-Listener und App-Initialisierung

## Lokal starten

Da es eine Vanilla-Web-App ohne Build-Schritt ist, reicht eine statische Auslieferung:

1. Einfach `index.html` im Browser öffnen
2. Oder einen lokalen Static Server starten (z. B. `python3 -m http.server 5173`) und `http://localhost:5173` aufrufen
