-- Run this AFTER the original wedding_bookings table was created.
-- It adds the 30% / 50% / 20% payment schedule and an atomic date-reservation function.

alter table public.wedding_bookings
  add column if not exists event_end_amount numeric(12,2) default 0,
  add column if not exists deliverables_amount numeric(12,2) default 0,
  add column if not exists advance_paid_amount numeric(12,2) default 0,
  add column if not exists event_end_paid_amount numeric(12,2) default 0,
  add column if not exists deliverables_paid_amount numeric(12,2) default 0,
  add column if not exists expires_at timestamptz;

create index if not exists wedding_bookings_expires_idx
  on public.wedding_bookings (expires_at);

-- Keep customer booking data private. Only the server-side service role can access it.
alter table public.wedding_bookings enable row level security;
revoke all on table public.wedding_bookings from anon, authenticated;
grant all on table public.wedding_bookings to service_role;

create or replace function public.create_wedding_booking(
  p_booking_id text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_package_name text,
  p_package_price numeric,
  p_wedding_start_date date,
  p_wedding_end_date date,
  p_functions text,
  p_venue_name text,
  p_venue_address text,
  p_city text,
  p_guest_count integer,
  p_special_requirements text,
  p_advance_amount numeric,
  p_event_end_amount numeric,
  p_deliverables_amount numeric,
  p_balance_amount numeric,
  p_expires_minutes integer default 30
)
returns public.wedding_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wedding_bookings;
begin
  if p_wedding_start_date > p_wedding_end_date then
    raise exception 'Invalid date range';
  end if;

  -- Serialize booking attempts so two customers cannot reserve the same dates simultaneously.
  perform pg_advisory_xact_lock(hashtext('lightroom-wedding-booking-calendar'));

  if exists (
    select 1
    from public.wedding_bookings b
    where b.booking_status in ('confirmed','pending')
      and b.wedding_start_date <= p_wedding_end_date
      and b.wedding_end_date >= p_wedding_start_date
      and (b.booking_status = 'confirmed' or b.expires_at is null or b.expires_at > now())
  ) then
    return null;
  end if;

  insert into public.wedding_bookings (
    booking_id, customer_name, customer_phone, customer_email,
    package_name, package_price, wedding_start_date, wedding_end_date,
    functions, venue_name, venue_address, city, guest_count,
    special_requirements, advance_amount, event_end_amount,
    deliverables_amount, balance_amount, payment_status, booking_status,
    expires_at, created_at, updated_at
  ) values (
    p_booking_id, p_customer_name, p_customer_phone, p_customer_email,
    p_package_name, p_package_price, p_wedding_start_date, p_wedding_end_date,
    p_functions, p_venue_name, p_venue_address, p_city, p_guest_count,
    p_special_requirements, p_advance_amount, p_event_end_amount,
    p_deliverables_amount, p_balance_amount, 'pending', 'pending',
    now() + make_interval(mins => greatest(5, least(120, p_expires_minutes))), now(), now()
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_wedding_booking(text,text,text,text,text,numeric,date,date,text,text,text,text,integer,text,numeric,numeric,numeric,numeric,integer) from public;
grant execute on function public.create_wedding_booking(text,text,text,text,text,numeric,date,date,text,text,text,text,integer,text,numeric,numeric,numeric,numeric,integer) to service_role;
