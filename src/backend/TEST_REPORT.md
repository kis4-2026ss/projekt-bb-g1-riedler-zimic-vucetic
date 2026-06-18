# Teststrategie und Testfall-Matrix

## Projektanalyse

Das Projekt besteht aus einem statischen Vanilla-JavaScript-Frontend und einem Node.js/Express-Backend. Die Datenhaltung erfolgt ueber Sequelize mit SQLite. Die Backend-Architektur ist testfreundlich: `app.mjs` trennt Express-App, Sequelize-Instanz, Modelldefinitionen und Datenbankinitialisierung von `server.mjs`.

Kritische Geschaeftslogik:

- Erstellen, Anzeigen, Umbenennen und Loeschen von Wunschlisten.
- Erstellen, Anzeigen, Aendern und Loeschen von Wuenschen.
- Beziehung `Wishlist hasMany Wish`.
- Initiales Seed-Verhalten.
- Fehlerverhalten bei fehlenden Ressourcen und ungueltigem JSON.
- Vertrag zwischen statischem Frontend und erwarteten DOM-IDs/API-Basis-URL.

## Teststrategie

- Unit-Tests pruefen Datenbankinitialisierung und Seed-Verhalten isoliert mit SQLite `:memory:`.
- Integration-Tests pruefen die REST-API ueber echte HTTP-Requests gegen die Express-App und eine echte In-Memory-Datenbank.
- E2E-nahe Tests pruefen den kompletten Backend-Workflow, den das Frontend nutzt, ohne externe Services oder Browser-Abhaengigkeit.
- Frontend-Contract-Tests pruefen, dass die DOM-Hooks aus `app.js` in `index.html` vorhanden sind und die lokale API-Adresse konsistent bleibt.
- Mocks werden vermieden; die Tests nutzen echte Sequelize-Models und echte Express-Middleware.

## Testfall-Matrix

| ID | Bereich | Risiko | Testdatei | Beschreibung |
| --- | --- | --- | --- | --- |
| T01 | Datenbank | Mittel | `test/unit/database.test.mjs` | Ohne Seed startet die DB leer. |
| T02 | Datenbank | Mittel | `test/unit/database.test.mjs` | Mit Seed wird genau eine Beispiel-Wunschliste mit einem Wunsch erstellt. |
| T03 | Wishlist API | Hoch | `test/integration/wishlist-api.test.mjs` | Vollstaendiger Wishlist-CRUD-Lifecycle. |
| T04 | Wishlist API | Hoch | `test/integration/wishlist-api.test.mjs` | Update einer fehlenden Wunschliste liefert 404. |
| T05 | Wishlist API | Hoch | `test/integration/wishlist-api.test.mjs` | Wunsch zu fehlender Wunschliste liefert 404. |
| T06 | HTTP Robustheit | Mittel | `test/integration/wishlist-api.test.mjs` | Fehlerhaftes JSON wird als 400 abgewiesen. |
| T07 | Security Headers | Niedrig | `test/integration/wishlist-api.test.mjs` | `x-powered-by` ist deaktiviert, CORS ist fuer das statische Frontend offen. |
| T08 | Wish API | Hoch | `test/integration/wish-api.test.mjs` | Vollstaendiger Wish-CRUD-Lifecycle. |
| T09 | Wish API | Hoch | `test/integration/wish-api.test.mjs` | Update eines fehlenden Wunsches liefert 404. |
| T10 | Beziehungen | Hoch | `test/integration/wish-api.test.mjs` | Wunschlisten liefern zugehoerige Wuensche korrekt mit. |
| T11 | E2E Workflow | Hoch | `test/e2e/backend-http.e2e.test.mjs` | Frontend-naher End-to-End-Ablauf ueber mehrere API-Endpunkte. |
| T12 | Frontend Vertrag | Mittel | `test/e2e/frontend-contract.test.mjs` | Alle von `app.js` erwarteten DOM-IDs existieren in `index.html`. |
| T13 | Frontend Vertrag | Niedrig | `test/e2e/frontend-contract.test.mjs` | Frontend nutzt die dokumentierte lokale Backend-URL. |

## Potenzielle Schwachstellen im bestehenden Code

- Es gibt keine serverseitige Validierung fuer leere Titel, fehlende Titel, negative Mengen oder nicht numerische Mengen. Das Frontend validiert teilweise, aber direkte API-Nutzung kann ungueltige Daten speichern.
- Die API hat nun einen kleinen zentralen Fehlerhandler fuer JSON-Parse-Fehler und generische Fehler. Fachliche Validierungsfehler werden aber noch nicht strukturiert erfasst.
- `DataTypes.NUMBER` ist fuer Sequelize/SQLite weniger praezise als `DataTypes.INTEGER` fuer Mengen.
- `GET /wishlist/:id` und `GET /wish/:id` liefern bei fehlenden IDs `200` mit `null`; konsistenter waere `404`.
- Beim Loeschen einer Wunschliste ist das Cascade-Verhalten nicht explizit definiert. Je nach DB-Konfiguration koennen verwaiste Wuensche entstehen.
- Das Frontend ist nicht modular exportiert. Dadurch sind echte Unit-Tests fuer pure Hilfsfunktionen und UI-State nur mit groesserem Test-Harness moeglich.

## Refactoring-Vorschlaege

- Request-Validierung mit klaren Schemas einfuehren, z.B. Titel `required/non-empty`, Menge `integer >= 1`.
- Zentrale Express-Fehlerbehandlung weiter ausbauen, z.B. mit typisierten Fehlerklassen und konsistentem Response-Schema.
- `Wish.quantity` auf `DataTypes.INTEGER` umstellen.
- Fuer fehlende Ressourcen konsistent `404` statt `200 null` zurueckgeben.
- Model-Assoziation mit explizitem `onDelete: 'CASCADE'` absichern oder Wuensche vor dem Loeschen einer Wunschliste gezielt entfernen.
- Frontend-Hilfsfunktionen in ein kleines Modul auslagern, damit Sortierung, Filterung, HTML-Escaping und API-Fehlerbehandlung separat testbar sind.

## Ausfuehrung

```bash
cd src/backend
npm test
```
