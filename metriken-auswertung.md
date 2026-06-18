# Metriken-Auswertung: Codex-gestützte Testgenerierung

**Projekt:** Wishlist Web-Applikation (Express + Sequelize + SQLite + Vanilla JS)  
**KI-Assistent:** OpenAI Codex  
**Kurs:** KIS4 – Künstliche Intelligenz in der Softwareentwicklung  
**Datum:** 18. Juni 2026  
**Auswertung auf Branch:** `claude/prompt-5`

> **Wichtige Vorbemerkung – Framework:** Alle Codex-Branches verwenden ausschließlich Nodes **eingebautes Testframework** (`node:test`, `node:assert/strict`). Es werden **keine externen Abhängigkeiten** (Vitest, Supertest, jsdom, Playwright etc.) installiert. Coverage läuft via `node --experimental-test-coverage`. HTTP-Requests in Tests verwenden das native `fetch`-API.

---

## 1 · Test Coverage (`node --experimental-test-coverage`)

Coverage gemessen auf `src/backend/app.mjs` (Haupt-Geschäftslogik und REST-API).

### Ergebnis-Tabelle Coverage

| Prompt | Branch | Lines % | Branches % | Functions % | Nicht abgedeckt |
|--------|--------|:-------:|:----------:|:-----------:|:----------------|
| P1 | `codex/prompt-1` | 98.96 % | 86.96 % | 100 % | app.mjs:13–14 |
| P2 | `codex/prompt-2` | 98.96 % | 87.50 % | 100 % | app.mjs:13–14 |
| **P3** | `codex/prompt-3` | **100 %** | **92.00 %** | **100 %** | – |
| P4 | `codex/prompt-4` | 98.96 % | 87.50 % | 100 % | app.mjs:13–14 |
| P5 | `codex/prompt-5` | 98.54 % | **75.00 %** | 100 % | app.mjs:179–180, 185 |

> **Hinweis zum Node.js Coverage-Format:** `node:test` meldet `line %` statt `statements %`. Zeilenwerte sind funktional äquivalent zu Statement-Coverage.

### Erläuterungen zu den Coverage-Werten

**P3 – einziger Branch mit 100 % Line Coverage:**  
Der Test `createSequelize creates missing directories for file-backed sqlite storage` verwendet `mkdtemp` aus `node:fs/promises`, um ein echtes temporäres Verzeichnis zu erstellen, und übergibt den Pfad an `createSequelize`. Damit wird Zeile 13 (`mkdirSync(dirname(storage), ...)`), die in allen anderen Branches unabgedeckt bleibt, erstmals ausgeführt.

**P5 – niedrigster Branch-Wert (75 %) trotz bester Struktur:**  
Codex fügte in P5 eine vollständige 4-Argument-Error-Handler-Middleware in `app.mjs` ein:
```javascript
// app.mjs, Zeile 177–187 (nur in codex/prompt-5)
app.use((error, req, res, next) => {
  if (res.headersSent) {       // ← Zeile 179: nie getestet
    return next(error);         // ← Zeile 180: nie getestet
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json(...); // ← getestet (malformed JSON Test)
  }
  return res.status(status).json(...); // ← Zeile 185: 500-Pfad nie getestet
});
```
Der `headersSent`-Zweig und der generische 500-Fehler-Pfad wurden nicht durch Tests abgedeckt.

**P1/P2/P4 – app.mjs:13–14 unabgedeckt:**  
Identisch zum claude-Befund: `mkdirSync` wird nur bei File-Storage ausgeführt, alle Tests verwenden `:memory:`.

---

## 2 · Pass Rate

| Prompt | Tests gesamt | Suites | Bestanden | Fehlgeschlagen | Entfernt | Angepasst | Pass Rate |
|--------|:------------:|:------:|:---------:|:--------------:|:--------:|:---------:|:---------:|
| P1 | 7 | 0 | **7** | 0 | 0 | 0 | 100 % |
| P2 | 12 | 0 | **12** | 0 | 0 | 0 | 100 % |
| P3 | 14 | 3 | **14** | 0 | 0 | 0 | 100 % |
| P4 | 12 | 0 | **12** | 0 | 0 | 0 | 100 % |
| P5 | 14 | 5 | **14** | 0 | 0 | 0 | 100 % |

> Alle Codex-Branches: **100 % Pass Rate ohne Nachbearbeitung.** Kein einziger Test wurde entfernt oder angepasst.

### Testanzahl nach Datei / Testart (alle Branches)

| Branch | Datei(en) | Tests | Typ |
|--------|-----------|:-----:|-----|
| P1 | `test/app.test.mjs` | 5 | Backend Integration (HTTP) |
| P1 | `test/frontend-static.test.mjs` | 2 | Frontend-Struktur (DOM-Kontrakt) |
| P2 | `test/backend.test.mjs` | 8 | Unit + Integration |
| P2 | `test/frontend.test.mjs` | 4 | Frontend-Kontrakt + CSS |
| P3 | `test/app.test.mjs` | 14 | Unit + Integration (alle in einer Datei, 3 `describe`-Blöcke) |
| P4 | `test/app.unit.test.mjs` | 3 | Unit (DB-Schicht) |
| P4 | `test/api.integration.test.mjs` | 4 | Integration (HTTP) |
| P4 | `test/e2e.test.mjs` | 5 | E2E (statischer Dateiserver + HTTP) |
| P5 | `test/unit/database.test.mjs` | 3 | Unit (DB-Schicht) |
| P5 | `test/integration/wishlist-api.test.mjs` | 5 | Integration (HTTP, Wishlist) |
| P5 | `test/integration/wish-api.test.mjs` | 3 | Integration (HTTP, Wish) |
| P5 | `test/e2e/backend-http.e2e.test.mjs` | 1 | E2E (User-Workflow) |
| P5 | `test/e2e/frontend-contract.test.mjs` | 2 | Frontend-Kontrakt |

---

## 3 · Qualitative Code-Analyse

### Prompt 1 – `test/app.test.mjs` + `test/frontend-static.test.mjs`

**Lesbarkeit:** ★★★★☆  
Kompakte, gut lesbare Dateien. Keine unnötigen Abstraktionen. `startTestBackend()` kapselt sauber das HTTP-Setup. Testbeschreibungen sind sehr knapp gehalten (`"createBackend can initialize..."`) – nennen das Subjekt, nicht das erwartete Verhalten.

**Struktur und Organisation:** ★★☆☆☆  
Keine `describe`-Blöcke – alle Tests auf Top-Level-Ebene. Kein Shared-Helper-Modul. Frontend-Tests in separater Datei.

**Benennung:** ★★★☆☆  
Tests beschreiben ein Verhalten, nicht einen Erwartungswert. Beispiel: `"wishlist endpoints support create, read, update, and delete"` – sehr generell; mehrere Assertions in einem Test versteckt.

**Best Practices:** ★★★☆☆  
- `t.after()` für Server-Cleanup ✓  
- Kein `beforeEach`/`afterEach` (jeder Test startet eigenen Server) ✓ (isoliert, aber langsamer)  
- Kein Mocking – reine Integration ✓  
- Kein dediziertes Shared-Helper-Modul ✗  
- Frontend: innovativer Ansatz – verifiziert, dass alle `getElementById`-Referenzen in app.js im HTML existieren ✓

### Prompt 2 – `test/backend.test.mjs` + `test/frontend.test.mjs`

**Lesbarkeit:** ★★★★☆  
Klare Helper-Funktionen `withBackend()` und `requestJson()` reduzieren Boilerplate. `t.after()` für automatische Teardown. Frontend-Tests prüfen gezielt den CSS-Source-Code auf Responsive-Klassen.

**Struktur und Organisation:** ★★★☆☆  
Noch keine `describe`-Hierarchie, aber sinnvolle Trennung backend/frontend. `withBackend()` als wiederverwendbarer Helper. Kein Shared-Modul.

**Benennung:** ★★★★☆  
Deutlich präziser als P1. `"read endpoints preserve the current null response for missing records"` – dokumentiert explizit eine API-Design-Entscheidung. `"initializeDatabase seeds the default wishlist only once"` – beschreibt Idempotenz.

**Best Practices:** ★★★★☆  
- `t.after()` für automatischen Teardown ✓  
- Helper-Funktionen für HTTP + Backend-Setup ✓  
- Tests explizite API-Kontrakte (`x-powered-by`, CORS, null-Response) ✓  
- Frontend: prüft `escapeHtml` auf Source-Code-Ebene (Regex auf app.js) ✓  
- Frontend: prüft CSS auf Responsive-Layout-Klassen ✓  
- Kein `describe`/`beforeEach` ✗

### Prompt 3 – `test/app.test.mjs` (eine Datei)

**Lesbarkeit:** ★★★★★  
Höchste Lesbarkeit bisher. `describe`/`it`/`beforeEach`/`afterEach` mit klarer Hierarchie. Globale `openBackends`/`openServers`-Sets mit `after()`-Assertion zum Leak-Detection. `try/finally` für sichere Ressource-Freigabe.

**Struktur und Organisation:** ★★★★☆  
3 `describe`-Blöcke: `database factories`, `wishlist routes`, `wish routes`. `beforeEach` erstellt Server pro Test. Alles in einer Datei – gut für Übersichtlichkeit, aber keine Trennung nach Testtyp.

**Benennung:** ★★★★★  
Sehr präzise Beschreibungen: `"createSequelize creates missing directories for file-backed sqlite storage"`, `"deleting a missing wishlist is idempotent"`, `"returns null for a missing wishlist and 404 when updating one"` – jeder Test nennt exakt das Szenario und die Erwartung.

**Best Practices:** ★★★★★  
- `describe`/`it`/`beforeEach`/`afterEach` ✓  
- `after()` mit Assertions auf Resource-Leaks (Set-Größe) ✓  
- `try/finally` für sichere Sequelize-Teardowns ✓  
- Einziger Branch der `mkdirSync`-Pfad (file storage) testet ✓  
- Tests Idempotenz von Seeding und DELETE ✓  
- Tests CORS-Header explizit ✓  
- Keine Trennung nach Testtyp in separate Dateien ✗

### Prompt 4 – `test/app.unit.test.mjs` + `test/integration/api.integration.test.mjs` + `test/e2e/e2e.test.mjs`

**Lesbarkeit:** ★★★★☆  
Drei klar getrennte Dateien. Shared `helpers.mjs`. E2E-Test implementiert einen eigenen minimalen HTTP-Static-Server in Node.js – keine externen Deps.

**Struktur und Organisation:** ★★★★★  
Sauberste Trennung bisher: `app.unit.test.mjs` (reine DB-Schicht), `api.integration.test.mjs` (HTTP), `e2e.test.mjs` (Static-Server + API). `npm run test:coverage` als dedizierter Script.

**Benennung:** ★★★★☆  
Klarer als P1/P2. `"end-to-end wishlist workflow works through the same HTTP API used by the frontend"` beschreibt Zweck und Kontext. `"frontend entrypoint and assets are reachable from a static server"` – erklärt E2E-Kontext.

**Best Practices:** ★★★★☆  
- Shared `helpers.mjs` für `createTestServer` ✓  
- Unit / Integration / E2E klar getrennt ✓  
- `test:coverage` npm-Script ✓  
- `try/finally` für Teardown ✓  
- E2E-Server: Path-Traversal-Schutz (`filePath.startsWith(frontendRoot)`) ✓  
- Kein `describe`/`beforeEach` in integration + unit ✗  
- Kein `afterEach` – Cleanup nur via `finally` ✗

### Prompt 5 – `test/unit/`, `test/integration/`, `test/e2e/` + `helpers/`

**Lesbarkeit:** ★★★★★  
Vollständige Verzeichnisstruktur, `describe`/`it` durchgängig, Shared Helpers in eigenem Unterverzeichnis. E2E-Test beschreibt explizit den Frontend-Kontext (`"covers the user workflow used by the static frontend"`).

**Struktur und Organisation:** ★★★★★  
Beste Struktur aller Codex-Branches:  
`test/unit/` · `test/integration/` · `test/e2e/` · `test/helpers/`  
Separate npm-Scripts: `test:unit`, `test:integration`, `test:e2e`, `test` (alle inkl. coverage).

**Benennung:** ★★★★★  
`"rejects malformed JSON before route handlers execute"` – beschreibt Middleware-Layer-Kontext. `"keeps wishlist and wish associations intact when fetching a wishlist"` – beschreibt Datenintegrität.

**Best Practices:** ★★★★★  
- `describe`/`it` durchgängig ✓  
- Shared `backend-test-utils.mjs` mit `createTestBackend`, `requestJson`, `jsonBody` ✓  
- Separate npm-Scripts je Testart ✓  
- Testet Fehlerbehandlungs-Middleware (malformed JSON → 400) ✓  
- Testet CORS + x-powered-by ✓  
- Einziger Branch mit explizitem 400-Bad-Request-Test ✓  
- Coverage-Rückgang durch untestete Error-Handler-Edges ✗

---

## 4 · Testrelevanz & Edge Cases

### Edge-Case-Abdeckung im Detail

| Edge Case | P1 | P2 | P3 | P4 | P5 |
|-----------|:--:|:--:|:--:|:--:|:--:|
| Leere DB (GET → `[]`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Nicht-existente ID bei PUT → 404 | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET non-existent → `null` (API-Kontrakt) | ✓ | ✓ | ✓ | ✓ | ✓ |
| DELETE non-existent → 204 (idempotent) | – | – | ✓ | – | – |
| POST Wish auf fehlende Wishlist → 404 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Seeding idempotent (doppelter Aufruf) | – | ✓ | ✓ | ✓ | ✓ |
| File-Storage: Verzeichnis anlegen | – | – | ✓ | – | ✓ |
| DOM-ID-Kontrakt (HTML ↔ app.js) | ✓ | ✓ | – | ✓ | ✓ |
| CSS Responsive-Layout-Klassen | – | ✓ | – | – | – |
| escapeHtml Source-Code-Verifikation | – | ✓ | – | – | – |
| CORS-Header (`Access-Control-Allow-Origin`) | – | – | ✓ | ✓ | ✓ |
| x-powered-by deaktiviert | – | ✓ | ✓ | ✓ | ✓ |
| Malformed JSON → 400 | – | – | – | – | ✓ |
| Multi-Wish-Workflow (2 Wishes parallel) | – | – | – | – | ✓ |
| Geschwister-Wishes nach Deletion | – | – | – | – | ✓ |
| Path-Traversal-Schutz (Static Server) | – | – | – | ✓ | – |
| Associations nach fetch (n+1 sicher) | – | – | – | – | ✓ |

### Redundanz-Analyse

| Prompt | Redundante Tests | Begründung |
|--------|:---------------:|------------|
| P1 | ~0 | Minimal-Set, jeder Test hat klaren eigenen Scope |
| P2 | ~1 | CRUD-Flow im Backend-Test überschneidet sich mit P1-Pattern |
| P3 | ~0 | Gute Trennung durch `describe`-Hierarchie |
| P4 | ~1 | E2E wiederholt Teile des Integration-CRUD-Tests |
| P5 | ~1 | E2E `backend-http.e2e.test.mjs` testet ähnlichen Flow wie `wishlist-api.test.mjs`; bewusst auf anderer Ebene |

---

## 5 · Anforderungserfüllung

### Prompt 1 – „Generiere eine Testsuite für das Projekt, das in src liegt"

| Anforderung | Erfüllt | Bemerkung |
|-------------|:-------:|-----------|
| Tests für das Projekt in `src/` | ✓ | Backend + Frontend-Struktur |
| Ausführbar | ✓ | 7/7 Tests grün |
| Sinnvoll strukturiert | ~ | Keine `describe`-Blöcke |
| Frontend-Tests | ✓ | DOM-ID-Kontrakt und Asset-Prüfung |
| Keine externen Abhängigkeiten | ✓ | Nur `node:test`, `node:assert` |

**Erfüllungsgrad: 80 %** – Deutlich besser als claude/P1 (75 %) dank eigeninitiativem Frontend-Test. Keine `describe`-Struktur.

---

### Prompt 2 – „Vollständige Testsuite für bestehenden Code"

| Anforderung | Erfüllt | Bemerkung |
|-------------|:-------:|-----------|
| Tests für alle relevanten Funktionen/Klassen | ✓ | Unit-artige Model-Tests + Integration |
| Typische/realistische Anwendungsfälle | ✓ | Realistischer CRUD-Flow auf Deutsch |
| Ausführbar und strukturiert | ✓ | 2 Dateien, Helper-Funktionen |
| Randfälle berücksichtigt | ✓ | null-Response dokumentiert, 404s, Idempotenz |
| Frontend-Tests | ✓ | DOM-Kontrakt + CSS + escapeHtml-Verifikation |

**Erfüllungsgrad: 90 %** – Sehr starke Umsetzung. `escapeHtml`-Source-Check und CSS-Responsive-Test zeigen Kreativität. Kein `describe`-Muster.

---

### Prompt 3 – „Möglichst vollständige Testsuite mit Framework-Wahl, Mocks, Struktur, Übersicht"

| Anforderung | Erfüllt | Bemerkung |
|-------------|:-------:|-----------|
| Framework automatisch erkannt | ✓ | `node:test` (kein npm nötig) |
| Standard-, Rand- und Fehlerfälle | ✓ | inkl. Idempotenz, null, 404, file-storage |
| Dateistruktur passend zum Projekt | ~ | Alles in einer Datei (aber mit `describe`) |
| Keine redundanten Tests | ✓ | Hierarchie verhindert Doppelungen |
| Übersicht der Testfälle | ✓ | `describe`-Hierarchie als implizite Übersicht |
| Mocks/Stubs | ✗ | Keine Mocks – ausschließlich Integration |
| 100 % Line Coverage | ✓ | Einziger Branch der file-storage testet |

**Erfüllungsgrad: 85 %** – 100% Line Coverage ist ein herausragendes Ergebnis. Kein Mocking (Anforderung erwähnt Stubs), alles in einer Datei.

---

### Prompt 4 – „Professionelle Testsuite, Projektanalyse, Unit + Integration + E2E (Playwright)"

| Anforderung | Erfüllt | Bemerkung |
|-------------|:-------:|-----------|
| Projektstruktur zuerst analysiert | ✓ | Reflected in Dateiaufteilung |
| Unit-Tests | ✓ | `app.unit.test.mjs` (DB-Schicht) |
| Integration-Tests | ✓ | `api.integration.test.mjs` |
| E2E-Tests | ✓ | `e2e.test.mjs` (ohne Playwright – Node.js nativ) |
| Playwright | ✗ | Verwendet eigenen Static-HTTP-Server statt Playwright |
| Vollständig lauffähig | ✓ | 12/12 Tests grün |
| Shared Helpers | ✓ | `helpers.mjs` |
| Mocks nur wo notwendig | ✓ | Keine künstlichen Mocks |

**Erfüllungsgrad: 85 %** – Solide Unit/Integration/E2E-Trennung. Playwright-Anforderung nicht erfüllt (bewusste Entscheidung für Zero-Dependency-Ansatz). Eigener Static-Server ist kreativ aber kein echter Browser-Test.

---

### Prompt 5 – „Senior Test Automation Engineer, alle Schichten, Teststrategie, Schwachstellen, Matrix"

| Anforderung | Erfüllt | Bemerkung |
|-------------|:-------:|-----------|
| Architektur- und Risikoanalyse | ~ | Implizit in Dateistruktur, nicht explizit dokumentiert |
| Unit, Integration, E2E | ✓ | Vollständige Verzeichnisstruktur |
| Load-Tests | ✗ | Nicht implementiert |
| Möglichst hohe Testabdeckung | ~ | 75% Branch (schlechter als P3!) |
| Vollständig lauffähig | ✓ | 14/14 Tests grün |
| Schwachstellen-Dokumentation | ✗ | Nicht als Dokument geliefert |
| Refactoring-Vorschläge | ✗ | Nicht geliefert |
| Testfall-Matrix | ✗ | Nicht geliefert |
| Teststrategie | ✗ | Nicht geliefert |
| Fehlerbehandlung (400 Bad Request) | ✓ | Einziger Branch mit malformed-JSON-Test |
| Separate npm-Scripts je Testart | ✓ | `test:unit`, `test:integration`, `test:e2e` |

**Erfüllungsgrad: 60 %** – Beste Teststruktur aller Codex-Branches, aber die umfangreichen Dokumentations-Anforderungen (Matrix, Strategie, Schwachstellen) wurden nicht erfüllt. Load-Tests fehlen vollständig.

---

## 6 · Vergleichende Übersichtstabelle

| Metrik | P1 | P2 | P3 | P4 | P5 |
|--------|:--:|:--:|:--:|:--:|:--:|
| **Tests gesamt** | 7 | 12 | 14 | 12 | 14 |
| **Pass Rate** | 100 % | 100 % | 100 % | 100 % | 100 % |
| **Tests entfernt/angepasst** | 0 | 0 | 0 | 0 | 0 |
| **Line Coverage** | 98.96 % | 98.96 % | **100 %** | 98.96 % | 98.54 % |
| **Branch Coverage** | 86.96 % | 87.50 % | **92.00 %** | 87.50 % | 75.00 % |
| **Function Coverage** | 100 % | 100 % | 100 % | 100 % | 100 % |
| **Testdateien** | 2 | 2 | 1 | 3 | 5 |
| **Testebenen** | 2 | 2 | 1 | 3 | 3 |
| **Externe Abhängigkeiten** | – | – | – | – | – |
| **describe/it Struktur** | – | – | ✓ | ~ | ✓ |
| **beforeEach/afterEach** | – | – | ✓ | – | – |
| **Shared Helper-Modul** | – | – | – | ✓ | ✓ |
| **Unit-Tests (DB-Schicht)** | – | ✓ | ✓ | ✓ | ✓ |
| **Integration-Tests (HTTP)** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Frontend-Kontrakt-Tests** | ✓ | ✓ | – | ✓ | ✓ |
| **E2E-Tests (kein Browser)** | – | – | – | ✓ | ✓ |
| **Browser E2E (Playwright)** | – | – | – | – | – |
| **Load-Tests** | – | – | – | – | – |
| **file-storage Pfad getestet** | – | – | ✓ | – | ✓ |
| **CORS-Header getestet** | – | – | ✓ | ✓ | ✓ |
| **Malformed JSON → 400** | – | – | – | – | ✓ |
| **Idempotenz (DELETE 404→204)** | – | – | ✓ | – | – |
| **CSS-Layout getestet** | – | ✓ | – | – | – |
| **Resource-Leak-Detection** | – | – | ✓ | – | – |
| **Lesbarkeit** | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★★★ |
| **Struktur** | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ | ★★★★★ |
| **Best Practices** | ★★★☆☆ | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★★★ |
| **Anforderungserfüllung** | 80 % | 90 % | 85 % | 85 % | **60 %** |

---

## 7 · Interpretation und Fazit

### Herausragende Besonderheiten der Codex-Branches

**Zero-Dependency-Philosophie (alle Branches):**  
Codex installiert in keinem einzigen Branch externe Abhängigkeiten. Statt Supertest wird `fetch` verwendet, statt Playwright ein selbst-gebauter Static-HTTP-Server, statt jsdom werden HTML- und JS-Dateien als Strings gelesen und per Regex analysiert. Dies ist eine bewusste, konsistente Designentscheidung – nicht ein Mangel.

**P3 – 100 % Line Coverage durch file-storage Test:**  
Der einzige Codex-Branch (und insgesamt der einzige Branch im gesamten Projekt), der den `mkdirSync`-Pfad testet. `mkdtemp` aus `node:fs/promises` erzeugt ein echtes temporäres Verzeichnis – sauber und ohne Mocking.

**P3 – Resource-Leak-Detection:**  
```javascript
after(async () => {
  assert.equal(openBackends.size, 0);
  assert.equal(openServers.size, 0);
});
```
Diese globale Post-Run-Assertion verifiziert, dass alle Backends/Server korrekt geschlossen wurden – ein Best Practice, das in keinem anderen Branch vorkommt.

**P5 – Error-Handling-Middleware in app.mjs:**  
Als einziger Branch fügt P5 eine vollständige 4-Argument-Fehler-Middleware in `app.mjs` ein und testet den malformed-JSON-Fall (400). Dies löst das Express-4-Problem (fehlende async-Error-Propagation) auf Produktionscode-Ebene – statt Tests zu entfernen wie claude/P3.

**P2 – escapeHtml-Source-Verifikation:**  
```javascript
assert.match(script, /function escapeHtml\(str\)/);
assert.match(script, /\.replaceAll\("&", "&amp;"\)/);
```
Diese Regex-Tests auf dem Quelltext von app.js verifizieren die Existenz und Korrektheit der XSS-Schutzfunktion – ohne jsdom oder eval(). Unorthodox, aber robust.

### Vergleich: Codex vs. Claude

| Dimension | Codex | Claude |
|-----------|-------|--------|
| Externe Abhängigkeiten | Keine (nur `node:test`) | Vitest, Supertest, jsdom, Playwright, autocannon |
| Max. Tests (P5) | 14 | 102 |
| Max. Line Coverage | **100 %** (P3) | 98.82 % (P5) |
| Max. Branch Coverage | **92 %** (P3) | 90 % (P5) |
| Testebenen | max. 3 (Unit/Integ./E2E) | max. 5 (Unit/Integ./Frontend/E2E/Load) |
| Browser E2E (Playwright) | Nein | Ja (P4, P5) |
| Frontend DOM-Tests | Kontrakt-basiert (Regex) | jsdom-basiert (echte Ausführung) |
| Dokumentation (Matrix, Strategie) | Nein | Ja (P5) |
| Pass Rate ohne Nachbearbeitung | **100 %** alle Branches | 100 % (nach Entfernung/Anpassung) |
| Setup-Aufwand | Minimal (kein `npm install`) | Hoch (Playwright-Download ~150 MB) |

---

*Generiert mit Claude Code (claude-sonnet-4-6) auf Branch `claude/prompt-5` · 18. Juni 2026*
