# Resumen de decisiones del dueño (J2–J12)

**Fecha:** 2026-07-09  
**Estado:** 3 confirmadas, 5 pendientes, 4 sin acción requerida

---

## ✅ Confirmadas (sin acción)

| ID | Decisión | Estado |
|---|---|---|
| **J6** | Biblia WEB (versión en inglés) | ✅ Confirmada |
| **J12** | Idioma en hábito | ✅ Código listo (`profile_settings.locale`) |

---

## ⏳ Pendientes (necesitan tu input)

### J2 — Captcha Turnstile (Cloudflare)
**Bloquea:** Altas sin spam  
**Qué necesitas:** Site key + Secret key de Cloudflare Turnstile  
**Dónde:** https://dash.cloudflare.com → Turnstile → Add Site  
**Impacto:** Sin esto, cualquier persona puede crear cuentas masivamente

### J3 — Tope gasto Anthropic
**Bloquea:** Generación de planes en producción  
**Qué necesitas:** Definir presupuesto mensual (ej: $50/mes)  
**Dónde:** Google Cloud Secret Manager → `ammen-staging` → `ANTHROPIC_API_KEY`  
**Impacto:** Sin tope, el coste puede crecer indefinidamente con el uso

### J4 — Legal RGPD Art. 9
**Bloquea:** Envío de correos en producción  
**Qué necesitas:** Revisión legal del tratamiento de datos de salud/oración  
**Dónde:** Envía el copy de los correos a tu abogado  
**Impacto:** Sin aprobación legal, no puedes enviar correos a usuarios reales

### J5 — Plazos de retención
**Bloquea:** Migración de purga automática  
**Qué necesitas:** Definir plazos:
- Correos: 90/180/30/7 días? (actual: 90)
- Eventos: 180/90/365 días? (actual: 180)
- Push: 30/60/180 días? (actual: 30)
- Historial cron: 7/14/30 días? (actual: 7)

### J11 — Modelo generador
**Bloquea:** Calidad/coste de planes  
**Qué necesitas:** Elegir modelo:
- `claude-sonnet-4-5` (recomendado, buena relación calidad/coste)
- `claude-sonnet-3.5` (más barato, menos calidad)
- Otro modelo que prefieras

---

## 📋 Sin acción requerida ahora

| ID | Decisión | Notas |
|---|---|---|
| **J1** | Proteger `main` con CI | Baja prioridad, hacerlo tras primer deploy estable |
| **J7** | Recursos crisis | Necesita especialista en salud mental |
| **J8** | Universal links | Requiere dominio propio + DNS |
| **J9** | Expo updates | Hoy no instalado, decidir si se instala |

---

## Resumen visual

```
Prioridad    | Decisión          | Estado
─────────────┼───────────────────┼───────────
🔴 Alta      | J2 Captcha        | Pendiente
🔴 Alta      | J4 Legal RGPD     | Pendiente
🟡 Media     | J3 Tope Anthropic | Pendiente
🟡 Media     | J5 Retención      | Pendiente
🟡 Media     | J11 Modelo        | Pendiente
🟢 Baja      | J1 Proteger main  | Sin acción
🟢 Baja      | J7 Crisis         | Sin acción
🟢 Baja      | J8 Universal      | Sin acción
🟢 Baja      | J9 Expo updates   | Sin acción
```

## Acciones inmediatas del dueño

1. **Crear cuenta Cloudflare Turnstile** → J2 (10 min)
2. **Revisar copy de correos** → J4 (30 min)
3. **Definir presupuesto Anthropic** → J3 (5 min)
4. **Definir plazos retención** → J5 (5 min)
5. **Elegir modelo generador** → J11 (5 min)
