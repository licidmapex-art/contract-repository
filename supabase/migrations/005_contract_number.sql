create sequence if not exists contracts_contract_number_seq;

alter table contracts
  add column if not exists contract_number integer;

alter table contracts
  alter column contract_number set default nextval('contracts_contract_number_seq');

with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from contracts
)
update contracts c
set contract_number = o.rn
from ordered o
where c.id = o.id
  and c.contract_number is null;

select setval(
  'contracts_contract_number_seq',
  coalesce((select max(contract_number) from contracts), 0),
  true
);

create unique index if not exists contracts_contract_number_unique
  on contracts(contract_number);
