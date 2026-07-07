update metadata_fields
set playbook_prompt = 'Select the best matching folder path from the known folder list provided during extraction (e.g. Natural gas / EU). Return ONLY an exact path from that list, or null if none fit.'
where key = 'activity_folder';
