# Auditoría runtime UX — agosto de 2026

> Pase **ejecutado** en web local (Expo + Supabase local, 2026-08-31). Destinatario: fundador de Ammen.
> No es rediseño, no reabre B0–B5, no implementa las mejoras. Complementa la [auditoría estática](auditoria-ammen-2026-08.md).

## 1. Veredicto

El producto **se puede recorrer de extremo a extremo en web**: alta → Hoy con día 1, crear círculo privado, invitar por `/c/{token}`, unirse, directorio público, petición en el muro, enlace `/invitar`. Eso no estaba cubierto por e2e funcional y ahora sí.

La fricción no es que falte el loop. Es que **el valor queda un tap (o un scroll) más allá de donde el usuario acaba de aterrizar**, y varias pantallas nuevas no están en la red visual.

**Beta privada con gente de confianza:** sí, para estos flujos. **Pulir antes de ampliar cohortes:** aterrizaje tras canje de círculo, bloque de invite por encima del pliegue, Unirme de quien ya es miembro.

## 2. Método y certeza

- **[H] Hecho:** visto en sesión (Playwright persona + capturas) o en un spec que pasó.
- **[I] Inferencia:** conclusión razonable; se indica cómo falsarla.
- Escala: **0 inexistente · 1 frágil · 2 parcial · 3 sólido con gaps · 4 listo y probado**.
- Viewports: 390×844 (tabs inferiores) y 1280×800 (raíl). Seeds `prueba@ammen.local` / `zoe@ammen.local` y alta fresca `e2e-persona-*@ammen.local`.
- El MCP del browser del IDE no sostuvo pestaña en este agente; las sesiones se recorrieron con Chromium aislado (dos contexts, **sin** `db reset`) y capturas en `docs/evidencias/ux-runtime-2026-08/`.

## 3. Scores por frente

| Frente | Score | Lectura |
|---|---:|---|
| Visual (contrato + baselines) | **3** | Login, alta, onboarding y `@dark` coinciden con la referencia. Las 17 pantallas con sesión en claro **no se compararon**: timeout de `networkidle` (10 min), no diff de píxeles. Las pantallas fuera de baseline existen y usan Pill/Card/EmptyState/Tap/Txt; el invite queda bajo el pliegue. |
| Flujos (personas reales) | **3** | Alta, privado+invite, público+buscar, petición, `/invitar` y follow se completaron. Tras login desde `/c/` se aterriza en Hoy, no en el círculo. |
| Fricción | **2** | Nueve taps hasta Hoy; invite crudo y bajo el pliegue; Unirme sigue en el preview aunque el censo ya sea 2; toast de share tapa la cabecera. |
| Cobertura de test | **3** | Había SQL de círculos y cero e2e de crear/invitar/unir/petición. Ahora hay cuatro specs Chromium verdes. Visual de sesión en claro no es señal fiable (timeout). Un test viejo de share público falló al crear el enlace. |

## 4. Harness (diagnóstico, no se regeneraron baselines)

| Suite | Resultado | Nota |
|---|---|---|
| Chromium funcional (18 tests, antes de los nuevos) | **17 passed / 1 failed** | Fallo: `public-contract` «Crear enlace» no materializó `http://127.0.0.1:8081/p/…` (el botón siguió diciendo que no hay enlace). `share-loop.spec.ts` **sí pasó**: el loop de plan no se rompió. |
| `e2e:visual` + `visual-dark` (11 tests) | **9 passed / 2 failed** | Fallos: pantallas con sesión en claro (móvil y escritorio), **timeout 600 s** en `waitForLoadState("networkidle")` / `goto` del chat — Metro saturado, no mismatch de snapshot. Onboarding visual, entrar/crear-cuenta, y **todo `@dark` de sesión** pasaron. |
| Specs nuevos solos (4) | **4 passed** | `circles-invite` · `circles-public` · `invitar` · `peticiones`. |
| Chromium completo (22, con los nuevos) | **21 passed / 1 failed** | Los cuatro specs nuevos volvieron a pasar. El único fallo es el mismo `public-contract` de «Crear enlace». `share-loop` pasó otra vez. |

No se regeneraron baselines. No se metió visual en CI.

## 5. Hallazgos de sesión

### 5.1 Alta y onboarding — persona Cuenta nueva

- **[H]** De `/crear-cuenta` a Hoy: **9 taps** (Crear cuenta → Acepto → género → Siguiente → estación → Siguiente → tema → Siguiente → Crear mi plan). Nombre es tipeo, no tap. Reloj de pared ~6,7 s con generación local; `planGenMs` **1,9 s** (no el minuto que teme el copy de share).
- **[H]** El día 1 existía («Día 1 de 7», «La paz que no es del mundo»). El primer frame de Hoy a veces solo pinta la barra de tabs; el contenido llega un instante después.
- **[H]** Términos: CTA «Acepto» y salida «Cerrar sesión». No es un overlay con un único «Cerrar»; es una puerta a pantalla completa. `closeCount` de «Cerrar» matchea «Cerrar sesión» por substring.
- **[H]** Paso 4: horas 6:00 / 8:00 / 12:00 / 18:00 / 21:00; «por la mañana» ya viene elegida (como el spec de cuenta fresca).

### 5.2 Juntos y alta de círculo

- **[H]** Vacío de círculos usa `EmptyState` («Todavía no tienes círculos») con dos puertas arriba: «Crear círculo» y «Buscar círculos públicos». No es un callejón sin CTA.
- **[H]** Formulario inline (`CirclesPane`): «Nuevo círculo», Nombre, Descripción, radios Pill «Solo por invitación» / «Cualquiera puede encontrarlo», hint, Crear / Cancelar. El teclado no se midió en dispositivo; el form está en `KeyboardScreen`.
- **[H]** Tras crear, aterriza en el detalle. Contrato visual: `EmptyState` en planes compartidos; el plan del círculo es una **tarjeta con CTA** («Este círculo no tiene plan» / «Crear el plan del círculo»), no el EmptyState orbe.
- **[H]** En 390×844 el **enlace de invitación queda bajo el pliegue**. Lo que se ve: plan vacío, 1 miembro, empty de compartidos, «Peticiones del círculo», «Abrir el chat». El bloque «Enlace de invitación» + URL cruda + «Invitar» / «Salir» existe en el DOM (innerText) pero exige scroll del `ScrollView`. `window.scrollTo` no mueve ese scroll.
- **[H]** URL cruda: `http://127.0.0.1:8081/c/{token}?de=circulo`.

### 5.3 Invitado anónimo → join

- **[H]** `/c/{token}` sin sesión: título «Te invitan a "…"», censo, descripción, **Unirme es `link`** (Link asChild), «Ya tengo cuenta» es link. **Cero tabs.** El invitado no puede mirar Hoy/Orar desde el preview.
- **[H]** Tras «Ya tengo cuenta» + login de Zoe: aterriza en **Hoy**, no en el círculo. El canje sí ocurre: al reabrir el preview el copy pasa a «2 personas».
- **[H]** Con sesión y ya miembro, `/c/{token}` **sigue mostrando «Unirme»** (ahora botón). No hay «Ya eres parte de este círculo» (`circles.joined` está traducido y no salió).
- **[H]** Chat: EmptyState «Todavía no hay mensajes. Escribe el primero.» + Enviar.
- **[H]** Salir: dos taps («Salir del círculo» → «Sí, salir del círculo»). Vuelve a `/circulos`.

### 5.4 Público y buscar

- **[H]** Hint al elegir público: «Aparecerá en las búsquedas. Quien lo cree tendrá que moderarlo.»
- **[H]** `/circulo/buscar` es **ruta aparte** (cabecera «Buscar círculos»), no un segmento de Juntos. Query vacía **hojea**: el círculo público recién creado ya estaba en la lista.
- **[H]** «Unirme» en el directorio es `Tap` de texto, sin cromo de botón. Affordance más débil que el Unirme del preview.
- **[H]** Tras unirse, la URL es `/circulo/{id}`. Jaime (no miembro) veía «2 miembros» y Unirme: censo correcto.

### 5.5 Peticiones e invitar app

- **[H]** `/peticiones/nueva`: un campo, toggle «Pedirlo sin mi nombre», resumen «Se publicará con tu nombre.», CTA «Pedir oración» (mismo copy que el título de pantalla).
- **[H]** El cuerpo publicado apareció en el asomo de Juntos («MIENTRAS TANTO»). El spec e2e afirma el muro.
- **[H]** `/invitar`: el código **no existe hasta** «Invitar amigos». Tras el tap, tarjeta «Tu enlace» con URL cruda `/i/{code}?de=invitacion`. En Chromium headless: toast **«No se pudo compartir. Copia el enlace de arriba a mano.»** solapando la cabecera; no hay botón Copiar junto a la URL.
- **[H]** Plus: «Todos los planes que quieras, no tres.» Lista de espera, sin pago. Círculos y orar por otros se declaran gratis. No se agotó la cuota de 3 en esta sesión (la cuenta nueva tenía 1 plan).

### 5.6 Escritorio y contrato visual

- **[H]** 1280×800: raíl izquierdo (Hoy / Biblia / Orar / Juntos / Perfil), contenido centrado, versículo del día a la derecha en Hoy. Mismos `role=tab`.
- **[H]** Un no-miembro que abre `/circulo/{id}` privado ve `ErrorState` («Algo no ha ido bien» / «Esta invitación ya no es válida.») con cabecera — no un vacío mudo. Distingue error de empty.
- **[H]** Spot-check de compartir plan de Jaime: pantalla «Compartir mi plan», círculo Familia, «Crear enlace» aún no pulsado. El spec `share-loop` pasó en el diagnóstico.
- **[I]** El solape Hoy/Juntos al cambiar de tab (fade 180 ms, ambas capas en el árbol) es real en captura inmediata; un humano puede no percibirlo. Falsar: grabar el cambio de tab a 60 fps.

### 5.7 Hipótesis del plan, medidas

| Hipótesis | Resultado |
|---|---|
| Onboarding de 4 pasos antes de valor | **[H]** 9 taps; el valor (día 1) existe justo después. |
| Círculo vacío aún pide encontrar el invite | **[H]** El bloque existe al aterrizar, **bajo el pliegue** en móvil. |
| URL cruda en web | **[H]** `/c/…` y `/i/…` seleccionables, sin botón Copiar. |
| `/circulo/buscar` fuera de Juntos | **[H]** Ruta stack, CTA ghost desde la lista. |
| Cuota de 3 planes compartida con plan de círculo | **[I]** Plus lo dice; no se disparó el tope. El CTA «Crear el plan del círculo» es lo primero que se ve en un círculo nuevo. |
| Invitado no puede mirar tabs | **[H]** Preview `/c/` sin barra. |

## 6. Contrato AGENTS.md (pantallas fuera de baseline)

| Pieza | ¿Se usó? |
|---|---|
| Pill | Sí (segmentos Juntos, radios de visibilidad, Reflexiona/Aplica/Ora). |
| Card / Glass | Sí (plan del círculo, enlace invitar, peticiones). |
| EmptyState | Sí (lista de círculos, compartidos, chat). |
| ErrorState | Sí (detalle de círculo ajeno). |
| Tap / Button | Sí; Unirme del directorio es Tap de texto. |
| Txt | Sí; no se reconstruyeron variantes a mano en estas pantallas. |
| Un Cerrar en overlay | Términos no es overlay. Toast de share no tiene Cerrar propio (caduca). |
| goBackOr | Cabeceras stack con flecha; no se forzó `router.back()` sin historial en el pase. |

## 7. Qué no se hizo

Nativo. Regenerar baselines. Meter visual en CI. Implementar el backlog de fricción. Reabrir B0–B5. Commit.
