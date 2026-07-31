-- Ammen — remembering where someone stopped reading.
--
-- On profile_settings rather than a new table: it is already the owner-only
-- settings table with its own SELECT/UPDATE policies and a table-level grant, a
-- row is guaranteed for every user by handle_new_user(), and there is exactly
-- one value per person with no history worth keeping.
--
-- A reading_positions table would need a grants entry, two policies, an upsert
-- path, and would walk straight into the INSERT ... RETURNING trap — all to
-- store three smallints. New columns on an existing table need no grant change.

alter table public.profile_settings
  add column last_read_book_id smallint references public.bible_books (id),
  add column last_read_chapter smallint,
  add column last_read_verse smallint,
  add column last_read_at timestamptz;

-- Either the whole position is set or none of it: a book with no chapter would
-- render a "continue reading" card pointing nowhere.
alter table public.profile_settings
  add constraint profile_settings_reading_position_complete check (
    (last_read_book_id is null and last_read_chapter is null)
    or (last_read_book_id is not null and last_read_chapter is not null)
  );
