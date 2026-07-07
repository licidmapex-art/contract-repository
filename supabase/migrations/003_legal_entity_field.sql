-- Add legal_entity metadata field and improve party extraction prompts

insert into metadata_fields (key, label, category, field_type, playbook_prompt, is_builtin)
values (
  'legal_entity',
  'Legal entity',
  'core',
  'text',
  'Identify which of OUR legal entities is a party to this contract. Use only a name from the known legal entities list provided during extraction. Return null if none of our entities appear in the contract.',
  true
)
on conflict (key) do update set
  label = excluded.label,
  playbook_prompt = excluded.playbook_prompt;

update metadata_fields
set playbook_prompt = 'Extract the EXTERNAL party to this contract (not our own legal entities). Return only the counterparty name. If multiple external parties appear, return the primary one. Never include names from our known legal entities list.'
where key = 'counterparty';
