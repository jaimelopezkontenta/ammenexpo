# Runbook — moderación de retenidos (B1a)

> Estado: **IMPLEMENTED/EVIDENCE-PASS local.** Cola, reclamar, liberar,
> retirar — todo auditado y probado. Lo que queda pendiente es puramente
> operativo: quién tiene el rol, con qué SLA y qué cadencia de revisión.

## El ciclo

```
posts/comments (trigger de filtro)
        │  is_objectionable() → held_at
        ▼
content_holds (status='pending')
        │  claim_hold(id)            [staff]
        ▼
content_holds (status='claimed')
        │
        ├── release_hold(id, motivo)  → held_at = null (visible de nuevo)
        └── remove_hold(id, motivo)   → hidden_at = now() (oculto para
                                          siempre; held_at se deja puesto a
                                          propósito, ver la migración)
```

Nunca comparte cola con `crisis_escalations` — ver
`docs/runbooks/crisis-es-en.md`.

## Nombrar a alguien staff

No hay pantalla ni RPC pública. El canal es administrativo (§2 decisión 16
del plan): `admin_set_staff()`, `service_role` únicamente, desde el SQL
runner/dashboard protegido, nunca desde la app. Ejemplo:

```sql
select admin_set_staff(
  '<uuid del usuario>', true, '<tu nombre/handle>', '<motivo, no vacío>'
);
```

Queda registrado en `staff_admin_events` — tabla de solo lectura para
`service_role`, sin policies para el cliente, y append-only: ni el propio
`service_role` puede `UPDATE`/`DELETE` sobre ella (revocado explícitamente).

## Operar la cola

1. Entrar a **Moderación → Retenidos** con una cuenta staff.
2. Cada fila trae el texto, quién lo escribió y su enlace de perfil.
3. **Reclamar** antes de decidir evita que dos personas resuelvan lo mismo a
   la vez — `claim_hold()` falla si ya no está en `pending`.
4. Escribir un motivo (siempre obligatorio) y elegir:
   - **Liberar** — falso positivo. Vuelve a ser visible para todo el mundo.
   - **Retirar** — abusivo de verdad. Queda oculto para siempre; su autor
     sigue viéndolo como "en revisión", nunca como publicado con normalidad.

## SLA — pendiente de decisión operativa

El plan pide medir "edad de la cola" contra un SLA (riesgo §8: "Hold supera
capacidad humana"). El mecanismo para medirlo existe (`created_at` de cada
fila, ordenado por antigüedad en `held_content_queue()`); el número de horas
aceptable y quién revisa cada cuánto **no está decidido** — es una decisión
del dueño operativo, no de este ticket.

## Verificación local repetible

```powershell
npm run db:test:circles   # 15 assertions de B1a: cola, reclamar, liberar,
                           # retirar, y que el extraño/no-staff no puede nada
```
