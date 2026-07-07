insert into metadata_fields (key, label, category, field_type, playbook_prompt, is_builtin)
values (
  'automatic_renewal',
  'Automatic renewal',
  'core',
  'boolean',
  'Determine whether the contract automatically renews or extends at the end of its initial term (or each renewal period) unless a party gives notice to terminate or not renew. Return true if the contract states automatic renewal, extension, or rollover. Return false if renewal requires an explicit new agreement or is clearly manual only. Return null if the contract does not address renewal or it is unclear.',
  true
)
on conflict (key) do nothing;
