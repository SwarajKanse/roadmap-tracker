-- ============================================================================
-- Supabase Server-Side Security & Write Protection
-- Project: track.swarajkanse.me (Placement Roadmap Executive Cockpit)
-- 
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard (https://supabase.com/dashboard/project/ljqmvwvfmyoaakgsxddw)
-- 2. Click "SQL Editor" in the left navigation sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (green button)
-- ============================================================================

-- 1. Enable pgcrypto extension for secure bcrypt password hashing
create extension if not exists pgcrypto;

-- 2. Create private authentication table for master password hash
create table if not exists public.tracker_auth (
  id text primary key,
  password_hash text not null,
  updated_at timestamptz default now()
);

-- Revoke all direct public access to the auth table
revoke all on public.tracker_auth from public, anon, authenticated;

-- 3. Set the master password hash (Salted bcrypt via Blowfish)
-- Replace 'REPLACE_WITH_YOUR_PASSWORD' with your actual secure master password when running in Supabase SQL editor.
-- NEVER commit your real password to git!
insert into public.tracker_auth (id, password_hash)
values ('admin', crypt('REPLACE_WITH_YOUR_PASSWORD', gen_salt('bf', 10)))
on conflict (id) do update 
set password_hash = crypt('REPLACE_WITH_YOUR_PASSWORD', gen_salt('bf', 10)),
    updated_at = now();

-- 4. Enable Row Level Security (RLS) on tracker_state
alter table public.tracker_state enable row level security;

-- Revoke direct INSERT, UPDATE, DELETE on tracker_state from anon
revoke insert, update, delete on public.tracker_state from anon;

-- Allow public SELECT (Guest Read-Only for anyone viewing your public roadmap)
drop policy if exists "Allow public read-only" on public.tracker_state;
create policy "Allow public read-only" 
  on public.tracker_state 
  for select 
  to anon, authenticated 
  using (true);

-- Enable Realtime broadcasting on tracker_state so all devices update instantly
alter publication supabase_realtime add table public.tracker_state;
alter table public.tracker_state replica identity full;

-- 5. Create secure server-side verification function
create or replace function public.verify_admin_password(p_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from public.tracker_auth where id = 'admin';
  if v_hash is not null and v_hash = crypt(coalesce(p_password, ''), v_hash) then
    return jsonb_build_object('valid', true);
  else
    return jsonb_build_object('valid', false);
  end if;
end;
$$;

-- 6. Create secure server-side state synchronization function
create or replace function public.sync_tracker_state(p_password text, p_doc_id text, p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from public.tracker_auth where id = 'admin';
  if v_hash is null or v_hash != crypt(coalesce(p_password, ''), v_hash) then
    raise exception '401: Unauthorized - Invalid master password';
  end if;

  insert into public.tracker_state (id, data, updated_at)
  values (p_doc_id, p_data, now())
  on conflict (id) do update
  set data = p_data,
      updated_at = now();

  return jsonb_build_object('success', true, 'updated_at', now());
end;
$$;

-- 7. Create secure password rotation function (requires old password verification)
create or replace function public.rotate_admin_password(p_old_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from public.tracker_auth where id = 'admin';
  if v_hash is null or v_hash != crypt(coalesce(p_old_password, ''), v_hash) then
    raise exception '401: Unauthorized - Invalid current password';
  end if;

  update public.tracker_auth
  set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  where id = 'admin';

  return jsonb_build_object('success', true, 'updated_at', now());
end;
$$;

-- 8. Grant execute permissions to anon and authenticated for the secure RPC functions
grant execute on function public.verify_admin_password(text) to anon, authenticated;
grant execute on function public.sync_tracker_state(text, text, jsonb) to anon, authenticated;
grant execute on function public.rotate_admin_password(text, text) to anon, authenticated;

-- ============================================================================
-- PASSWORD ROTATION CHEATSHEET:
-- To rotate your password in the future without editing this file:
-- Option A (Direct SQL in Supabase SQL Editor):
--   update public.tracker_auth
--   set password_hash = crypt('NEW_PASSWORD', gen_salt('bf', 10)),
--       updated_at = now()
--   where id = 'admin';
--
-- Option B (Via SQL Editor using helper function):
--   select public.rotate_admin_password('OLD_PASSWORD', 'NEW_PASSWORD');
-- ============================================================================
