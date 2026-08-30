-- Colonnes et fonctions nécessaires à la synchronisation hors ligne.
--
-- `updated_at` est écrit par le client, jamais par un trigger : c'est lui qui
-- arbitre les conflits (dernière écriture gagnante) côté application, et il
-- doit donc rester cohérent avec l'horodatage local qui a produit la ligne.
--
-- Les suppressions sont douces : la ligne reste avec `deleted_at` renseigné,
-- pour que les autres appareils apprennent la disparition à leur prochain
-- passage. Sans cela, une suppression serait invisible et la ligne
-- réapparaîtrait au premier envoi d'un appareil resté hors ligne.

alter table books
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

alter table quotes
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

alter table boards
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

alter table board_quotes
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

-- Le curseur de synchronisation lit ces colonnes à chaque passage.
create index books_updated_idx on books (user_id, updated_at desc);
create index quotes_updated_idx on quotes (user_id, updated_at desc);
create index boards_updated_idx on boards (owner_id, updated_at desc);
create index board_quotes_updated_idx on board_quotes (board_id, updated_at desc);

-- Les lignes supprimées ne doivent plus apparaître dans le fil public ni dans
-- les pages web publiques.
drop index if exists quotes_public_idx;
create index quotes_public_idx on quotes (created_at desc)
  where is_public and deleted_at is null;

-- Une suppression douce est un UPDATE : les épingles n'avaient pas de politique
-- de mise à jour, il leur en faut une.
create policy "marquer mon épingle supprimée" on board_quotes for update using (
  pinned_by = auth.uid()
  or exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid())
);

-- Épingles des tableaux auxquels j'ai accès — les miennes, celles de mes
-- tableaux, et celles posées par d'autres sur un tableau collaboratif dont je
-- suis membre. Le client ne sait pas exprimer cette jointure.
create function my_board_quotes(since timestamptz default null)
returns setof board_quotes
language sql stable set search_path = public as $$
  select bq.*
  from board_quotes bq
  join boards b on b.id = bq.board_id
  where (
      b.owner_id = auth.uid()
      or bq.pinned_by = auth.uid()
      or (b.visibility = 'collaboratif' and is_board_member(b.id))
    )
    and (since is null or bq.updated_at > since);
$$;

-- La recherche plein texte ignore les citations supprimées.
create or replace function search_quotes(term text, max_results int default 30)
returns setof quotes
language sql stable set search_path = public as $$
  select *
  from quotes
  where is_public
    and deleted_at is null
    and search_vector @@ plainto_tsquery('french', term)
  order by ts_rank(search_vector, plainto_tsquery('french', term)) desc, created_at desc
  limit max_results;
$$;
