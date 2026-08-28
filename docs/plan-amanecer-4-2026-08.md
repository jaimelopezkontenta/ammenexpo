# Amanecer 4.0 — Propuestas tras la adopción total de Txt

**Estado: PROPUESTA — 2026-08-28. Nada de este documento se ejecuta sin OK de
Jaime.** Convención del 3.0: bloque de progreso arriba; cada cierre se anota
aquí el mismo día.

> **Progreso** (2026-08-28):
> - ✅ Prerrequisitos cerrados hoy, antes de este documento: push del 3.0 con
>   CI verde; red visual del onboarding (10 capturas nuevas); **adopción total
>   de `Txt`** — 400 `<Text>` crudos en 67 ficheros a CERO, en 5 olas, con
>   4 variantes nuevas (`headingLg`, `subheadingLg`, `bodyMedium`, `overline`),
>   AGENTS.md endurecido y `theme/txt-adoption.test.ts` como ban permanente.
>   Commits `4a1b991`…`1357389`, pusheados.
> - ⬜ Todo lo de abajo espera decisión.

## Cómo se auditó

Corpus: las 38 baselines regeneradas HOY tras la migración (20 pantallas × 2
viewports + onboarding completo), revisión manual en navegador de las
superficies sin red (moderación, compartir, plan/nuevo, círculo, acerca) con
consola limpia, y los hallazgos recogidos durante las 5 olas.

## Propuestas, por prioridad

### P1 — Deuda de harness que hoy muerde (habilitadoras)

| # | Propuesta | Evidencia | Esf. |
|---|---|---|---|
| H-1 | **e2e local contra el export estático, como CI.** `public-contract «clic real»` falla consistente en local y pasa en CI: local corre contra el dev server de Metro y CI contra `scripts/e2eWebServer.mjs`. Un `npm run e2e:static` que use el mismo webServer que CI mata la clase entera de flakes de press perdido | Verificado hoy: falla idéntico con el árbol pre-migración (CI verde) | M |
| H-2 | **Determinismo de la suite visual.** El saludo de Hoy cambia con la hora (mañana/tarde/noche) y el Versículo del día con la fecha: cada baseline caduca sola. Fijar reloj con `page.clock.setFixedTime` en el proyecto `visual` (cuidando los relativos de Avisos) y re-baseline completo | `hoy-movil` y `biblia-movil` estaban rancias y pasaban de rebote; el saludo rompió la suite esta tarde | S/M |
| H-3 | **Re-baseline de sincronización + doctor de entorno.** Varias baselines arrastran deriva sub-tolerancia (la tab aún dice «Círculos» en `orar-movil` y `hoy-escritorio`). Regenerar TODO una vez; y un `npm run doctor` que avise de node gordos (>2 GB), Metro degradado y Kong 502 antes de correr suites — las tres cosas quemaron horas hoy | Trabajala a 13,8 GB; Metro crasheado (OOM 134); Kong con upstream viejo tras un reset | S |

### P2 — Bugs de copy encontrados de pasada

| # | Propuesta | Evidencia | Esf. |
|---|---|---|---|
| C-1 | **plan/nuevo enseña claves crudas.** Con temas precargados del onboarding, la línea-resumen junto al CTA dice `onboarding.topics.paz, onboarding.topics.familia` — las respuestas guardadas usan claves que el catálogo no tiene en ese namespace | Visto en navegador con la cuenta seed | S |

### P3 — Diseño y UX (la ola visible)

| # | Propuesta | Evidencia | Esf. |
|---|---|---|---|
| D-1 | **La puerta legal sin marca.** `/aceptar` es la única pantalla del arranque sin orbe ni wordmark: título serif y dos enlaces sueltos. Un orbe pequeño (como AuthScreen) la hace de la misma casa | Captura `aceptar-movil` de la red nueva | S |
| D-2 | **Onboarding: la pared de 16 chips.** Pasos 2 y 3 presentan 16 píldoras de golpe; la pantalla se lee como inventario. Escalonar la entrada (stagger ya existe en motion) y/o agrupar por familias con un «ver más» | Capturas `onboarding-paso2/3` | M |
| D-3 | **Juntos con aire muerto.** El segmento Círculos deja media pantalla vacía con un solo círculo. Asomar lo vivo de los otros segmentos: últimas peticiones, última historia de Comunidad, badge en los segmentos | Captura `circulos-movil` | M |
| D-4 | **Perfil: columna de horarios.** Los 5 chips de momento de oración caen uno por línea; en flujo compacto (2 por fila) la tarjeta respira | Captura `perfil-movil` | S |
| D-5 | **Hoy escritorio: cabecera flotante.** El título centrado arriba queda desconectado del contenido a la izquierda, y el `···` flota solo. Alinear cabecera con la columna de lectura y anclar el `···` a la fila del día | Captura `hoy-escritorio` | S/M |
| D-6 | **Modo oscuro: ya es barato.** La justificación de `Txt` era esta: hoy TODA la tinta de la app pasa por una tabla (`VARIANT`/`TONE`), `theme/tokens.ts` ya exporta `colorsDark` y `contrast.test.ts` lo mide en AA. Encenderlo es cambiar una tabla + QA visual, no tocar 60 pantallas. **Sigue vetado por decisión de producto: esta fila solo deja constancia de que el precio bajó** | Habilitado por la campaña de hoy | L (decisión) |

## Orden recomendado (si todo recibe OK)

H-2 → H-3 (una tarde de harness, deja la red confiable) → C-1 y D-1 y D-4
(los tres S, un solo PR de afinado) → D-5 → D-2 → D-3. H-1 en paralelo cuando
apetezca tocar tooling. D-6 cuando Jaime quiera abrir esa puerta.

## Fuera de alcance heredado

Spike `formSheet` (sin sheet nuevo que lo pida), CI visual con baselines Linux
(Jaime: «más adelante»), háptica en dispositivo físico (sesión con Jaime, no
código).
