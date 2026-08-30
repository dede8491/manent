-- Manent — schéma initial.
-- Toutes les tables sont protégées par RLS : par défaut, une personne ne voit
-- que ses propres lignes ; les exceptions (citations publiques, tableaux
-- publics/collaboratifs, clubs rejoints) sont explicites.

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ─────────────────────────────── Types ────────────────────────────────
create type reading_mode as enum ('plaisir', 'etudes', 'les-deux');
create type book_kind as enum ('papier', 'wattpad', 'etude');
create type book_status as enum ('a-lire', 'en-cours', 'termine');
create type board_visibility as enum ('prive', 'public', 'collaboratif');
create type club_type as enum ('invitation', 'ouvert');
create type club_role as enum ('animatrice', 'membre');
create type notification_kind as enum ('pin', 'board', 'club', 'theme', 'wattpad', 'system');

-- ─────────────────────────────── Profils ──────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  pseudo text unique not null check (char_length(pseudo) between 2 and 24),
  bio text not null default '',
  avatar_emoji text not null default '🌿',
  reading_mode reading_mode not null default 'les-deux',
  followed_themes text[] not null default '{}',
  premium boolean not null default false,
  plan text check (plan in ('mensuel', 'annuel')),
  premium_trial_ends_at timestamptz,
  default_quote_visibility text not null default 'privee'
    check (default_quote_visibility in ('privee', 'publique')),
  share_progress boolean not null default true,
  created_at timestamptz not null default now()
);

-- Le profil est créé automatiquement à l'inscription.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, pseudo)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'pseudo',
      split_part(new.email, '@', 1)
    ) || '_' || substr(new.id::text, 1, 4)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────── Livres ───────────────────────────────
create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  kind book_kind not null default 'papier',
  title text not null,
  author text not null default '',
  isbn text,
  wattpad_url text,
  cover_url text,
  -- Pages pour un livre papier/études, chapitres pour une histoire Wattpad.
  total_units int check (total_units is null or total_units > 0),
  progress_units int not null default 0 check (progress_units >= 0),
  status book_status not null default 'a-lire',
  rating smallint not null default 0 check (rating between 0 and 5),
  summary text not null default '',
  lessons text[] not null default '{}',
  genre text,
  school_level text,
  exam_date date,
  study_sheet jsonb not null default '[]'::jsonb,
  class_club_id uuid,
  notify_new_chapters boolean not null default false,
  created_at timestamptz not null default now()
);

create index books_user_idx on books (user_id, status);

-- ────────────────────────────── Citations ─────────────────────────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  book_id uuid references books on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  -- Numéro de page (papier/études) ou de chapitre (Wattpad).
  locator int,
  note text not null default '',
  themes text[] not null default '{}',
  -- Chemin dans le bucket privé `page-photos` : jamais exposé publiquement.
  source_image_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index quotes_user_idx on quotes (user_id, created_at desc);
create index quotes_public_idx on quotes (created_at desc) where is_public;
create index quotes_themes_idx on quotes using gin (themes);

-- Recherche plein texte française sur le texte et les thèmes.
alter table quotes add column search_vector tsvector
  generated always as (
    to_tsvector('french', coalesce(text, '') || ' ' || array_to_string(themes, ' '))
  ) stored;

create index quotes_search_idx on quotes using gin (search_vector);

-- ─────────────────────────────── Tableaux ─────────────────────────────
create table boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  name text not null,
  description text not null default '',
  visibility board_visibility not null default 'prive',
  share_slug text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table board_members (
  board_id uuid not null references boards on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  added_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table board_quotes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards on delete cascade,
  quote_id uuid not null references quotes on delete cascade,
  pinned_by uuid not null references profiles on delete cascade,
  pinned_at timestamptz not null default now(),
  unique (board_id, quote_id)
);

-- ─────────────────────────────── Clubs ────────────────────────────────
create table clubs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles on delete cascade,
  name text not null,
  description text not null default '',
  type club_type not null default 'invitation',
  themes text[] not null default '{}',
  common_read jsonb,
  challenge jsonb,
  invite_slug text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

alter table books
  add constraint books_class_club_fk
  foreign key (class_club_id) references clubs on delete set null;

create table club_members (
  club_id uuid not null references clubs on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  role club_role not null default 'membre',
  page int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  scope text not null default '',
  visio_url text
);

create table club_event_attendees (
  event_id uuid not null references club_events on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (event_id, user_id)
);

-- Le « passage de la semaine » proposé par un membre.
create table club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs on delete cascade,
  author_id uuid not null references profiles on delete cascade,
  quote_text text not null,
  book_title text not null default '',
  book_author text not null default '',
  locator int,
  created_at timestamptz not null default now()
);

create table club_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references club_posts on delete cascade,
  author_id uuid not null references profiles on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ─────────────────── Challenges, badges, abonnements ──────────────────
create table badges (
  id text primary key,
  emoji text not null,
  label text not null,
  description text not null
);

create table user_badges (
  user_id uuid not null references profiles on delete cascade,
  badge_id text not null references badges on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scope text not null default 'public' check (scope in ('public', 'club')),
  club_id uuid references clubs on delete cascade,
  goal int not null check (goal > 0),
  unit text not null default 'livres',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reward_badge_id text references badges
);

create table challenge_participants (
  challenge_id uuid not null references challenges on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  progress int not null default 0,
  primary key (challenge_id, user_id)
);

create table follows (
  follower_id uuid not null references profiles on delete cascade,
  followed_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table theme_follows (
  user_id uuid not null references profiles on delete cascade,
  theme text not null,
  primary key (user_id, theme)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text not null default '',
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);

-- Compteur mensuel des transcriptions IA, pour le quota du plan gratuit.
create table ai_usage (
  user_id uuid not null references profiles on delete cascade,
  month text not null,
  count int not null default 0,
  primary key (user_id, month)
);

create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  book_id uuid not null references books on delete cascade,
  question text not null,
  answer text not null,
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz not null default now()
);

-- ───────────────────────── Fonctions d'aide RLS ───────────────────────
create function is_club_member(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from club_members where club_id = target and user_id = auth.uid()
  );
$$;

create function is_board_member(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from board_members where board_id = target and user_id = auth.uid()
  );
$$;

create function can_read_board(target uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from boards b
    where b.id = target
      and (b.owner_id = auth.uid() or b.visibility <> 'prive' or is_board_member(b.id))
  );
$$;

-- ──────────────────────────────── RLS ─────────────────────────────────
alter table profiles enable row level security;
alter table books enable row level security;
alter table quotes enable row level security;
alter table boards enable row level security;
alter table board_members enable row level security;
alter table board_quotes enable row level security;
alter table clubs enable row level security;
alter table club_members enable row level security;
alter table club_events enable row level security;
alter table club_event_attendees enable row level security;
alter table club_posts enable row level security;
alter table club_comments enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;
alter table challenges enable row level security;
alter table challenge_participants enable row level security;
alter table follows enable row level security;
alter table theme_follows enable row level security;
alter table notifications enable row level security;
alter table ai_usage enable row level security;
alter table flashcards enable row level security;

-- Profils : lisibles par tous (pages publiques manent.app/@pseudo), modifiables par soi.
create policy "profils lisibles" on profiles for select using (true);
create policy "profil modifiable par soi" on profiles for update using (id = auth.uid());

-- Livres : strictement privés.
create policy "mes livres" on books for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Citations : les miennes, plus toutes les citations publiques.
create policy "mes citations" on quotes for select
  using (user_id = auth.uid() or is_public);
create policy "créer mes citations" on quotes for insert with check (user_id = auth.uid());
create policy "modifier mes citations" on quotes for update using (user_id = auth.uid());
create policy "supprimer mes citations" on quotes for delete using (user_id = auth.uid());

-- Tableaux.
create policy "tableaux visibles" on boards for select using (can_read_board(id));
create policy "créer un tableau" on boards for insert with check (owner_id = auth.uid());
create policy "modifier mon tableau" on boards for update using (owner_id = auth.uid());
create policy "supprimer mon tableau" on boards for delete using (owner_id = auth.uid());

create policy "membres visibles" on board_members for select using (can_read_board(board_id));
create policy "gérer les membres" on board_members for all
  using (exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid()));

create policy "épingles visibles" on board_quotes for select using (can_read_board(board_id));
-- On épingle sur ses propres tableaux, ou sur un tableau collaboratif dont on est membre.
create policy "épingler" on board_quotes for insert with check (
  pinned_by = auth.uid()
  and exists (
    select 1 from boards b
    where b.id = board_id
      and (b.owner_id = auth.uid() or (b.visibility = 'collaboratif' and is_board_member(b.id)))
  )
);
create policy "désépingler" on board_quotes for delete using (
  pinned_by = auth.uid()
  or exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid())
);

-- Clubs : les clubs ouverts sont visibles de tous, les autres de leurs membres.
create policy "clubs visibles" on clubs for select
  using (type = 'ouvert' or host_id = auth.uid() or is_club_member(id));
create policy "créer un club" on clubs for insert with check (host_id = auth.uid());
create policy "animer mon club" on clubs for update using (host_id = auth.uid());
create policy "fermer mon club" on clubs for delete using (host_id = auth.uid());

create policy "membres du club visibles" on club_members for select using (is_club_member(club_id));
create policy "rejoindre un club ouvert" on club_members for insert with check (
  user_id = auth.uid()
  and exists (select 1 from clubs c where c.id = club_id and c.type = 'ouvert')
);
create policy "mettre à jour ma progression" on club_members for update using (user_id = auth.uid());
create policy "quitter un club" on club_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from clubs c where c.id = club_id and c.host_id = auth.uid())
);

create policy "événements visibles" on club_events for select using (is_club_member(club_id));
create policy "animer les événements" on club_events for all
  using (exists (select 1 from clubs c where c.id = club_id and c.host_id = auth.uid()))
  with check (exists (select 1 from clubs c where c.id = club_id and c.host_id = auth.uid()));

create policy "présences visibles" on club_event_attendees for select using (
  exists (select 1 from club_events e where e.id = event_id and is_club_member(e.club_id))
);
create policy "je réponds pour moi" on club_event_attendees for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "passages visibles" on club_posts for select using (is_club_member(club_id));
create policy "proposer un passage" on club_posts for insert
  with check (author_id = auth.uid() and is_club_member(club_id));
create policy "retirer mon passage" on club_posts for delete using (author_id = auth.uid());

create policy "commentaires visibles" on club_comments for select using (
  exists (select 1 from club_posts p where p.id = post_id and is_club_member(p.club_id))
);
create policy "commenter" on club_comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from club_posts p where p.id = post_id and is_club_member(p.club_id))
);
create policy "supprimer mon commentaire" on club_comments for delete using (author_id = auth.uid());

-- Référentiels lisibles par tous.
create policy "badges lisibles" on badges for select using (true);
create policy "badges obtenus lisibles" on user_badges for select using (true);
create policy "challenges lisibles" on challenges for select using (true);
create policy "participations lisibles" on challenge_participants for select using (true);
create policy "je participe pour moi" on challenge_participants for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "abonnements lisibles" on follows for select using (true);
create policy "je suis qui je veux" on follows for all
  using (follower_id = auth.uid()) with check (follower_id = auth.uid());

create policy "mes thèmes" on theme_follows for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "mes notifications" on notifications for select using (user_id = auth.uid());
create policy "marquer mes notifications" on notifications for update using (user_id = auth.uid());

create policy "mon quota" on ai_usage for select using (user_id = auth.uid());
create policy "mes flashcards" on flashcards for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────────── Stockage ───────────────────────────────
-- Les photos de pages sont strictement privées : usage personnel, jamais
-- redistribuées (droit de courte citation).
insert into storage.buckets (id, name, public)
values ('page-photos', 'page-photos', false)
on conflict (id) do nothing;

create policy "mes photos de pages" on storage.objects for all
  using (bucket_id = 'page-photos' and owner = auth.uid())
  with check (bucket_id = 'page-photos' and owner = auth.uid());

-- Les avatars, eux, sont publics.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars lisibles" on storage.objects for select using (bucket_id = 'avatars');
create policy "mon avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and owner = auth.uid());

-- ─────────────────────── Recherche plein texte ────────────────────────
create function search_quotes(term text, max_results int default 30)
returns setof quotes
language sql stable set search_path = public as $$
  select *
  from quotes
  where is_public
    and search_vector @@ plainto_tsquery('french', term)
  order by ts_rank(search_vector, plainto_tsquery('french', term)) desc, created_at desc
  limit max_results;
$$;
