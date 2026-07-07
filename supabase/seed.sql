insert into metadata_fields (key, label, category, field_type, playbook_prompt, is_builtin) values
  ('contract_type', 'Contract Type', 'core', 'text', 'Identify the contract type. Return ONLY an exact name from the known contract types list provided during extraction. If none match, return null.', true),
  ('legal_entity', 'Legal entity', 'core', 'text', 'Identify which of OUR legal entities is a party to this contract. Use only a name from the known legal entities list provided during extraction. Return null if none of our entities appear in the contract.', true),
  ('counterparty', 'Counterparty', 'core', 'text', 'Extract the EXTERNAL party to this contract (not our own legal entities). Return only the counterparty name. If multiple external parties appear, return the primary one. Never include names from our known legal entities list.', true),
  ('effective_date', 'Effective Date', 'core', 'date', 'Find the effective date or commencement date of the contract. Return in ISO format YYYY-MM-DD.', true),
  ('expiry_date', 'Expiry Date', 'core', 'date', 'Find the expiration, termination, or end date of the contract. Return in ISO format YYYY-MM-DD. Return null if no fixed end date.', true),
  ('value', 'Contract Value', 'core', 'text', 'Extract the total contract value or annual value including currency (e.g. EUR 50,000). Return null if not specified.', true),
  ('notice_period', 'Notice period', 'core', 'text', 'Extract the notice period required for termination or non-renewal. Return ONLY valid JSON with amount, unit (days, business_days, weeks, months, years, or other), and purpose (any_time, avoid_auto_renewal, avoid_auto_termination, or other). Follow the contract unit wording.', true),
  ('automatic_renewal', 'Automatic renewal', 'core', 'boolean', 'Determine whether the contract automatically renews or extends at the end of its term unless notice is given. Return true, false, or null if unclear.', true);

insert into naming_settings (template, keep_original_name) values
  ('{contract_type}_{counterparty}_{effective_date}_{document_role}', true);
