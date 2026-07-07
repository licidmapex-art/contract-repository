-- Structured notice period (duration + unit + when notice applies)

update metadata_fields
set
  key = 'notice_period',
  label = 'Notice period',
  field_type = 'text',
  playbook_prompt = 'Extract the notice period required for termination or non-renewal.
Return ONLY valid JSON (no markdown fences):
{
  "amount": 30,
  "unit": "days" | "business_days" | "weeks" | "months" | "years" | "other",
  "unit_label": "optional verbatim unit phrase from the contract, e.g. calendar months",
  "purpose": "any_time" | "avoid_auto_renewal" | "avoid_auto_termination" | "other",
  "purpose_detail": "optional short quote or explanation from the contract"
}

Rules:
- Follow the contract wording for the unit (days, business days, weeks, months, years).
- amount is numeric only; use null if no number is stated.
- purpose any_time: ordinary termination notice at any time during the term.
- purpose avoid_auto_renewal: notice solely to prevent automatic renewal or extension.
- purpose avoid_auto_termination: notice solely to prevent automatic termination at end of term.
- Return null for the whole field if no notice period is specified.'
where key = 'notice_period_days';

insert into metadata_fields (key, label, category, field_type, playbook_prompt, is_builtin)
select
  'notice_period',
  'Notice period',
  'core',
  'text',
  'Extract the notice period required for termination or non-renewal. Return ONLY valid JSON with amount, unit, and purpose (any_time, avoid_auto_renewal, avoid_auto_termination). Follow the contract unit wording.',
  true
where not exists (select 1 from metadata_fields where key = 'notice_period');

-- Migrate legacy numeric day values to structured JSON
update metadata_values mv
set value = json_build_object(
  'amount', (mv.value)::numeric,
  'unit', 'days',
  'unit_label', null,
  'purpose', 'any_time',
  'purpose_detail', null
)::text
from metadata_fields mf
where mv.field_id = mf.id
  and mf.key = 'notice_period'
  and mv.value ~ '^[0-9]+(\.[0-9]+)?$';
