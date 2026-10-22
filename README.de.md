# NameFirst Pro

![Blaues Pro-Icon](./assets/brand/icon-128.png)

**Namen zuerst, Belege zum Suchzeitpunkt.** NameFirst Pro ist eine unabhängige Open-Source-Erweiterung für Chrome/Edge auf dem Desktop. Sie erkennt, ob eine Bing-/Baidu-Suche einen offiziellen Einstieg sucht, entdeckt Kandidaten auch für unbekannte Namen und prüft nach Ihrer Erlaubnis aktuelle öffentliche Belege. **AGPL-3.0-only** erlaubt unter ihren Bedingungen auch kommerzielle Nutzung.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

**Erste Version: `1.0.0`, mit freigegebener blauer Gestaltung.** Pakete finden Sie unter den [offiziellen Releases](https://github.com/Thicky-han/namefirst-pro/releases). Fehlt dort noch `v1.0.0`, wartet die Veröffentlichung auf die abschließende Bestätigung des Maintainers und die Pakete sind noch nicht öffentlich. Das Quellcode-ZIP lässt sich nicht direkt installieren. **Die Oberfläche ist derzeit vereinfachtes Chinesisch**; neun übersetzte READMEs sind keine neun Oberflächensprachen.

## Funktionen

- Bei jeder unterstützten Suche lokale Einschätzung: Einstieg gesucht, Informationssuche oder unklar. Namen müssen nicht vorab in einem Katalog stehen.
- Für Navigationsaufgaben werden aktuelle Kandidaten und Belege innerhalb fester Grenzen gesammelt. Die Karte zeigt genaue URL, Zweck, Quellen, Zeitpunkt und Zustand. Fehlende Belege erlauben eine Enthaltung.
- Die ursprünglichen Suchergebnisse bleiben erhalten. Keine automatische Weiterleitung, kein automatisches Herunterladen oder Ausführen.
- Nur ausdrückliches Feedback trainiert das lokale Absichtsmodell. Persönliche URLs, Aliasse und Ausschlüsse sind von offizieller Zuordnung getrennt.
- Bearbeiten, Löschen, Rückgängig für die letzte Änderung und JSON-Sicherungen mit Vorschau vor Zusammenführen/Ersetzen; manueller Umzug zwischen Chrome und Edge.

## Download und Installation

Nutzer der fertigen ZIPs brauchen weder Node.js noch Konto, API-Schlüssel, Projektserver oder Kompilierung.

1. Unter [Releases](https://github.com/Thicky-han/namefirst-pro/releases) die offizielle Version `v1.0.0` öffnen. Für Chrome `namefirst-pro-1.0.0-chrome.zip`, für Edge `namefirst-pro-1.0.0-edge.zip` wählen. `namefirst-pro-1.0.0-source.zip` enthält den zugehörigen Quellcode.
2. **Alle Dateien** in einen dauerhaft aufbewahrten Ordner entpacken. Nicht aus der ZIP laden und den Ordner nach Installation nicht löschen.
3. `chrome://extensions` oder `edge://extensions` öffnen, den Entwicklermodus aktivieren und das Laden einer entpackten Erweiterung wählen.
4. Den Ordner wählen, der **`manifest.json` direkt enthält**, nicht den übergeordneten Ordner. Prüfen, dass **NameFirst Pro** geladen ist; das blaue NF/PRO-Icon bei Bedarf an die Symbolleiste anheften.
5. Im Erweiterungsfenster Gesamt- und gewünschte Suchmaschinenschalter einschalten. Für externe Belege „开启联网核验权限“ wählen, den Browserhinweis zum Zugriff auf HTTPS-Seiten lesen und zustimmen. Die Berechtigung ist widerrufbar; vorher werden keine externen Belege gelesen.
6. In der normalen Desktop-Websuche von Bing/Baidu etwa `Apache Arrow official website` suchen. **Aktuellen Zustand, genauen Einstieg, Quellen und Zeitpunkt** lesen. Nur Belege dieser Aufgabe, die die Richtlinie erfüllen, stützen eine offizielle Zuordnung. Unbekannte Namen können ebenfalls untersucht werden, ohne Bestätigungsgarantie.

Mehr dazu in der [englischen Installationsanleitung](./INSTALL.en.md) oder [Anleitung auf vereinfachtem Chinesisch](./INSTALL.md).

## Feedback, Sicherung und Aktualisierung

Wird eine Informationssuche als Navigation behandelt, „这次查资料“ wählen. „我在找入口“ bedeutet, dass ein Einstieg gesucht wird. „仅本次按入口核验“ bestätigt nur diese Aufgabe, ohne Trainingslabel zu speichern. Überspringen oder Nichtklicken trainiert nicht. Lernen und Nachfragen lassen sich getrennt abschalten. Persönliche URLs bleiben als unbestätigt gekennzeichnet.

Mit „管理记录、查看历史证据与备份迁移“ die Verwaltung öffnen und „导出 JSON 备份“ wählen. Im neuen Browser Datei und Zusammenführen/Ersetzen wählen, mit „预览导入“ erst Datensätze und Konflikte prüfen, dann bestätigen. Zusammenführen behält lokale Konfliktdatensätze; Ersetzen überschreibt persönliche und Lerndaten. Berechtigungen, Einstellungen, historische Belege und Rückgängigzustand werden nicht übertragen und sind separat einzurichten. Unbekannte/beschädigte Formate überschreiben nichts. Sicherungen enthalten selbst eingegebene Namen/URLs und sollten privat aufbewahrt werden.

Vor Updates sichern, die neue Version vollständig entpacken und die geladenen Dateien ersetzen. In der Erweiterungsverwaltung neu laden, danach Such-Tabs aktualisieren. Bloßes Ersetzen auf dem Datenträger kann den alten Hintergrundprozess weiterlaufen lassen. **Nicht zuerst deinstallieren:** Das löscht lokale Daten. Dieselbe Erweiterungsidentität und dasselbe Profil bewahren sie normalerweise, ohne Garantie für alle künftigen Formate.

Fehlt die Karte, unterstützte URL/Ansicht, Gesamt-/Suchmaschinenschalter und Tab-Aktualisierung nach Updates prüfen. Bei fehlgeschlagener Prüfung externe Berechtigung, Netzwerk und angezeigten Grund beachten. CAPTCHA, Anmeldung, Begrenzung und Zeitüberschreitung führen zu Abbruch oder Enthaltung; sie werden nicht umgangen. Suchmaschinen können pausiert und Berechtigungen widerrufen werden. [Verwaltungsdetails](./MANAGEMENT.md).

## Umfang und Datenschutz

Die einzige derzeit positive Autoritätsrichtlinie deckt ausdrücklich genannte **Start-/Downloadadressen** im von Apache gepflegten Projektverzeichnis ab. Wikidata liefert nur Hinweise. Rang, HTTPS, Selbstaussage, Modellwert oder persönliche Auswahl beweisen allein keine offizielle Identität. Es gibt keine allgemeine Dokumentations-/Loginrichtlinie und keine Garantie für das ganze Web, Softwaresicherheit oder rechtliche Qualifikationen.

Unterstützt werden erkannte Desktop-Ansichten von Bing HTTPS `/search` (`www.bing.com`, `cn.bing.com`, `bing.com`) sowie `www.baidu.com/s` mit UTF-8-Websuche. Mobilansichten, Bilder/Nachrichten und versteckte/unbekannte Layouts liegen außerhalb des Umfangs. Auf Wunsch des Maintainers gehört die reguläre reale Online-Abnahme nicht zu dieser Stufenbedingung; kontrollierte Browsertests und historische Online-Beobachtungen werden getrennt ausgewiesen.

Keine Telemetrie, kein fernes Training, kein automatisches Hochladen von Feedback und kein vollständiger Suchverlauf. Ausdrückliche Labels und persönliche Datensätze bleiben lokal. Nach Freigabe können besuchte Seiten IP und angeforderte URL sehen; ergänzende Suche kann zugehörige Namen an Suchmaschinen senden. Die Nutzung ist daher weder vollständig offline noch im Netzwerk anonym. Alte Belege bleiben Cache; fehlgeschlagene Aktualisierung erneuert ihren Zeitpunkt nicht. Jede Navigationsaufgabe sammelt aktuelle Belege. [Datenschutz](./PRIVACY.md) · [Lernen](./LEARNING.md).

[Öffentliche Auswertung](./EVALUATION.md): Bei 36 manuell formulierten Anfragen mit echten Softwarenamen lag das bestehende trainierte Modell 25-mal richtig, enthielt sich 6-mal und löste bei 5 Informationssuchen fälschlich eine Navigation aus. In 24 synthetischen Vertrauensfällen entsprachen 23 dem erwarteten Zustand; keine der 3 Bestätigungen war falsch. Ein Dokumentationsfall blieb sicher unbestätigt und verfehlte das Funktionsziel. Das ist keine Stichprobe echter Nutzer und keine Genauigkeitsschätzung für das gesamte Web.

## Entwicklung und Lizenz

Node.js 24+ und pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate:release
pnpm build
```

Pakete benötigen zusätzlich Git, Python 3.9+, `pnpm release:prepare` und `pnpm release:verify`. ZIPs mit `SHA256SUMS` und `Get-FileHash -Algorithm SHA256 <Dateiname>` vergleichen. Übereinstimmende Prüfsummen garantieren keine Sicherheit.

Implementierung und Git-Verlauf sind unabhängig. Der autorisierte blaue Pro-Grafikableger des ursprünglichen NF/Pfeil-Motivs ist freigegeben. Originalcode und dieser Grafikableger stehen unter AGPL-3.0-only; Abhängigkeiten behalten ihre Lizenzen. [Grafikherkunft](./assets/brand/README.md) · [Abhängigkeiten](./DEPENDENCIES.md) · [LICENSE](./LICENSE) · [Versionshinweise](./RELEASE_NOTES.md) · [Mitwirken](./CONTRIBUTING.md).
