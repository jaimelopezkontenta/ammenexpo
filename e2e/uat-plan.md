# Plan UAT — Ammen (Web, Playwright)

## Estado actual

| Categoría | Specs existentes | Cobertura |
|---|---|---|
| Auth | `auth.spec.ts`, `baseline.spec.ts` | Login, logout, recuperar, returnTo, 2 contexts |
| Circulos | `circles-invite.spec.ts`, `circles-public.spec.ts` | Crear privado/público, invitar, buscar, unirse |
| Share | `share-loop.spec.ts`, `public-contract.spec.ts` | Share completo, preview anónimo, canje, intercesión idempotente |
| Invitar | `invitar.spec.ts` | Enlace → alta → onboarding → follow |
| Cuenta nueva | `fresh-account.spec.ts` | Alta sin invitación |
| Correo | `correo.spec.ts` | Preferencias, baja sin sesión |
| Inglés | `english.spec.ts` | Interfaz WEB, búsqueda, cambio versión |
| Moderación | `moderation.spec.ts` | Denuncias |
| Peticiones | `peticiones.spec.ts` | Petitions |
| Privacidad | `privacy-rights.spec.ts` | Derechos |
| Visual claro | `visual.spec.ts` | Baselines (2 pantallas × 2 resoluciones × ~30 pantallas) |
| Visual oscuro | `visual-dark.spec.ts` | Baselines dark |
| Visual onboarding | `visual-onboarding.spec.ts` | 4 pasos × 2 pantallas |
| Orar (nuevo) | `prayer-hub.spec.ts` | Crear plan, marcar día orado, día bloqueado |
| Biblia (nuevo) | `bible-tab.spec.ts` | Selector versión, búsqueda, tamaño fuente, navegación capítulos |
| **Total** | **23 specs** | **~76 tests funcionales + baselines visuales** |

## Qué FALTA para UAT completo

### A. Flujo de alta completo (no solo via invitación)
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Alta → onboarding → Hoy | Crear cuenta sin invitación, 4 pasos onboarding, aterriza en Hoy | Media | ✅ `fresh-account.spec.ts` |
| Onboarding con género neutro | Verifica flujo completo con género neutro | Baja | — |
| Onboarding con todos los topics | Verifica que todos los checkboxes funcionan | Baja | — |

### B. Flujo de oración (hub)
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Generar plan | Formulario → loading → plan generado → aterrizaje en Hoy | Media | ✅ `prayer-hub.spec.ts` |
| Plan generado aparece en Orar | Verifica que el plan nuevo aparece en la lista | Baja | ✅ `prayer-hub.spec.ts` |
| Marcar día como orado | Click en "Oré" → feedback visual → contador actualiza | Baja | ✅ `prayer-hub.spec.ts` |
| Día bloqueado no accesible | Día 2 no se puede orar si día 1 no está marcado | Media | ✅ `prayer-hub.spec.ts` |

### C. Biblia — pestaña Biblia
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Selector versión en pestaña Biblia | Cambiar RV→WEB desde pestaña (no solo lector) | Baja | ✅ `bible-tab.spec.ts` |
| A-/A+ del lector | Texto se hace más pequeño/grande | Baja | ✅ `bible-tab.spec.ts` |
| Navegación capítulos | Ir a capítulo siguiente/anterior | Baja | ✅ `bible-tab.spec.ts` |
| Búsqueda Biblia | Buscar texto → resultados → abrir versículo | Baja | ✅ `bible-tab.spec.ts` |

### D. Círculo — chat
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Enviar mensaje en chat | Escribir → enviar → aparece en conversación | Media | ✅ `circle-chat.spec.ts` |
| Mensaje aparece para otro miembro | Contexto B ve mensaje de A | Media | ✅ `circle-chat.spec.ts` |
| Chat no accesible desde fuera del círculo | Preview rechaza | Media | ✅ `circle-chat.spec.ts` |

### E. Comunidad
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Feed de comunidad | Ver planes públicos, testimonios | Baja | ✅ `community.spec.ts` |
| Ver perfil de otro usuario | Navegar a persona → ver planes públicos | Baja | ✅ `community.spec.ts` |
| Interceder desde comunidad | Click en intercesión desde feed | Media | — |

### F. Perfil
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Cambiar idioma → persiste | ES→EN → recargar → sigue en EN | Media | — |
| Modo oscuro → persiste | Toggle → recargar → sigue oscuro | Media | — |
| Exportar datos (web) | Botón export → descarga JSON | Baja | — |
| Aceptar términos | Verificar que aparecen términos actuales | Baja | — |

### G. Plus
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Correo de solo lectura | Campo no editable, muestra aviso | Baja | — |
| Cuota de planes | Contador visible, mensaje al llegar a tope | Media | — |

### H. Crisis
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Acceder a pantalla crisis | Botón → pantalla con recursos | Baja | — |
| Números de crisis visibles | España, US, México, Argentina, Alemania | Baja | — |

### I. Lector de Biblia
| Test | Qué verifica | Dificultad | Estado |
|---|---|---|---|
| Abrir versículo del día | Click → abre lector | Baja | — |
| Compartir versículo | Botón compartir → preview | Baja | — |
| Descargar imagen | html2canvas → descarga | Media | — |


### A. Flujo de alta completo (no solo via invitación)
| Test | Qué verifica | Dificultad |
|---|---|---|
| Alta → onboarding → Hoy | Crear cuenta sin invitación, 4 pasos onboarding, aterriza en Hoy | Media |
| Onboarding con género neutro | Verifica flujo completo con género neutro | Baja |
| Onboarding con todos los topics | Verifica que todos los checkboxes funcionan | Baja |

### B. Flujo de oración (hub)
| Test | Qué verifica | Dificultad |
|---|---|---|
| Generar plan | Formulario → loading → plan generado → aterrizaje en Hoy | Media |
| Plan generado aparece en Orar | Verifica que el plan nuevo aparece en la lista | Baja |
| Marcar día como orado | Click en "Oré" → feedback visual → contador actualiza | Baja |
| Día bloqueado no accesible | Día 2 no se puede orar si día 1 no está marcado | Media |

### C. Biblia — pestaña Biblia
| Test | Qué verifica | Dificultad |
|---|---|---|
| Selector versión en pestaña Biblia | Cambiar RV→WEB desde pestaña (no solo lector) | Baja |
| A-/A+ del lector | Texto se hace más pequeño/grande | Baja |
| Navegación capítulos | Ir a capítulo siguiente/anterior | Baja |
| Búsqueda Biblia | Buscar texto → resultados → abrir versículo | Baja |

### D. Círculo — chat
| Test | Qué verifica | Dificultad |
|---|---|---|
| Enviar mensaje en chat | Escribir → enviar → aparece en conversación | Media |
| Mensaje aparece para otro miembro | Contexto B ve mensaje de A | Media |
| Chat no accesible desde fuera del círculo | Preview rechaza | Media |

### E. Comunidad
| Test | Qué verifica | Dificultad |
|---|---|---|
| Feed de comunidad | Ver planes públicos, testimonios | Baja |
| Ver perfil de otro usuario | Navegar a persona → ver planes públicos | Baja |
| Interceder desde comunidad | Click en intercesión desde feed | Media |

### F. Perfil
| Test | Qué verifica | Dificultad |
|---|---|---|
| Cambiar idioma → persiste | ES→EN → recargar → sigue en EN | Media |
| Modo oscuro → persiste | Toggle → recargar → sigue oscuro | Media |
| Exportar datos (web) | Botón export → descarga JSON | Baja |
| Aceptar términos | Verificar que aparecen términos actuales | Baja |

### G. Plus
| Test | Qué verifica | Dificultad |
|---|---|---|
| Correo de solo lectura | Campo no editable, muestra aviso | Baja |
| Cuota de planes | Contador visible, mensaje al llegar a tope | Media |

### H. Crisis
| Test | Qué verifica | Dificultad |
|---|---|---|
| Acceder a pantalla crisis | Botón → pantalla con recursos | Baja |
| Números de crisis visibles | España, US, México, Argentina, Alemania | Baja |

### I. Lector de Biblia
| Test | Qué verifica | Dificultad |
|---|---|---|
| Abrir versículo del día | Click → abre lector | Baja |
| Compartir versículo | Botón compartir → preview | Baja |
| Descargar imagen | html2canvas → descarga | Media |

## Cómo ejecutar

### Prerrequisitos
```powershell
# 1. Supabase local
npm run db:start
# Esperar a que esté healthy

# 2. Ejecutar tests (auto-reset + seed)
npm run e2e

# Ver resultados
# playwright-report/index.html
```

### Opciones útiles
```powershell
# Solo tests funcionales (sin visual)
npm run e2e

# Solo visual (claro)
npm run e2e:visual

# Actualizar baselines visuales
npm run e2e:visual:update

# Con export estático (mismo que CI)
npm run e2e:static

# Un spec específico
npx playwright test e2e/auth.spec.ts

# Modo debug (abre UI interactiva)
npx playwright test --debug
```

## Plan de ejecución recomendado

### Fase 1 — Validar existente (día 1)
```powershell
npm run db:start
npm run e2e
```
Objetivo: que pasen los 17 specs actuales. Si fallan, arreglar antes de añadir.

### Fase 2 — Flujos críticos (día 2)
Crear specs para:
1. `auth.spec.ts` → Alta completa (ya existe `fresh-account` pero falta onboarding completo)
2. `prayer-hub.spec.ts` → Generar plan, orar, día bloqueado
3. `bible-tab.spec.ts` → Selector versión, A-/A+, búsqueda

### Fase 3 — Flujos secundarios (día 3)
4. `circle-chat.spec.ts` → Enviar/recibir mensaje
5. `community.spec.ts` → Feed, perfil, interceder
6. `profile.spec.ts` → Idioma, oscuro, export

### Fase 4 — Regresión visual (día 4)
7. `npm run e2e:visual:update` → regenerar baselines
8. `npm run e2e:visual` → validar que no hay diffs

### Fase 5 — Regresión completa (día 5)
```powershell
npm run verify
npm run e2e
npm run e2e:visual
```

## Criterios de aprobación

| Criterio | Estado actual | Objetivo |
|---|---|---|
| `npm run typecheck` | ✅ | ✅ |
| `npm run lint` | ✅ | ✅ |
| `npm run test` (unit) | ✅ 1358 tests | ✅ |
| `npm run e2e` (funcional) | ✅ (por verificar local) | ✅ todos passing |
| `npm run e2e:visual` | Baselines commiteadas | ✅ sin diffs |
| `npm run db:test` | 15 suites SQL | ✅ |
| Cobertura nueva | 17 specs | 25+ specs |

## Notas técnicas

- **Supabase local**: `npm run db:start` → Postgres en `127.0.0.1:5432`, Auth en `127.0.0.1:54421`
- **Seed**: `supabase/seed.sql` → `prueba@ammen.local` / `zoe@ammen.local` (password: `ammen1234`)
- **Reset automático**: `globalSetup.ts` hace `db reset` + healthcheck + verify seed antes de cada run
- **Lock de DB**: `db-lock-cli.mjs` evita que Playwright y `db:test` peleen
- **Solo Chromium**: Webkit/Firefox no probados contra este stack
- **Sin reintentos**: `retries: 0` — cada fallo es real
