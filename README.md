# Mappy

Mappy ist ein leichtgewichtiges Web-Projekt fuer Mindmaps und freie Diagramme auf einem grossen Canvas.

## Features

- Grosser pannbarer und zoombarer Canvas mit Grid-Hintergrund
- Karten erstellen, verschieben, bearbeiten und loeschen
- Kartentext standardmaessig zentriert
- Kartengroesse pro Karte per Ziehen aendern und Kartenfarbe per Kontextmenue waehlen
- Karten mit verschiedenen Verbindungstypen verbinden (durchgezogen, gestrichelt, gerichtet, gerichtet + gestrichelt)
- Verbindung auswaehlen und loeschen (Button oder `Entf` / `Backspace`)
- Neue, direkt verbundene Karte per Drag vom `+`-Handle einer bestehenden Karte

## Bedienung

- Hintergrund ziehen: Canvas bewegen (Pan)
- Mausrad: Zoom
- `Karte erstellen`: Modus aktivieren und auf den Canvas klicken
- Karte klicken: Text direkt bearbeiten (zentriert)
- Beim Editieren erscheint ueber der Karte ein kleines Text-Stilmenue (`B`, `I`, `U`, links/zentriert/rechts)
- Karte ziehen (Drag & Drop): Karte verschieben
- Karte unten rechts am Handle ziehen: Groesse aendern
- Rechtsklick auf Karte: Farb-Kontextmenue mit Preset-Farben
- Verbindungstyp in der Toolbar waehlen
- `Verbinden`: erste Karte klicken, dann zweite Karte klicken (mit gewaehltem Typ)
- `+` an einer Karte ziehen und loslassen: neue verbundene Karte erstellen
- Verbindung anklicken: Verbindung auswaehlen
- Verbindungstyp waehrend Auswahl aendern: Dropdown in der Toolbar
- `Entf` oder `Backspace`: ausgewaehlte Verbindung loeschen
- `ESC`: aktiven Modus verlassen
- `Ansicht zentrieren`: Kamera zur Mitte zuruecksetzen

## Projektstruktur

- `index.html`: Layout und Toolbar
- `styles.css`: UI-Styles, Canvas und Karten-Design
- `app.js`: Interaktionslogik (Pan/Zoom/Karten/Verbindungen)

## Lokal starten

Da es eine Vanilla-Web-App ohne Build-Schritt ist, reicht eine statische Auslieferung:

1. Einfach `index.html` im Browser oeffnen
2. Oder einen lokalen Static Server starten (z. B. `python3 -m http.server 5173`) und `http://localhost:5173` aufrufen
