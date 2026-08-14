# Runbook — iOS, canary y candidato público (RDY-13)

> Estado: **SCAFFOLDED / PENDING en su totalidad.** Este entorno es Windows:
> iOS no se ejecuta aquí ni se infiere desde aquí — regla explícita del plan
> (§1 regla 6 y matriz de la sección 6). Nada de este documento se marca PASS
> sin macOS/EAS/TestFlight y un iPhone físico reales.

## Lo que falta antes de que esto sea ejecutable

1. Una Mac o una cuenta EAS con crédito de build iOS (`eas build --platform
   ios`), y login de Apple Developer.
2. `eas.json` (existe, SCAFFOLDED en este repo) probado de verdad generando
   un build.
3. Perfiles de aprovisionamiento / certificados — gestionados por EAS o
   manualmente, no configurados en este entorno.
4. Un iPhone físico. Simulador no cierra push (regla §1 punto 7 y riesgo
   "Cobertura nativa aparente" de la sección 8).

## Subset crítico a correr en Mac/TestFlight/dispositivo, una vez exista lo anterior

- Auth: alta, login, recovery (mismos criterios que RDY-04, repetidos sobre
  el build nativo).
- Deep link: abrir un share link desde Mensajes/Correo, canje, aterriza en
  Orar.
- Compartir → oración → push: dos cuentas, dos dispositivos (uno puede ser
  Android, per la matriz de la sección 6 — pero al menos un iPhone físico
  para que esto cuente como "cierre iOS real").
- Bloqueo: una nueva acción tras bloquear no expone identidad ni dispara push.

## Canary — antes de decidir esto, todo lo anterior tiene que estar verde

- Candidate SHA fijo, con `npm run verify` y Playwright verdes en el mismo
  commit.
- Cohorte y umbrales de error/safety/push — **no decididos**: son una
  decisión de negocio/operación, no algo que este ticket pueda fijar
  unilateralmente.
- Autoridad de stop nombrada (quién puede pausar el rollout, y cómo).
- Forward-fix/rollback de artefacto ensayado al menos una vez en staging
  antes de canary real.

## Por qué este documento no intenta simular nada de esto

Simular un pase iOS con capturas de Android, o con un simulador, sería
exactamente el defecto que el riesgo "Cobertura nativa aparente" del plan
señala como causa de apertura prematura. Este runbook existe para que quien
tenga Mac/EAS/dispositivo sepa por dónde seguir, no para fingir que ya se
hizo.
