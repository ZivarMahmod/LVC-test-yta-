# LVC Media Hub — Ändringslogg

## v1.9.1 — 2026-03-30
- Coach Review-bubblor: spelare ser coach-kommentarer som 💬-ikoner direkt i action-listan
- Bekräfta reviews med lösenord — bubblan byts till ✅ och blir kvar för genomgång med tränare
- Toggle för att visa/dölja bekräftade reviews i footern
- Ladda upp och byt scout-fil (.dvw) direkt i videospelaren (admin/coach/uploader)
- Ladda ner scout-fil som admin (↓-knapp)
- Ändra motståndarnamn direkt i videospelaren (admin klickar på titeln)
- Titel och opponent uppdateras automatiskt på videokort
- Fritt motståndarnamn vid uppladdning — textfält med förslag från thumbnail-bibliotek
- DVW-kodsökning med Ctrl+Q — sök på rawCode och hoppa direkt till action
- Vinkel 2-funktionen borttagen
- Auto-knappen konsekvent storlek för alla roller

## v1.8.0 — 2026-03-29
- Coach Review System: coach kan skicka feedback på actions till spelare
- Draggbar review-panel i videospelaren med auto-matchning av spelare
- Inbox-sida med olästa/bekräftade reviews
- Coach-översikt med lagspelare och review-status
- Lösenordsbekräftelse vid acknowledge
- Badge i headern med oläst-antal (uppdateras var 60:e sekund)
- Navigering från inbox till specifik action i videon

## v1.7.0 — 2026-03-28
- Videokort redesign: overlay-stil med gradient-fade och hover-reveal text
- Horisontell listvy för videor (default på mobil)
- Lag-kort redesign: gradient-kort med thumbnail-stöd
- Thumbnail-uppladdning för videor (admin, 📷-knapp vid hover)
- Thumbnail-uppladdning för lag (admin, 📷-knapp vid hover)
- Gamla thumbnails raderas automatiskt vid ny uppladdning
- Volym sätts till 15% vid videoladdning
- Cache-busting på thumbnails
- Thumbnails sparas lokalt i Docker-volym (inte NAS)

## v1.6.0 — 2026-03-28
- Matchrapport i scout-panelen med lagjämförelse (poäng, serve, anfall, mottagning, försvar)
- Korrekt DVW-statistikberäkning (grade index 5, = som enda error)
- Serve: ace%, miss%, totalt, errors
- Anfall: kill%, blocked, errors
- Mottagning: positiv%, excellent%, errors
- Klickbar spelarstatistik i rapporten (expanderbar)
- Klickbara skill-sektioner → spelar upp actions med auto-hopp
- Admin-sidan mobiloptimerad (scrollbar tabeller, responsiva knappar)
- Tillbaka-knappen går nu en sida tillbaka istället för startsidan
- Rate limit höjd till 2000 för delade nätverk
- Buggfix: spelarfilter korrekt per lag vid samma tröjnummer

## v1.5.0 — 2026-03-27
- Login med användarnamn (eller e-post)
- Inbjudningssystem: admin skapar engångs-/flergångslänkar för registrering
- Registreringssida via inbjudningslänk med valbart antal användningar
- Användardropdown i headern med "Ändra lösenord" och "Logga ut"
- Backend: change-password endpoint
- Prisma schema: username-fält, InviteToken med maxUses/useCount
- Spelarfilter-buggfix: filtrerar nu korrekt per lag vid samma tröjnummer
- "Glömt lösenord? Kontakta admin" på login-sidan
- Kopierings-fallback för inbjudningslänkar (prompt vid HTTP)

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
