# NameFirst Pro

![Pro-Iconentwurf](./assets/brand/icon-128.png)

**Namen zuerst, Belege zum Suchzeitpunkt.** Unabhängige AGPL-3.0-only-Erweiterung für Desktop-Chrome/Edge und Bing/Baidu, kein Fork. `1.0.0-rc.1` ist ein lokaler Kandidat; Icon und Veröffentlichung warten auf Freigabe. Öffentliche Downloads gibt es noch nicht. Die Oberfläche ist vereinfachtes Chinesisch. Neun übersetzte READMEs bedeuten keine neun Oberflächensprachen.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

## Installation und Nutzung

1. Unter `release/1.0.0-rc.1/` die ZIP mit Endung `chrome.zip` bzw. `edge.zip` wählen und vollständig in einen dauerhaften Ordner entpacken. `source.zip` enthält den zugehörigen Quellcode, nicht die ladbare Erweiterung.
2. `chrome://extensions` oder `edge://extensions` öffnen, Entwicklermodus einschalten und den entpackten Ordner laden, der `manifest.json` direkt enthält.
3. Im Erweiterungsfenster Gesamt-/Suchmaschinenschalter aktivieren. Bei Bedarf „开启联网核验权限“ wählen und den Browserhinweis lesen. Ohne Zustimmung werden keine externen Belege gelesen. Die Berechtigung ist widerrufbar.
4. In der normalen Desktop-Websuche z. B. `Apache Arrow official website` suchen. Die eigene Karte zeigt Zustand, genaue Adresse, Quellen und Zeitpunkt. Bestehende Ergebnisse bleiben, keine automatische Weiterleitung.
5. Informationssuchen mit „这次查资料“ korrigieren. Nur ausdrückliche Labels trainieren; Überspringen und Nichtklicken nicht. Persönliche Adressen/Aliasse/Ablehnungen sind von amtlicher Zuordnung getrennt und nicht zertifiziert.
6. In der Verwaltung JSON exportieren. Im neuen Browser Datei auswählen, Zusammenführen/Ersetzen zunächst prüfen, dann bestätigen. Bei Konflikten bleiben lokale Einträge; unbekannte Formate überschreiben nichts. Berechtigungen, Einstellungen, Cache und Rückgängigzustand werden nicht übertragen.
7. Vor Updates sichern, entpackte Dateien ersetzen, Erweiterung neu laden und Suchseiten aktualisieren. Nicht zuerst deinstallieren: dadurch werden lokale Daten gelöscht.

Details: [englische Installation](./INSTALL.en.md), [Verwaltung](./MANAGEMENT.md), [Datenschutz](./PRIVACY.md). Bearbeiten, Löschen, ein Rückgängigschritt und Schutz konkurrierender Entwürfe sind vorhanden.

## Umfang und Grenzen

Namen müssen nicht in einem installierten Katalog stehen. Die einzige positive Autoritätsregel unterstützt derzeit ausdrücklich genannte Start-/Downloadadressen im Apache-Projektverzeichnis. Wikidata liefert Hinweise. Rang, HTTPS, Selbstaussage, Modellwert oder persönliche Auswahl reichen nicht zur Bestätigung. Keine allgemeine Dokumentations-/Loginregel, keine Garantie für alle Websites, Software-Sicherheit oder Qualifikationen.

Unterstützt werden erkannte Desktop-Layouts von Bing HTTPS `/search` und `www.baidu.com/s` mit UTF-8-Websuche. CAPTCHA, Login, versteckte/unbekannte Layouts, Begrenzung und Zeitüberschreitung führen zum Abbruch oder zur Enthaltung, ohne Umgehung. Normale Online-Abnahme ist auf Nutzerwunsch keine Stufenbedingung mehr. Lernen und Nachfragen lassen sich abschalten. Kein vollständiger Suchverlauf; historische Belege bleiben Cache, fehlgeschlagene Prüfungen erneuern ihre Zeit nicht.

[Auswertung](./EVALUATION.md): 36 manuell formulierte Anfragen mit echten Namen, trainiertes Modell 25 richtig, 6 Enthaltungen, 5 fälschlich gestartete Informationssuchen. 24 synthetische Vertrauensfälle, 23 erwartungsgemäße Zustände, 0 falsche unter 3 Bestätigungen. Ein Dokumentationsfall bleibt sicher unbestätigt und verfehlt das Ziel. Keine Schätzung für echte Nutzung oder das ganze Web.

## Entwicklung und Lizenz

Node.js 24+ / pnpm 11.25.0: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`. Veröffentlichungspakete benötigen zusätzlich Git/Python 3.9+ sowie `pnpm release:prepare` und `pnpm release:verify`. ZIP-Nutzer benötigen keine Konten/API-Schlüssel/Entwicklungswerkzeuge. Prüfsummen stehen in `SHA256SUMS`.

Originalcode und der in dieser Runde autorisierte Pro-Grafikableger: AGPL-3.0-only. Abhängigkeiten behalten ihre Lizenzen. Kein übernommener Code, Katalog, Erweiterungs-ID oder Git-Verlauf des Vorgängers. [Grafikherkunft](./assets/brand/README.md) · [Versionshinweise](./RELEASE_NOTES.md) · [LICENSE](./LICENSE).
