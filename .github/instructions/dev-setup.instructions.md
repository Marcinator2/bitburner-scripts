---
applyTo: "**"
---

# Dev Setup – Bitburner 3

## API Server / Filesync starten

In Bitburner **3.x** verbindet sich das **Spiel** zum Server (nicht umgekehrt).

### Schritt 1: filesync-Server starten

Der VS Code Task `bitburner-filesync` startet automatisch beim Öffnen des Ordners.
Manuell: **Terminal → Run Task → bitburner-filesync** oder:

```bash
npx bitburner-filesync
```

Der Server lauscht auf Port **12525** (konfiguriert in `filesync.json`).

### Schritt 2: Im Spiel verbinden

**Options → Remote API** → Port `12525` eintragen → Verbindung wird automatisch hergestellt.

> In älteren Versionen (< 3.0) war es umgekehrt: Das Spiel hostete den Server, filesync verband sich. In 3.0 hostet filesync den WebSocket-Server.
