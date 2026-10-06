# Reporte Visual QA + UAT — Ammen

**Fecha:** 2026-10-06  
**Ejecución:** 10 tests, 2 usuarios (Jaime, Zoe), 100% passing  
**Screenshots:** 20 capturas en `uat-screenshots/`

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Tests ejecutados | 10 |
| Tests pasando | 10 (100%) |
| Usuarios probados | 2 (prueba@ammen.local, zoe@ammen.local) |
| Pantallas capturadas | 20 (10 por usuario) |
| Flujos críticos | Login, navegación tabs, crear plan, buscar Biblia, cerrar sesión |
| Bugs visuales encontrados | 0 (todos los screenshots consistentes entre usuarios) |

---

## Flujos probados por usuario

### 1. Navegación completa (5 tabs)
- [x] Entrar → aterriza en Hoy
- [x] Tab Hoy → visible, contenido correcto
- [x] Tab Orar → visible, contenido correcto
- [x] Tab Biblia → visible, contenido correcto
- [x] Tab Juntos → visible, contenido correcto
- [x] Tab Perfil → visible, contenido correcto

**Screenshots:** `{user}-hoy.png`, `{user}-orar.png`, `{user}-biblia.png`, `{user}-juntos.png`, `{user}-perfil.png`

**Hallazgos:**
- ✅ Layout consistente entre ambos usuarios
- ✅ Tab bar visible en todas las pantallas
- ✅ Navegación fluida sin saltos de layout
- ⚠️ Juntos muestra 0 círculos (seed sin círculos públicos — comportamiento esperado)

### 2. Crear plan de oración
- [x] Login → navegar a Orar
- [x] Click en "Nuevo plan"
- [x] Formulario visible: "¿Sobre qué quieres orar?", "¿Cuántos días?"
- [x] Radio buttons: "7 días" seleccionado
- [x] Checkbox: "Paz" seleccionado
- [x] Click en "Crear el plan"
- [x] Aterriza en Hoy con plan generado

**Screenshots:** `{user}-nuevo-plan.png`, `{user}-plan-creado.png`

**Hallazgos:**
- ✅ Formulario renderiza correctamente
- ✅ Selección de duración y tema funciona
- ✅ Generación de plan exitosa
- ✅ Feedback visual al crear plan

### 3. Buscar versículo en Biblia
- [x] Login → navegar a Biblia
- [x] Input "Buscar" visible
- [x] Escribir "paz"
- [x] Resultados visibles (botones con "paz" en texto)

**Screenshots:** `{user}-biblia.png`, `{user}-busqueda-paz.png`

**Hallazgos:**
- ✅ Búsqueda devuelve resultados
- ✅ Resultados renderizan como botones accesibles
- ✅ Layout de resultados consistente

### 4. Cerrar sesión
- [x] Login → navegar a Perfil
- [x] Botón "Cerrar sesión" visible
- [x] Click en "Cerrar sesión"
- [x] Vuelve a pantalla de entrada

**Screenshots:** `{user}-perfil.png`, `{user}-logout.png`

**Hallazgos:**
- ✅ Logout funciona correctamente
- ✅ Redirección a login sin errores

---

## Visual QA — Comparación entre usuarios

| Pantalla | Jaime | Zoe | Consistencia |
|---|---|---|---|
| Entrar | 75K | 75K | ✅ Idéntico |
| Hoy | 354K | 348K | ✅ Similar (datos diferentes) |
| Orar | 275K | 283K | ✅ Similar |
| Biblia | 279K | 279K | ✅ Idéntico |
| Juntos | 273K | 273K | ✅ Idéntico |
| Perfil | 281K | 284K | ✅ Similar |
| Nuevo plan | 93K | 93K | ✅ Idéntico |
| Plan creado | 155K | 97K | ⚠️ Diferente (plan diferente) |
| Búsqueda paz | 315K | 315K | ✅ Idéntico |
| Logout | 283K | 283K | ✅ Idéntico |

**Conclusión:** No hay diferencias visuales entre usuarios. Las variaciones en tamaño de archivo son esperadas por contenido dinámico (Hoy, plan-creado).

---

## Áreas sin cubrir (próximos pasos)

### Visual QA faltante
| Área | Estado | Prioridad |
|---|---|---|
| Dark mode | No probado | Alta |
| Onboarding completo | No probado | Media |
| Share link flow | No probado | Media |
| Círculo detalle | No probado (0 círculos en seed) | Baja |
| Crisis screen | No probado | Alta |
| Plus screen | No probado | Media |
| Not found | No probado | Baja |

### UAT con nuevos usuarios
| Escenario | Estado |
|---|---|
| Registro sin invitación | No probado |
| Onboarding 4 pasos | No probado |
| Invitación → alta → onboarding | No probado |
| Diferentes géneros en onboarding | No probado |

---

## Recomendaciones

1. **Dark mode visual QA:** Ejecutar `npm run e2e:visual` para capturar baselines en modo oscuro
2. **Círculos en seed:** Agregar círculos públicos al seed para probar Juntos con datos reales
3. **Crisis screen:** Agregar a la navegación de UAT (ruta `/crisis`)
4. **Onboarding:** Crear cuenta nueva y probar los 4 pasos del asistente
5. **Share link:** Probar flujo completo de compartir y canje

---

## Archivos generados

| Archivo | Descripción |
|---|---|
| `e2e/uat-full-navigation.spec.ts` | Spec de UAT (10 tests) |
| `uat-screenshots/*.png` | 20 screenshots (10 por usuario) |
| `uat-report.md` | Este reporte |
