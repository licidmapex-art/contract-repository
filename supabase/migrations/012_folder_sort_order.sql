-- Custom sort order for folders within each parent (sibling order)

alter table folders
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by parent_id
      order by name
    ) - 1 as position
  from folders
)
update folders f
set sort_order = ranked.position
from ranked
where f.id = ranked.id;

create index if not exists folders_parent_sort_idx
  on folders (parent_id, sort_order);
