# Plan de mejora de fricción — agosto de 2026

> Backlog **sin implementar**. Prioridad a partir de la [auditoría runtime](auditoria-ux-runtime-2026-08.md). No toca seguridad B0–B5 ni rediseño de marca.

Evidencia: sesiones 390×844 / 1280×800 y specs `e2e/circles-*.spec.ts`, `e2e/peticiones.spec.ts`, `e2e/invitar.spec.ts` (verdes en Chromium).

## P0 — el loop de círculo se siente roto aunque el dato esté bien

1. **Aterrizar en el círculo tras canjear `/c/{token}`.** Hoy: login desde el preview deja a B en Hoy (Zoe sin plan propio ve el vacío). El `group_members` ya es 2. `redeemPendingTokens` solo hace `router.replace` si hay `planId`. Un círculo debería abrir `/circulo/{id}` igual que un plan abre `/orar/{planId}`.
2. **El invite no puede quedar bajo el pliegue en un círculo de 1.** En 390 lo primero es «Crear el plan del círculo» (cuota Plus) y el empty de compartidos. El enlace y «Invitar» están debajo de peticiones y chat. Subir el bloque de invite (o un CTA «Invitar» fijo) al primer pantallazo.
3. **No mostrar «Unirme» a quien ya es miembro.** `/c/{token}` autenticado con censo 2 seguía pintando Unirme. La cadena `circles.joined` ya existe. Si el tap idempotente navega al detalle, mejor; si no, es un callejón.

## P1 — taps y copy que ya tienen sitio en el código

4. **Copiar de verdad en web.** `/invitar` y el detalle de círculo muestran URL cruda. En headless el share falla y el toast («Copia el enlace de arriba a mano») **tapa la cabecera**. Un control «Copiar» junto a la tarjeta, y el toast sin comerse el «Atrás».
5. **Unirme del directorio con cromo de botón.** En `/circulo/buscar` es un `Tap` de texto. El preview `/c/` sí usa Button.
6. **Buscar públicos sin perder Juntos.** La CTA ghost está bien; la pantalla es un stack suelto. Un segmento o un sheet desde Juntos evitaría «salir» de la tab para una búsqueda que el copy del alta ya promete.
7. **Fade de tabs.** Captura inmediata al pulsar Juntos: Hoy y Juntos se ven a la vez (animación 180 ms). Comprobar que la escena saliente no deje texto legible encima. No es P0 si solo dura un frame.

## P2 — onboarding, cuota, teclado, harness

8. **Nueve taps hasta Hoy.** Cuatro pasos + términos. No recortar a ciegas: medir si un «empezar con lo mínimo» (nombre + un tema) y el resto en Perfil baja abandono. El plan local tardó ~2 s; el copy de «un minuto» sobra en ese entorno.
9. **Plan del círculo vs cuota de 3.** El empty del círculo empuja a crear otro plan. Decirlo antes («cuenta para tus tres planes») o no ponerlo como primer bloque de un círculo que acaba de nacer para invitar.
10. **Teclado en formularios.** Alta de círculo y `/peticiones/nueva` usan `KeyboardScreen`; no se midió en teclado real iOS/Android. Verificar que Crear / Pedir oración no queden bajo el teclado en 390.
11. **Harness visual.** Las 17 pantallas con sesión en claro no son señal: `networkidle` no termina contra Metro. Cambiar a selector por pantalla (como el login) o `domcontentloaded` + espera de skeleton. No regenerar baselines hasta que el test acabe.
12. **`public-contract` «Crear enlace».** El clic no dejó URL; `share-loop` en otro plan sí. Flake o carrera post-reset. Aislar antes de tratarlo como regresión de producto.

## Fuera de este backlog

- Implementar pagos Plus.
- Visual en CI.
- Nativo.
- Reabrir B0–B5.
