-- The assistant is spelled Aiva (AI Virtual Assistant), pronounced "Ava".
alter table public.assistant_profiles alter column name set default 'Aiva';
update public.assistant_profiles set name = 'Aiva' where name = 'Ava';
