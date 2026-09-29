# Rescate de migraciones huérfanas — 2026-09-29

La base local (`supabase_db_ammen`) tenía aplicadas ocho migraciones que no
estaban en el repo, ni en la historia de git, ni en ningún fichero del disco.
Su SQL solo sobrevivía en `supabase_migrations.schema_migrations.statements`, y
cualquier `db reset` (también `db:test`, `verify` y `e2e`) lo habría borrado.

Esta carpeta es la copia literal de ese SQL, volcado desde la base tal cual se
aplicó. **No son migraciones:** el CLI de Supabase solo lee
`supabase/migrations/`, así que aquí no se ejecutan. Se reintegran como
migraciones nuevas en la Oleada 0a del plan de auditoría (2026-09-29).

| Versión local | Nombre | Qué arregla |
|---|---|---|
| 20260908100000 | export_personal_collections | `export_my_data` con notas, subrayados, lista, chat… |
| 20260909100000 | circle_chat_membership | quien sale de un círculo no puede seguir leyendo ni escribiendo su chat |
| 20260910100000 | visible_comment_counts | los contadores cuentan solo comentarios visibles |
| 20260911100000 | reservation_owner_date | la reserva de generación usa el calendario del dueño |
| 20260912100000 | circle_plan_completion | fin de un plan de círculo |
| 20260913100000 | reported_content_moderation | el staff oculta contenido reportado |
| 20260914100000 | open_crisis_queue | la cola de crisis entera, no solo 30 filas |
| 20260915100000 | stable_list_pagination | cursores compuestos estables en los feeds paginados |

La versión `20260908100000` choca con `20260908100000_email_lifecycle.sql` del
repo: las dos líneas de trabajo se escribieron en paralelo y las dos redefinen
`export_my_data`.

- `local-db-schema.sql`: `pg_dump --schema-only` de esa base (con las ocho
  aplicadas y **sin** las dos de correo), como referencia para el merge y para
  comparar definiciones de funciones.
- Fuera del repo, en `C:\Users\jaime\ammen-rescue-2026-09-29\`: el volcado
  completo (`pg_dump -Fc`, con datos locales de prueba) y otra copia de estos
  ficheros.
