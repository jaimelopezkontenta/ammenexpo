-- Ammen — letting someone leave and take their data with them.
--
-- The app collects prayer requests: health, family, faith. Under the GDPR that
-- is special-category data, and there was no way to delete it from inside the
-- app at all. It is also an App Store requirement for anything that lets you
-- create an account, but the reason to build it now is the first one.
--
-- The client cannot delete its own auth user — that needs elevated rights — so
-- this is SECURITY DEFINER with the check done on auth.uid() rather than on
-- anything the caller passes in. There is no argument on purpose: a function
-- that took a user id would be one policy mistake away from deleting someone
-- else's account.
--
-- Everything else follows: profiles cascades from auth.users, and all
-- twenty-odd application tables cascade from profiles.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
