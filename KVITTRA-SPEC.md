# Kvittra — Teknisk Systemspecifikation

Se den fullständiga specen i konversationshistoriken. 
Detta är en sammanfattning för snabb referens.

## Arkitektur

```
kvittra.se          → Landningssida + /login (auth-portal)
[slug].kvittra.se   → Kundplattform per org (samma kodbas)
filipadmin.kvittra.se → Superadmin (hemlig)
```

## Byggordning

1. [x] Supabase-schema (tabeller, RLS, hjälpfunktioner)
2. [ ] Auth-flödet (login, OTP, session)
3. [ ] Org-routing (subdomän → rätt org-data)
4. [ ] Rollbaserad rendering (admin/coach/player/uploader/publik)
5. [ ] Spelarens dashboard (hero, stats, graf, jämförelse)
6. [ ] Coach/admin-panel (analysverktyg, filtrering, publicering)
7. [ ] Uploader-panel (upload video, DVW, koppla match)
8. [ ] Publik vy (publicerade matcher utan auth)
9. [ ] Features-systemet (toggle per org/global)
10. [ ] Superadmin (skapa org, branding, features)
11. [ ] Spelarjämförelse (split-view, radarchart)
12. [ ] UI-polish & animationer
13. [ ] Landningssida

## Roller

| Roll | Rättigheter |
|------|-------------|
| admin | Allt inom org |
| coach | Allt utom användarhantering och org-config |
| uploader | Upload video/DVW, grundläggande matchinfo |
| player | Personlig dashboard, alla matchvideor, all DVW-data |
| publik | Bara publicerade matcher, ingen auth |

## Viktiga principer

- DVW-matchdata är ALLTID öppen för alla inloggade inom org
- RLS är ALLTID på — ingen opt-out
- service_role ALDRIG i frontend
- Supabase-schemat heter `kvittra` (ej public)
- Feature-flags i DB — ingen deploy krävs för att slå på/av
