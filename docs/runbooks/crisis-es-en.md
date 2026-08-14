# Runbook — crisis ES/EN (B1b)

> Estado: **mecanismo IMPLEMENTED / texto y protocolo PENDING de
> especialista.** Este documento describe lo que existe en código y lo que
> falta decidir con una persona cualificada antes de tratar esto como cerrado
> para público. Beta puede abrir con el mínimo descrito aquí; público, no —
> regla explícita del plan (§2 decisión 9).

## Lo que ya existe (migración `20260822100000_crisis_separation.sql`)

- `is_crisis_text()` — un clasificador de frases, separado por completo de
  `is_objectionable()` (el filtro genérico de espam/insultos). No es
  diagnóstico: es un filtro tosco de frases, documentado como tal en la
  propia migración.
- `posts.crisis_flagged_at` / `comments.crisis_flagged_at` — nunca se
  confunde con `held_at` de un hold genérico, aunque ambos se ponen juntos
  para que la fila quede oculta igual.
- `crisis_escalations` — cola separada de `content_holds`, con
  `acknowledge_crisis()` para que una persona de guardia deje constancia de
  qué hizo. RLS cerrado: solo `is_staff()` la lee, vía RPC, nunca la tabla
  directa.
- Cliente: `useWritePrayerRequest`/`useWriteComment` devuelven
  `crisisFlagged` desde el propio `insert`, y `app/peticiones/nueva.tsx` /
  `app/peticiones/[id].tsx` llevan a `/crisis` en el momento — no en la
  siguiente carga del muro.
- `app/crisis.tsx` — recursos inmediatos, sin diagnóstico, sin promesa de
  intervención automática, con el 024 de España y un fallback internacional
  genérico.
- Panel de moderación (`app/moderacion.tsx`, pestaña "Crisis") — para quien
  tiene guardia: lista lo abierto, ordenado por antigüedad, y exige una nota
  no vacía para acusar recibo.

## Lo que NO existe y no se puede fingir sin especialista

1. **El texto de `app/crisis.tsx` no está aprobado.** Es un mínimo
   defendible (024, fallback internacional, sin diagnóstico), no un
   protocolo clínico revisado. Antes de público: alguien cualificado revisa
   cada frase.
2. **Países y edades objetivo no están decididos.** El recurso "024" asume
   España; una audiencia distinta necesita su propio número, y alguien tiene
   que decidir cuáles se incluyen.
3. **No hay escalado a un humano en tiempo real.** `acknowledge_crisis()`
   deja constancia de que alguien lo vio y qué hizo, pero no hay paging,
   SMS ni alerta automática — hoy depende de que alguien abra el panel. Antes
   de público hace falta una guardia con SLA real y forma de avisar a esa
   guardia (no construida en este ticket: requiere decidir el canal).
4. **No hay simulacro con especialista.** El guion D de la sección 5 del plan
   ("Frase de crisis") no se ha ejecutado con una frase aprobada ni con
   quien tenga guardia real cronometrando.
5. **Privacidad/conservación de `crisis_escalations` sin política escrita.**
   La tabla existe y no se borra sola; falta decidir cuánto tiempo se
   conserva y quién puede pedir su borrado.

## Antes de abrir beta (mínimo, según el plan)

- [x] ES/EN no se publican como post normal (mecanismo).
- [x] Recursos inmediatos existen y no prometen intervención automática.
- [ ] Especialista aprueba el texto exacto — **PENDING**.
- [ ] Dueño operativo y SLA de guardia nombrados — **PENDING**.

## Antes de abrir público (adicional)

- [ ] Simulacro humano cronometrado, con frase sintética aprobada.
- [ ] Escalado con paging/alerta real, no solo un panel que hay que abrir.
- [ ] Política de conservación/acceso de `crisis_escalations` escrita y
      revisada.

## Verificación local repetible

```powershell
npm run db:test:circles   # incluye las assertions de B1b: clasificador
                           # separado, cola separada, acuse de recibo auditado
```

Sin frase real de ninguna persona en este repositorio, en los tests ni en
ninguna captura: el corpus de prueba es sintético (`quiero matarme`, `kill
yourself`), igual que exige la sección 6 del plan.
