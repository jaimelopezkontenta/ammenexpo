# Auditoría integral de Ammen — agosto de 2026

> Auditoría estática del **working tree actual**. Destinatario: fundador de Ammen.
> No es una certificación de seguridad, una revisión legal ni un plan de implementación.

## 1. Veredicto ejecutivo

> **Estado de seguridad/readiness: REJECT — NO APROBADA PARA LANZAMIENTO.** Este
> documento reporta los bloqueantes; no certifica que estén resueltos ni autoriza una
> beta con usuarios no confiables, producción pública o cobro.

**Veredicto:** Ammen tiene un núcleo de producto coherente y una base técnica muy por
encima de la media de un MVP: el plan diario, compartir, orar por otra persona y
devolver la señal «alguien oró por ti» existen de extremo a extremo en código y datos.
La adquisición por enlaces conserva y canjea el contexto, el acceso sensible se lleva a
Postgres y hay atención real a errores, privacidad, zona horaria y accesibilidad.

La superficie, sin embargo, se adelantó a la operación. **Es candidata a beta privada,
instrumentada y con participantes de confianza; no está lista para lanzamiento público
ni monetizado.** Antes de admitir usuarios no confiables hay que cerrar una escalada de
privilegio de moderación observable en las migraciones. Antes de lanzamiento público,
además, hacen falta una respuesta de crisis y liberación de retenidos, validar la
semántica `public`/Orar, alinear auth real, cerrar el retorno con push y establecer
CI, observabilidad y E2E.

El problema no es que «falte producto». Es que ya existe suficiente producto como para
generar datos sensibles, abuso, estados cruzados y expectativas operativas que hoy no
tienen una red de seguridad proporcional.

### Decisión recomendada

- **Beta privada:** **sí, con compuerta**; primero corregir el privilegio `is_staff`,
  usar cohortes pequeñas y medir el loop completo.
- **Lanzamiento público:** **no todavía**.
- **Cobro:** **no todavía**; la pantalla Plus acierta al no fingir una compra.
- **Expansión de features:** congelarla hasta demostrar `share → Orar → oración → aviso
  → retorno` y cerrar safety/operación.

## 2. Método, alcance y lenguaje de certeza

- **[H] Hecho:** observable directamente en el working tree.
- **[I] Inferencia:** conclusión razonable aún no demostrada en runtime; siempre se
  indica cómo falsarla.
- **[R] Riesgo:** daño potencial, no afirmación de que ya haya ocurrido.
- Escala: **0 inexistente · 1 frágil · 2 parcial · 3 sólido con gaps · 4 listo y probado**.
- Los **blockers no se promedian**: una media aceptable no abre la compuerta si queda un
  riesgo crítico.

Se revisaron rutas Expo/React Native, lógica bajo `core/`, migraciones y suites SQL de
Supabase, Edge Function de generación, configuración y scripts. Se consideraron también
los cambios no commiteados porque el objeto de auditoría es el working tree, sin
alterarlos.

**No se ejecutaron** la app en dispositivo/simulador, pruebas UI/E2E, un pentest,
Supabase remoto ni dashboards de tiendas; tampoco se consultaron métricas reales,
entregabilidad de correo/push, logs de producción o configuración remota. Por tanto, la
auditoría prueba existencia y coherencia estática, no comportamiento real ni despliegue.

## 3. Compuerta de salida: blockers

| ID | Bloqueante | Severidad | Etiqueta | Compuerta afectada |
|---|---|---:|---:|---|
| B0 | Un usuario autenticado puede, según la cadena de GRANT/RLS del repositorio, actualizar su propia columna `profiles.is_staff` y después leer/resolver la cola global de reportes | **Crítica** | [H][R] | Beta no confiable y producción |
| B1a | Un post/comentario con `held_at` no tiene operación visible de liberación ni cola automática; puede quedar retenido indefinidamente | **Alta** | [H][R] | Público |
| B1b | Las frases de autolesión se retienen sin recursos de crisis, escalado ni protocolo específico | **Crítica** | [H][R] | Público |
| B2 | La relación entre `visibility='public'`, `plans_shared_with_me()` y `/orar/[planId]` no está fijada por una prueba dirigida | **Alta** | **[I][R]** | Público |
| B3 | Configuración auth local y expectativas del cliente no representan una única política verificada de producción | **Alta** | [H][R] | Público |
| B4 | El loop social no puede traer de vuelta a quien no tiene la app abierta: hay avisos internos, pero no transporte push | **Alta** | [H][R] | Público/retención |
| B5 | Sin CI, observabilidad cliente ni E2E/UI no hay señal fiable para desplegar o detectar regresiones del recorrido crítico | **Alta** | [H][R] | Público |

**Regla:** B0 debe cerrarse antes de ampliar una beta fuera de un grupo plenamente
confiable. B1a, B1b y B2–B5 deben cerrarse antes de declarar readiness público. Pagos y refactors
grandes quedan fuera de esta compuerta.

## 4. Mapa del flow de usuario

```text
Descubrimiento
  ├─ enlace público de plan /p/[token]
  ├─ invitación /i/[code]
  └─ círculo /c/[token]
          │
          ▼
Preview público sin sesión
  ├─ token + fuente persisten en AsyncStorage
  ├─ link muerto distingue red de expiración/revocación
  └─ CTA crear cuenta / entrar
          │
          ▼
Auth
  ├─ alta / login
  ├─ recuperación / nueva contraseña
  └─ canje idempotente del token al existir sesión
          │
          ▼
Términos versionados → onboarding → app
          │
          ▼
5 tabs
  ├─ Hoy: plan activo, día desbloqueado, oración, racha, quién oró
  ├─ Biblia: lectura, búsqueda, marcas/notas, versículo
  ├─ Orar: planes compartidos → día de otra persona → «Oré por ti»
  ├─ Círculos: membresía, plan común, chat, actividad
  └─ Perfil: identidad, preferencias, legal, exportar/borrar, moderación
          │
          ▼
Loop social
  compartir → receptor canjea → aparece en Orar → ora → trigger crea aviso
  → dueño ve badge/lista interna → [falta push para retorno fuera de sesión]
```

Rutas ancla: `app/(public)/p/[token].tsx`, `core/auth/pendingToken.ts`,
`core/auth/AuthGate.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/orar.tsx`,
`app/orar/[planId].tsx`, `app/avisos.tsx` y
`supabase/migrations/20260730100300_social.sql`.

### Lectura del funnel

1. **[H] Adquisición con memoria.** El preview guarda token y fuente antes del alta;
   `SessionProvider` intenta canjearlos en cualquier login, no solo en onboarding.
2. **[H] Entrada ordenada.** `AuthGate` exime lo público, resuelve sesión, exige términos
   antes de onboarding y ofrece reintento/salida si falla la lectura del perfil.
3. **[H] Valor individual.** Hay generación diaria, días bloqueados por fecha del dueño,
   Biblia real, lista de oración, progreso y recuperación de generación estancada.
4. **[H] Valor social dentro de la app.** Orar crea una intercesión idempotente y un
   trigger crea el aviso deduplicado para el dueño.
5. **[R] Ruptura de retorno.** Sin push, el dueño debe volver por iniciativa propia;
   el badge interno consulta cada 60 segundos, por lo que no cumple la promesa completa
   «cuando alguien ora por ti, te enteras» fuera de una sesión activa.

## 5. Scorecard 0–4

| Dimensión | Score | Anclas observables | Lectura |
|---|---:|---|---|
| Flow | **3** | `AuthGate`, links públicos, recuperación, cinco tabs, avisos | Coherente y con edge cases; retorno externo sin cerrar |
| Lógica de producto | **3** | plan diario, canje, intercesiones, zonas, Biblia, límites | Núcleo claro; algunos finales/alcances no validados |
| Arquitectura y datos | **3** | `core/<dominio>`, React Query, RLS, RPC, grants, migraciones | Diseño fuerte; B0 impide llamarlo seguro para producción |
| Calidad de código | **3** | TS strict, 10 archivos de test TS, 9 suites SQL, `verify` | Buena disciplina; sin UI/E2E/CI y pantallas grandes |
| Producción | **1** | no `.github/`, no `eas.json`, sin SDK de push/telemetría | Operación, safety e instrumentación aún insuficientes |

La media aritmética sería **2,6/4**, pero **no es el veredicto**: B0–B5 mandan sobre
la media.

## 6. Fortalezas demostrables

### F1. El núcleo no es una maqueta

- **[H] Evidencia.** Planes, círculos, chat, Biblia, lista, peticiones, comunidad,
  testimonios, moderación, avisos y perfil tienen pantallas, consultas y esquema. La raíz
  monta `QueryClientProvider`, `SessionProvider` y `AuthGate` en `app/_layout.tsx`.
- **Matiz.** Amplitud no equivale a adopción ni calidad runtime; unas cuarenta pantallas
  multiplican estados y regresiones.
- **Prueba de cierre.** Un smoke E2E en iOS y Android debe recorrer alta, plan, share,
  canje, Orar, oración y aviso, guardando artefactos de cada build.

### F2. El loop social está modelado de extremo a extremo

- **[H] Evidencia.** `core/intercessions/queries.ts` inserta la intercesión, trata
  `23505` explícitamente e invalida Orar; `notify_on_intercession()` crea una notificación
  con índice de deduplicación; `app/avisos.tsx` la muestra y marca leída.
- **Contraevidencia.** La notificación es solo interna. `expo_push_token` y
  `push_sent_at` existen, pero no hay `expo-notifications`, registro de dispositivo ni
  sender/worker en el repositorio.
- **Prueba de cierre.** Dos cuentas y dos dispositivos: A comparte, B canjea y ora, A
  recibe push una sola vez, toca y llega al contexto correcto; medir entrega y apertura.

### F3. Privacidad por diseño en datos sensibles

- **[H] Evidencia.** `profiles` y `profile_settings` separan identidad visible de
  onboarding/token; los días futuros se cierran en RLS; `prayer_body`, `daily_action` e
  `interpretation` quedan fuera de superficies compartidas; el preview anónimo usa una
  RPC estrecha. `20260730100400_grants.sql` concede por verbo y varias migraciones
  endurecen por columna/RPC.
- **Contraevidencia.** El patrón general es bueno, pero B0 demuestra que añadir una
  columna privilegiada a una tabla con `UPDATE` de tabla entera puede romperlo.
- **Prueba de cierre.** Tests negativos por cada columna sensible y cada RPC
  `SECURITY DEFINER`, ejecutados como `anon`, usuario propio, extraño y staff.

### F4. IA con una barrera bíblica concreta

- **[H] Evidencia.** El modelo solo propone referencias; `scripture.ts` las resuelve
  contra RVR1909. `generate-prayer-plan/index.ts` repara una vez y, si no resuelve,
  publica el día sin versículo en vez de inventarlo.
- **Matiz.** Esto evita citas fabricadas, no garantiza que interpretación, consejo o
  tono sean pastoralmente apropiados ni seguros en crisis.
- **Prueba de cierre.** Corpus adversarial con referencias inexistentes, duelo,
  violencia y autolesión; revisión humana de outputs y aserción de cero texto bíblico
  no procedente de la tabla.

### F5. Manejo de fallos con intención

- **[H] Evidencia.** Hay ramas para links muertos versus red, recuperación con sesión,
  onboarding ausente/fallido, generación atascada, escrituras de cero filas y duplicados
  `23505`. El cache se limpia cuando cambia el usuario en `SessionProvider`.
- **Matiz.** React Query depende de muchas invalidaciones manuales y polling; el propio
  código documenta que no refresca al enfocar. Es fácil omitir una key al crecer.
- **Prueba de cierre.** Matriz de navegación con pérdida de red, background/foreground,
  cambio de cuenta y mutaciones desde un segundo dispositivo.

### F6. Calidad interna y explicabilidad

- **[H] Evidencia.** `tsconfig.json` activa `strict`; hay 10 archivos `*.test.ts` en el
  working tree y 9 suites SQL (`rls`, `flows`, `streak`, `timezone`, `bible`, `circles`,
  `plans`, `storage`, `social`). Los comentarios suelen explicar el porqué, no repetir el
  código, y hay uso extendido de roles/labels/estados de accesibilidad.
- **Matiz.** El volumen de tests puros/SQL no cubre render, navegación, permisos nativos,
  deep links ni integración con un backend remoto.
- **Prueba de cierre.** CI reproducible que ejecute `npm run verify` y E2E mínimo sobre
  build de release; hoy `verify` existe como gate, pero no se ejecutó en esta auditoría.

## 7. Gaps y riesgos materiales

### G0. Escalada de privilegio de staff — crítica

- **Severidad/certidumbre:** **CRÍTICA · [H][R] · blocker B0**.
- **[H] Hallazgo.** `20260730100400_grants.sql` concede `select, update` sobre toda
  `public.profiles` a `authenticated`; la policy deja actualizar la fila propia.
  `20260814100000_report_queue.sql` añade después `is_staff` a esa tabla sin revocar el
  grant ni limitar columnas. `is_staff()` confía en ese bit y habilita RPCs
  `SECURITY DEFINER` que devuelven contenido reportado, oculto y retenido y permiten
  resolver reportes.
- **[R] Impacto.** En el esquema construido por estas migraciones, un usuario podría
  marcar su propia fila como staff y acceder a la cola global. El mismo grant permite
  alterar `streak_count`/`streak_last_day`, un problema menor de integridad.
- **Contraevidencia/matiz.** No hay UI para hacerlo y el comentario dice que el bit se
  fija a mano; eso no protege la API. No se inspeccionó el remoto: un grant manual allí
  podría diferir, pero las migraciones reproducibles no lo reflejan.
- **Recomendación.** Revocar el update de tabla completa y conceder solo columnas
  editables (`display_name`, `avatar_url`); mantener staff/racha fuera del rol cliente.
- **Prueba de cierre.** Como usuario normal, `UPDATE profiles SET is_staff=true` y la
  alteración de racha deben fallar, mientras `report_queue()` devuelve cero filas; una
  cuenta nombrada staff por el canal administrativo sí debe poder moderar.

### G1a. `held_at` puede ser permanente — alta

- **Severidad/certidumbre:** **ALTA · [H][R] · blocker B1a**.
- **[H] Hallazgo.** `20260813100100_content_hold.sql` marca `held_at` en posts y
  comentarios por una lista de términos y los oculta a terceros. El autor ve «en
  revisión». No se encontró RPC, mutación o acción UI que limpie `held_at`; tampoco una
  cola automática específica de retenidos.
- **[R] Impacto.** Falsos positivos pueden quedar retenidos indefinidamente. La promesa
  legal de revisión en 24 h exige capacidad y guardia reales.
- **Contraevidencia.** Sí existen reportar, bloquear, ocultar, staff, cola de reportes y
  estados reviewed/dismissed; el autor no es engañado sobre el hold. Esa cola recibe
  reportes, no constituye por sí sola una bandeja completa de retenidos.
- **Recomendación.** Crear ciclo explícito hold→cola→liberar/retirar, con responsable,
  motivo, marca temporal y registro de decisión.
- **Prueba de cierre.** Un contenido benigno retenido aparece automáticamente al staff,
  puede liberarse y vuelve a ser visible; uno objetable se retira. Ambos caminos quedan
  auditados y se ensayan contra el SLA.

### G1b. Autolesión sin protocolo de crisis — crítica

- **Severidad/certidumbre:** **CRÍTICA · [H][R] · blocker B1b**.
- **[H] Hallazgo.** La lista de `is_objectionable()` incluye frases de suicidio y las
  retiene, pero no se encontró respuesta diferenciada, recursos inmediatos, escalado ni
  protocolo operativo de crisis.
- **[R] Impacto.** Una persona vulnerable recibe una señal editorial («en revisión»), no
  ayuda específica; una actuación improvisada también puede dañar su privacidad.
- **Contraevidencia.** Los términos recomiendan buscar ayuda profesional de forma
  genérica, y retener evita publicar el contenido a terceros. No equivale a intervención.
- **Recomendación.** Definir con especialista un protocolo por país/edad, recursos
  inmediatos y límites claros de privacidad/escalado; no reutilizar moderación común.
- **Prueba de cierre.** Casos de crisis en ES/EN muestran recursos correctos sin publicar
  el texto; simulacro humano verifica tiempos, privacidad, trazabilidad y fallback.

### G2. Semántica `public`/Orar no cerrada — hallazgo disputado

- **Severidad/certidumbre:** **ALTA · [I][R] · blocker B2; no es un bug probado**.
- **[I] Hipótesis a verificar, no bug probado.** La policy de
  `20260810100100_no_more_friends.sql` hace legible todo plan `public` a autenticados;
  `plans_shared_with_me()` en `20260802100100_circle_chat.sql` es `SECURITY INVOKER`, no
  filtra explícitamente por `plan_shares` y confía en RLS. Esto sugiere que planes
  públicos podrían entrar en Orar, pero las lecturas previas fueron contradictorias y no
  se ejecutó el esquema.
- **Contraevidencia.** `supabase/tests/plans.sql` prueba que un extraño puede abrir un
  plan público y que días futuros/oración privada siguen cerrados. `flows.sql` y
  `streak.sql` prueban que un link canjeado aparece en `plans_shared_with_me()`, pero no
  contienen el caso dirigido de un plan público no compartido.
- **Recomendación.** Decidir si `public` significa descubrible o asignado para orar y
  expresar una sola regla consistente en RPC, Orar y ruta de detalle; no corregir antes
  de observar cuál de los comportamientos ocurre realmente.
- **Condición de falsación / prueba de cierre P0.** Crear dueño A y extraño B, un plan
  `public` activo con día actual y **sin** `plan_shares`; como B comprobar por separado:
  1) si aparece en `plans_shared_with_me()`/tab Orar; 2) si no aparece; 3) si abrir
  `/orar/[planId]` funciona o devuelve «ya no está». Fijar el comportamiento deseado con
  una assertion SQL y un test de ruta. Las tres superficies deben concordar.

### G3. Auth local, cliente y remoto pueden divergir

- **Severidad/certidumbre:** **ALTA · [H][R] · blocker B3**.
- **[H] Hallazgo.** `supabase/config.toml` —configuración **local**, no evidencia del
  dashboard de producción— permite contraseña mínima 6 y desactiva confirmación de
  email. `core/auth/validation.ts` exige 8. `app/(auth)/crear-cuenta.tsx` soporta ambos resultados,
  pero su comentario de la rama sin sesión afirma que la confirmación está activa.
- **[R] Impacto.** Tests locales pueden validar un recorrido distinto del real; un
  cliente alternativo podría crear claves de 6 caracteres donde esa config aplique.
- **Contraevidencia.** El cliente es más estricto, y la rama de alta maneja tanto sesión
  inmediata como confirmación. No se puede afirmar cuál es la configuración remota.
- **Recomendación.** Exportar/registrar la configuración efectiva remota y alinear local,
  cliente y producción en mínimo de 8 y una decisión explícita sobre confirmación.
- **Prueba de cierre.** Alta con 6 debe rechazarse por servidor; alta con 8, confirmación
  elegida, login y recovery deben pasar en build release con SMTP real.

### G4. Push e instrumentación no existen aún

- **[H] Hallazgo.** Hay campos `expo_push_token`, `push_sent_at`, índice de pendientes,
  horas de recordatorio y avisos internos; no hay dependencia `expo-notifications`,
  permiso/plugin, registro de token, sender, reintentos ni métricas de entrega.
- **[R] Impacto.** La propuesta social no cierra retención y no se puede saber dónde cae
  el funnel. `signup_source` preserva atribución inicial, pero no sustituye eventos.
- **Contraevidencia.** La base anticipa deduplicación y estado de envío; el badge interno
  hace visible el valor al volver y Plus no promete push.
- **Prueba de cierre.** Métricas con denominadores: preview→alta, alta→canje,
  canje→primera oración, oración→push entregado, push→apertura y D1/D7 por fuente.

### G5. Verificación pre-lanzamiento insuficiente

- **[H] Hallazgo.** No hay workflows bajo `.github/`, ni `eas.json`, SDK de errores o
  analítica de cliente, ni tests E2E/UI. `package.json` sí define `verify` como
  typecheck→lint→Vitest→9 suites SQL.
- **[R] Impacto.** Un gate manual puede omitirse; fallos en deep links, navegación,
  permisos, background o dispositivos llegan sin señal y no hay trazas de producción.
- **Contraevidencia.** La lógica pura y SQL tienen cobertura inusualmente buena; RLS,
  zonas, rachas, storage y flows cuentan con suites específicas.
- **Prueba de cierre.** Branch protection con `verify`, build release por plataforma,
  E2E del happy path y fallos críticos, error reporting con release/sourcemaps y alertas
  de generación, auth, canje y push.

### G6. Ciclos de vida y amplitud de frontend

- **[H] Hallazgo.** El fin de plan se deriva por días escritos/fecha local, no por haber
  cumplido todos los días (`20260803100000_plan_progress.sql`). La base permite borrar y
  tiene estados `completed`/`archived`, pero no se encontró acción visible para
  borrar/archivar un plan. No hay estado final equivalente claramente visible para el
  plan de círculo. Hay pantallas grandes y muchas invalidaciones manuales/polling.
- **[I] Riesgo falsable.** Redirigir a `/` después de canjear `/p/[token]` puede añadir
  fricción porque no lleva al plan recién canjeado; no es bug si pruebas muestran que Hoy
  orienta mejor y Orar se descubre.
- **Contraevidencia.** Derivar fin evita cron/flags olvidadas y exige que se hayan escrito
  todos los días; la generación parcial tiene recuperación. La base soporta eliminación
  y el límite Plus se comunica con honestidad.
- **Prueba de cierre.** Tests runtime al cruzar medianoche y zona horaria, completar con
  días omitidos, cambiar plan activo, terminar círculo y canjear un link mid-session;
  decidir con datos destino post-canje y política de archivo/borrado.

### G7. Deuda menor pero reveladora

- **[H] Hallazgo.** README manda ejecutar `npm run dev`, script inexistente, y habla de
  ocho suites aunque `db:test` encadena nueve. Hay constantes/compatibilidad legacy
  menores y documentación que puede quedar detrás del código.
- **Matiz.** No bloquea producto ni seguridad; sí eleva tiempo de onboarding y resta
  confianza en el runbook.
- **Prueba de cierre.** Onboarding técnico desde clon limpio siguiendo solo README y
  comprobación automática de comandos documentados.

## 8. Seguridad, privacidad y trust & safety: opinión consolidada

**Lo bueno:** RLS está presente en las superficies revisadas; los GRANT se tratan como
capa independiente; existen RPC estrechas, tests negativos, bloqueo transversal,
reportes, cola staff, ocultación, exportación y borrado de cuenta. Los términos están
versionados y se piden antes de recoger onboarding sensible. El texto bíblico no lo
inventa el modelo.

**Lo decisivo:** B0 impide calificar hoy el backend como «grado producción». Es un fallo
localizado y barato de corregir, pero de alto impacto: la arquitectura correcta no
compensa un atributo privilegiado mutable por su dueño. B1a y B1b evidencian el segundo
salto: moderación técnica no equivale a operación de safety. Hace falta ciclo de
liberación/retirada, SLA, recursos de crisis y responsable humano.

**Secretos:** [H] el verificador estático no detectó secretos expuestos en el working
tree. Es favorable, pero no compensa ninguno de los blockers.

**Límites de esta conclusión:** no hubo pentest, análisis de dependencias, revisión del
historial Git, fuzzing de RPC, prueba de abuso/rate limit ni comparación con grants del
remoto. La ausencia de evidencia dinámica no es evidencia de ausencia de fallos.

## 9. Matriz impacto / esfuerzo / confianza

| Prioridad | Acción de cierre | Impacto | Esfuerzo | Confianza | Evidencia de salida |
|---:|---|---|---|---:|---|
| P0 | Restringir columnas actualizables de `profiles` y test anti-auto-staff | Crítico | Bajo | Alta | usuario normal no altera staff/racha ni ve cola |
| P0 | Test dirigido `public`→Orar→`/orar/[planId]` y decisión de producto | Alto | Bajo | Media | SQL + ruta concuerdan |
| P0 | Flujo `held_at`→cola→liberar/retirar | Alto | Medio | Alta | ambos caminos auditados y dentro del SLA |
| P0 | Protocolo de autolesión y recursos localizados | Crítico | Medio | Alta | simulacro humano de crisis y privacidad |
| P0 | Verificar/alinear auth local y remoto | Alto | Bajo | Alta | matriz alta/confirm/recovery en release |
| P0 | Push del evento de intercesión con deep link y métricas | Muy alto | Medio | Alta | entrega/apertura medidas end-to-end |
| P1 | CI obligatorio + observabilidad + E2E crítico | Alto | Medio | Alta | build bloqueado ante regresión |
| P1 | Instrumentar funnel y cohortes D1/D7 | Alto | Medio | Alta | dashboard con denominadores |
| P2 | Definir archivo/borrado/final de planes y círculos | Medio | Medio | Media | estados y UX probados en tiempo/zona |
| P2 | Reducir pantallas grandes/invalidation manual | Medio | Alto | Media | solo tras datos de fallos/performance |
| P3 | Pagos/webhook/store compliance | Medio ahora | Alto | Alta | después de demostrar retención |

## 10. Roadmap de dos fases

### Fase 1 — Compuerta para una beta privada instrumentada

Objetivo: demostrar el loop con una cohorte pequeña sin aceptar riesgos operativos
evitables.

1. Cerrar B0 y añadir regresión de privilegios.
2. Resolver con test la semántica `public`/Orar y el destino post-canje.
3. Alinear auth efectivo y probar deep links/recovery en builds release.
4. Implementar push de intercesión y eventos del funnel; no recordatorios genéricos
   todavía.
5. Habilitar error reporting, CI y un E2E del loop crítico.
6. Operar una cohorte de confianza con revisión diaria de errores, holds y reportes.

**Salida:** cero autoescalada; loop completo medido; fallos trazables; comportamiento
`public` inequívoco; auth reproducible; respuesta humana definida.

### Fase 2 — Preparación para público, sin pagos aún

Objetivo: soportar usuarios no conocidos y revisión de tienda.

1. Completar hold→revisión→liberación/retirada y respuesta de autolesión localizada.
2. Formalizar SLA, roles de staff, auditabilidad y revisión legal de términos/privacidad.
3. Ampliar E2E a bloqueo, reportes, exportar/borrar, zonas horarias y background.
4. Validar accesibilidad y rendimiento en dispositivos reales; cerrar ciclos de plan y
   círculo según evidencia.
5. Abrir gradualmente con feature flags/cohortes y criterios de rollback.

**Salida:** solo entonces decidir lanzamiento público. **Pagos después** de observar
retención y coste de generación; refactor de pantallas solo donde telemetría o defectos
lo justifiquen.

## 11. Preguntas abiertas para fundador/equipo

1. ¿Un plan `public` debe ser descubrible en Comunidad solamente, o también convertirse automáticamente en una responsabilidad en Orar para cualquier usuario?
2. Tras canjear un enlace, ¿la promesa es «entra a Ammen» o «ora ahora por esta persona»?
3. ¿Quién revisará reportes y holds, en qué horario y con qué SLA realista?
4. ¿En qué países/edades se lanzará primero? La respuesta cambia recursos de crisis, consentimiento y texto legal.
5. ¿Cuál es la política ante contenido de crisis: privado, visible, retenido, escalado o combinado? ¿Qué datos se pueden usar sin romper confianza?
6. ¿La racha mide oración propia, ayuda a otros o ambas? ¿Qué comportamiento se desea al cambiar de zona horaria o perder días?
7. ¿Un plan termina por calendario, por cumplimiento o por elección? ¿Qué debe pasar con planes/círculos acabados y con shares existentes?
8. ¿Qué configuración exacta tiene Supabase remoto: confirmación, password, SMTP, rate limits, región, backups, PITR y grants efectivos?
9. ¿Qué umbrales de beta habilitan público: activación, primer share, primera oración, push abierto, D1/D7, tasa de reporte y tiempo de resolución?
10. ¿Quién tiene autoridad para nombrar staff y cómo queda registrado/revocado?

## 12. Consejo pleno, una línea por voz

- **Qwen:** beta cerrada sí, producción monetizada no; push, safety y CI antes de pagos, y considera que el temor sobre `public` puede estar sobredimensionado.
- **DeepSeek:** ve backend/seguridad maduros frente a producto/distribución, sospecha una grieta `public`→Orar y prioriza moderación/crisis; B0 obliga a rebajar hoy la primera parte hasta corregir grants.
- **Gemini:** no producción; estima cercanía a MVP si se cierran push y compliance ético, sin que esta auditoría valide su plazo de 2–3 semanas.
- **Sol:** beta privada instrumentada, núcleo coherente; verificar alcance público y cerrar safety, auth, push, CI y E2E antes de pagos.
- **Grok:** backend fuerte y frontend demasiado amplio; cerrar `share→orar→aviso` y congelar expansión.
- **Kimi:** la estructura interna puede envejecer bien, pero operación/experiencia no sin safety, push, auth y CI; no da por roto `public`.
- **Síntesis del juez ciego:** un único veredicto H/I/R, blockers como compuerta, contraevidencia y prueba de cierre; este documento adopta ese criterio.

## 13. Apéndice de evidencia
| Área | Rutas principales |
|---|---|
| Stack/config | `package.json`, `app.json`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx` |
| Entrada/auth | `core/auth/AuthGate.tsx`, `core/auth/SessionProvider.tsx`, `core/auth/pendingToken.ts`, `app/(public)/p/[token].tsx` |
| Producto | `core/plans/queries.ts`, `core/intercessions/queries.ts`, `core/notifications/queries.ts`, `app/avisos.tsx` |
| Tiempo/IA | `20260803100000_plan_progress.sql`, `20260731120000_local_day_boundaries.sql`, `supabase/functions/generate-prayer-plan/{index.ts,scripture.ts,schema.ts}` |
| Datos/GRANT | `20260730100000_core.sql`, `20260730100400_grants.sql`, `20260814100000_report_queue.sql` |
| Safety/legal | `20260813100100_content_hold.sql`, `app/moderacion.tsx`, `core/moderation/queue.ts`, `core/legal/documents.ts` |
| Derechos | `20260814100100_export_my_data.sql`, `20260801170000_delete_account.sql` |
| Auth local | `supabase/config.toml` |
| `public` | `20260810100100_no_more_friends.sql`, `20260802100100_circle_chat.sql`, `supabase/tests/{plans,flows,streak}.sql`, `app/(tabs)/orar.tsx`, `app/orar/[planId].tsx` |

## 14. Comandos y verificaciones de esta auditoría
Ejecutado:

```text
git status --short
git diff --check -- docs/auditoria-ammen-2026-08.md
git diff --stat
npx prettier --check docs/auditoria-ammen-2026-08.md
```
Además se hicieron búsquedas/lecturas estáticas de rutas, tests, policies, grants, RPC, push, pagos, observabilidad, safety, auth y ciclos de plan mediante las herramientas de inspección del workspace. El estado inicial mostró cambios del usuario en tabs y traducciones, más archivos nuevos; no se tocaron ni se revirtieron.

`git diff --check` no reportó errores sobre diffs tracked (el documento seguía untracked); `prettier --check` sí reportó estilo Markdown pendiente. Ese check no forma parte del lint del proyecto, que limita Prettier a JS/TS/JSON. No se reescribió el documento automáticamente para no tocar nada fuera del alcance.

No se ejecutó `npm run verify`: se documenta como gate existente, no como resultado en verde. Tampoco se ejecutaron build, Supabase local, Vitest, suites SQL o app runtime en esta tarea. La única modificación de archivo de la auditoría es este documento.

---

**Conclusión final:** conservar el núcleo y reducir ambición operativa. Corregir primero
el privilegio de staff; después safety, semántica pública, auth, push y disciplina de
despliegue. Ammen no necesita más funciones para justificar una beta: necesita probar,
con usuarios y trazas, que la promesa central llega de vuelta de forma segura. **Hasta
cerrar y volver a verificar los blockers, el estado permanece REJECT/no aprobado.**
