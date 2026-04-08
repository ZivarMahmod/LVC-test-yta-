# Testdata

Den här mappen innehåller exempelfiler för att testa plattformen.

## Filer

- `sample-match.dvw` — DVW scout-fil med 2 set matchdata (LVC vs Hylte/Halmstad)
  - 6 spelare per lag med svenska namn
  - Serve, mottagning, angrepp, block, försvar
  - Poängställning per rally
  - Cirka 100 aktioner

## Hur du testar

### 1. Logga in som admin
Gå till `http://<din-ip>:3001` och logga in med admin-kontot.

### 2. Skapa lag och säsong
- Klicka **Admin** i menyn
- Under "Lag & Säsonger":
  - Skapa lag: `LVC Linköping`
  - Skapa säsong: `2025/2026` (kopplad till laget)

### 3. Ladda upp en match
- Klicka **Ladda upp** i menyn
- Välj lag och säsong
- Motståndare: `Hylte/Halmstad`
- Datum: valfritt
- Video: ladda upp valfri `.mp4`-fil (kan vara kort, bara för test)
- DVW-fil: ladda upp `sample-match.dvw` från den här mappen

### 4. Se resultatet
- Klicka på matchen → se scout-data, heatmap, scoreboard
- Gå till **Spelare** → se lagöversikt med alla spelares stats
- Klicka på en spelare → se full dashboard med 7 flikar
- Gå till **Analys** → välj matchen → flermatchsvy

### Tips
- Du behöver inte en riktig matchvideo — vilken .mp4 som helst funkar
- DVW-filen innehåller all statistik, videon är bara för uppspelning
- Ladda upp fler matcher (med samma DVW-fil men ändra motståndare) för att se trender
