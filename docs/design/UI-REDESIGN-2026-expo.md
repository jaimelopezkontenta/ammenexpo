# Ammen (Expo / Firebase) — adaptación del rediseño 2026

El documento largo vive en el prototipo Vite (`C:\ammen/docs/design/UI-REDESIGN-2026.md`). Esa carpeta **no** es esta app.

Esta app: Expo + Supabase, español, paleta **Amanecer**, hosting `ammen-staging.web.app`.

## Qué se toma del doc

| Del doc Vite | Aquí |
|---|---|
| Control Sistema / Oscuro / Claro en Me | Perfil → Apariencia (`ThemeSwitcher`) |
| Persistencia `ammen.theme.v1` | Misma clave, AsyncStorage / localStorage |
| Sin flash de tema en web | Script en `app/+html.tsx` |
| `colorScheme.set()` | NativeWind, `darkMode: "class"` |
| Motion explica, reduced-motion de OS | Ya existía (`theme/motion.ts`) |
| Sesión como espacio | Las pantallas de día ya son stack, sin tab bar |

## Qué no se copia

- Paleta violeta / Inter / Fraunces. Aquí manda `prototipo/TOKENS.md` (crema, plum, ember, General Sans, Lora, Cormorant).
- Oscuro por defecto. Aquí el default es **Sistema**, para no romper las baselines de Playwright ni el anochecer 4.0.
- Today / Lists / Session / Me en inglés. Las pestañas son Hoy / Biblia / Orar / Juntos / Perfil.

## Hecho (2026-09-04)

- `theme/preference.ts` + `ThemeProvider`
- Toggle en Perfil
- Variables CSS: media query (Sistema) + `html.dark` / `html.light` (forzado)

## Hoy / Orar / Perfil (experiencia)

- **Hoy:** fecha local, saludo de madrugada, anillo de racha, caption Hoy/Continúa/Hecho, barra de días orados, «Amén. Hasta mañana.» al marcar, versículo también en móvil.
- **Orar:** si hay alguien pendiente, esa persona es el CTA («Siguiente» + «Orar ahora»); Nuevo plan pasa a secundario. Barra de progreso compartida.
- **Perfil:** Apariencia es una tarjeta propia; «Sesión iniciada · email» con live region.
