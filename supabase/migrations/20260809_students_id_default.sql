-- students.id was the only id column in the schema without a default, so every
-- insert that did not supply one failed with:
--   null value in column "id" of relation "students" violates not-null constraint
--
-- addStudent() in lib/db.ts never sends an id, so the "Add Student" form could
-- not create a student at all. Every other table already had this default.
alter table public.students alter column id set default gen_random_uuid();
