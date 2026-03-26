# LVC Media Hub — Ändringslogg

## v1.4.0 — 2026-03-26
- Mobilanpassning: responsiv layout med video överst och scout under
- Hamburger-meny på mobil (☰) istället för full header
- Ihopfällbara scout-filter på mobil (Visa/Dölj filter)
- Auto-action: toggle-knapp som automatiskt hoppar mellan filtrerade actions (5s delay)
- Autoplay vid klick på action — videon startar direkt
- Autoplay vid sidladdning + playsInline (ingen helskärm på mobil)
- Paus respekteras — auto-hopp stoppar om videon är pausad
- Skill-namn visas vid val (S=Serve, A=Anfall osv) + tooltip vid hover
- Videodetaljer borttagna — ersatt med kompakt titelrad ovanför videon
- Förbättrad desktop-header med mer luft och större logo

## v1.3.0 — 2026-03-25
- Lag/säsong-hierarki: startsida visar lag → säsonger → matcher
- Admin kan skapa och ta bort lag och säsonger
- Admin kan tilldela videos till lag/säsong
- Otilldelade videos visas direkt, tilldelade i kollapsbar sektion
- Breadcrumbs i navigering (Lag › LVC Dam › 25/26)
- Fix: dvwPath-bugg i folderScanner åtgärdad

## v1.2.0 — 2026-03-25
- Uppdaterad beskrivning på admin-sidan

## v1.1.0 — 2026-03-25
- Ändringslogg-flik i admin-panelen
- Migrerat till OptiPlex 3060
- NFS-streaming från TrueNAS
- Git versionshantering

## v1.0.0 — 2026-03-25
- Initial release
- Videostreaming med scout-panel
- Admin, uploader och viewer-roller
- Cloudflare Tunnel för HTTPS
