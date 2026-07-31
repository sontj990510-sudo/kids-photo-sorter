-- Giving Tree kindergarten account, membership, class, and guardian-link model.
-- Prepared only: do not run against an existing production project without review.

create extension if not exists citext;
create extension if not exists pgcrypto;

create type public.membership_status as enum (
  'pending',
  'active',
  'suspended',
  'ended'
);

create type public.school_role as enum (
  'director',
  'teacher',
  'guardian'
);

create type public.application_status as enum (
  'draft',
  'submitted',
  'under_review',
  'partially_approved',
  'approved',
  'rejected',
  'withdrawn'
);

create type public.phone_verification_status as enum (
  'unverified',
  'challenge_pending',
  'verified',
  'locked'
);

create type public.guardian_relationship as enum (
  'father',
  'mother',
  'grandmother',
  'grandfather',
  'other'
);

create type public.legal_authority_claim as enum (
  'yes',
  'no',
  'unsure'
);

create type public.legal_authority_status as enum (
  'not_claimed',
  'claimed_pending_review',
  'verified',
  'restricted',
  'denied'
);

create type public.link_status as enum (
  'pending',
  'active',
  'read_only',
  'ended',
  'revoked'
);

create type public.enrollment_status as enum (
  'pending',
  'active',
  'on_leave',
  'ended',
  'archived'
);

create type public.consent_status as enum (
  'granted',
  'revoked'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  login_id citext not null unique,
  display_name text not null,
  preferred_language text not null default 'ko'
    check (preferred_language in ('ko', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (login_id::text ~ '^[A-Za-z0-9._-]{4,40}$'),
  check (char_length(trim(display_name)) between 2 and 100)
);

create table public.phone_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone_e164 text not null,
  country_code text not null default 'US',
  is_primary boolean not null default true,
  verification_status public.phone_verification_status not null
    default 'unverified',
  verified_at timestamptz,
  otp_consent_at timestamptz,
  otp_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone_e164),
  check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  check (
    (verification_status = 'verified' and verified_at is not null)
    or verification_status <> 'verified'
  )
);

create unique index phone_contacts_one_primary_per_user
  on public.phone_contacts (user_id)
  where is_primary;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  check (char_length(trim(name)) between 2 and 120)
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status public.membership_status not null default 'pending',
  approved_by uuid references public.profiles (id) on delete restrict,
  approved_at timestamptz,
  suspended_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id),
  unique (id, school_id)
);

create table public.membership_roles (
  membership_id uuid not null,
  school_id uuid not null,
  role public.school_role not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.profiles (id) on delete restrict,
  primary key (membership_id, role),
  foreign key (membership_id, school_id)
    references public.school_memberships (id, school_id)
    on delete cascade,
  check (ends_at is null or ends_at > starts_at)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  korean_name text,
  english_name text,
  birth_date date not null,
  record_status text not null default 'active'
    check (record_status in ('active', 'archived', 'deletion_scheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  check (
    nullif(trim(coalesce(korean_name, '')), '') is not null
    or nullif(trim(coalesce(english_name, '')), '') is not null
  )
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  child_id uuid not null,
  class_id uuid not null,
  status public.enrollment_status not null default 'pending',
  starts_on date not null,
  ends_on date,
  end_reason text,
  created_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (child_id, school_id)
    references public.children (id, school_id)
    on delete restrict,
  foreign key (class_id, school_id)
    references public.classes (id, school_id)
    on delete restrict,
  check (ends_on is null or ends_on >= starts_on)
);

create unique index enrollments_one_active_per_child
  on public.enrollments (child_id)
  where status in ('pending', 'active', 'on_leave');

create table public.signup_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  applicant_user_id uuid not null references public.profiles (id) on delete restrict,
  requested_role public.school_role not null,
  status public.application_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);

create table public.application_child_claims (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  school_id uuid not null,
  korean_name text,
  english_name text,
  birth_date date not null,
  relationship public.guardian_relationship not null,
  relationship_other text,
  legal_authority_claim public.legal_authority_claim not null default 'unsure',
  resolved_child_id uuid,
  resolution_status text not null default 'pending'
    check (resolution_status in ('pending', 'matched', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  foreign key (application_id, school_id)
    references public.signup_applications (id, school_id)
    on delete cascade,
  foreign key (resolved_child_id, school_id)
    references public.children (id, school_id)
    on delete restrict,
  check (
    nullif(trim(coalesce(korean_name, '')), '') is not null
    or nullif(trim(coalesce(english_name, '')), '') is not null
  ),
  check (
    (relationship = 'other'
      and char_length(trim(coalesce(relationship_other, ''))) between 1 and 50)
    or
    (relationship <> 'other' and relationship_other is null)
  )
);

create table public.guardian_child_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  guardian_membership_id uuid not null,
  child_id uuid not null,
  relationship public.guardian_relationship not null,
  relationship_other text,
  legal_authority_status public.legal_authority_status not null
    default 'not_claimed',
  status public.link_status not null default 'pending',
  approved_by uuid references public.profiles (id) on delete restrict,
  approved_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (guardian_membership_id, school_id)
    references public.school_memberships (id, school_id)
    on delete restrict,
  foreign key (child_id, school_id)
    references public.children (id, school_id)
    on delete restrict,
  check (
    (relationship = 'other'
      and char_length(trim(coalesce(relationship_other, ''))) between 1 and 50)
    or
    (relationship <> 'other' and relationship_other is null)
  )
);

create unique index guardian_child_links_one_current_link
  on public.guardian_child_links (guardian_membership_id, child_id)
  where status in ('pending', 'active', 'read_only');

create table public.staff_class_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  staff_membership_id uuid not null,
  class_id uuid not null,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  foreign key (staff_membership_id, school_id)
    references public.school_memberships (id, school_id)
    on delete restrict,
  foreign key (class_id, school_id)
    references public.classes (id, school_id)
    on delete restrict,
  check (ends_on is null or ends_on >= starts_on)
);

create table public.capability_grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  membership_id uuid not null,
  capability text not null
    check (capability in (
      'global_notice_write',
      'meal_write',
      'class_note_write',
      'class_photo_publish'
    )),
  class_id uuid,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  foreign key (membership_id, school_id)
    references public.school_memberships (id, school_id)
    on delete cascade,
  foreign key (class_id, school_id)
    references public.classes (id, school_id)
    on delete cascade,
  check (expires_at is null or expires_at > starts_at)
);

create table public.communication_consents (
  id uuid primary key default gen_random_uuid(),
  phone_contact_id uuid not null references public.phone_contacts (id)
    on delete cascade,
  purpose text not null
    check (purpose in ('otp', 'school_updates', 'emergency_updates')),
  status public.consent_status not null,
  disclosure_version text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'granted' and granted_at is not null and revoked_at is null)
    or
    (status = 'revoked' and revoked_at is not null)
  )
);

create table public.lifecycle_actions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  action_type text not null
    check (action_type in (
      'membership_suspend',
      'membership_end',
      'enrollment_end',
      'guardian_link_end',
      'deletion_schedule'
    )),
  target_type text not null,
  target_id uuid not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'scheduled', 'cancelled', 'executed')),
  requested_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id) on delete restrict,
  reason text not null,
  execute_after timestamptz,
  recovery_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.has_active_school_role(
  requested_school_id uuid,
  requested_role public.school_role
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.school_memberships membership
    join public.membership_roles membership_role
      on membership_role.membership_id = membership.id
      and membership_role.school_id = membership.school_id
    where membership.school_id = requested_school_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership_role.role = requested_role
      and membership_role.starts_at <= now()
      and (membership_role.ends_at is null or membership_role.ends_at > now())
  );
$$;

create or replace function public.can_read_child(requested_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.children child
    where child.id = requested_child_id
      and (
        public.has_active_school_role(child.school_id, 'director')
        or exists (
          select 1
          from public.guardian_child_links guardian_link
          join public.school_memberships membership
            on membership.id = guardian_link.guardian_membership_id
            and membership.school_id = guardian_link.school_id
          where guardian_link.child_id = child.id
            and membership.user_id = auth.uid()
            and membership.status = 'active'
            and guardian_link.status in ('active', 'read_only')
        )
        or exists (
          select 1
          from public.enrollments enrollment
          join public.staff_class_assignments assignment
            on assignment.class_id = enrollment.class_id
            and assignment.school_id = enrollment.school_id
          join public.school_memberships membership
            on membership.id = assignment.staff_membership_id
            and membership.school_id = assignment.school_id
          where enrollment.child_id = child.id
            and enrollment.status in ('active', 'on_leave')
            and membership.user_id = auth.uid()
            and membership.status = 'active'
            and assignment.starts_on <= current_date
            and (assignment.ends_on is null or assignment.ends_on >= current_date)
        )
      )
  );
$$;

alter table public.profiles enable row level security;
alter table public.phone_contacts enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.classes enable row level security;
alter table public.children enable row level security;
alter table public.enrollments enable row level security;
alter table public.signup_applications enable row level security;
alter table public.application_child_claims enable row level security;
alter table public.guardian_child_links enable row level security;
alter table public.staff_class_assignments enable row level security;
alter table public.capability_grants enable row level security;
alter table public.communication_consents enable row level security;
alter table public.lifecycle_actions enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy phone_contacts_read_own
  on public.phone_contacts for select
  to authenticated
  using (user_id = auth.uid());

create policy schools_read_active_member
  on public.schools for select
  to authenticated
  using (
    exists (
      select 1
      from public.school_memberships membership
      where membership.school_id = schools.id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    )
  );

create policy memberships_read_own_or_director
  on public.school_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_active_school_role(school_id, 'director')
  );

create policy membership_roles_read_own_or_director
  on public.membership_roles for select
  to authenticated
  using (
    public.has_active_school_role(school_id, 'director')
    or exists (
      select 1
      from public.school_memberships membership
      where membership.id = membership_roles.membership_id
        and membership.user_id = auth.uid()
    )
  );

create policy classes_read_active_member
  on public.classes for select
  to authenticated
  using (
    exists (
      select 1
      from public.school_memberships membership
      where membership.school_id = classes.school_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    )
  );

create policy children_read_authorized
  on public.children for select
  to authenticated
  using (public.can_read_child(id));

create policy enrollments_read_authorized_child
  on public.enrollments for select
  to authenticated
  using (public.can_read_child(child_id));

create policy applications_read_own_or_director
  on public.signup_applications for select
  to authenticated
  using (
    applicant_user_id = auth.uid()
    or public.has_active_school_role(school_id, 'director')
  );

create policy applications_create_own
  on public.signup_applications for insert
  to authenticated
  with check (
    applicant_user_id = auth.uid()
    and status in ('draft', 'submitted')
    and requested_role <> 'director'
  );

create policy applications_update_own_draft
  on public.signup_applications for update
  to authenticated
  using (
    applicant_user_id = auth.uid()
    and status = 'draft'
  )
  with check (
    applicant_user_id = auth.uid()
    and status in ('draft', 'submitted')
    and requested_role <> 'director'
  );

create policy child_claims_read_own_or_director
  on public.application_child_claims for select
  to authenticated
  using (
    public.has_active_school_role(school_id, 'director')
    or exists (
      select 1
      from public.signup_applications application
      where application.id = application_child_claims.application_id
        and application.applicant_user_id = auth.uid()
    )
  );

create policy guardian_links_read_own_or_director
  on public.guardian_child_links for select
  to authenticated
  using (
    public.has_active_school_role(school_id, 'director')
    or exists (
      select 1
      from public.school_memberships membership
      where membership.id = guardian_child_links.guardian_membership_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    )
  );

create policy staff_assignments_read_own_or_director
  on public.staff_class_assignments for select
  to authenticated
  using (
    public.has_active_school_role(school_id, 'director')
    or exists (
      select 1
      from public.school_memberships membership
      where membership.id = staff_class_assignments.staff_membership_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    )
  );

create policy capability_grants_read_own_or_director
  on public.capability_grants for select
  to authenticated
  using (
    public.has_active_school_role(school_id, 'director')
    or exists (
      select 1
      from public.school_memberships membership
      where membership.id = capability_grants.membership_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
    )
  );

create policy communication_consents_read_own
  on public.communication_consents for select
  to authenticated
  using (
    exists (
      select 1
      from public.phone_contacts phone
      where phone.id = communication_consents.phone_contact_id
        and phone.user_id = auth.uid()
    )
  );

create policy lifecycle_actions_read_director
  on public.lifecycle_actions for select
  to authenticated
  using (public.has_active_school_role(school_id, 'director'));

create policy audit_events_read_director
  on public.audit_events for select
  to authenticated
  using (public.has_active_school_role(school_id, 'director'));

-- Phone verification changes, approval, role grants, assignment changes,
-- suspensions, deletion scheduling, consent writes, and audit inserts
-- intentionally have no client write policies. Implement them later as audited
-- server-side transactions after rechecking the caller and intended transition.
