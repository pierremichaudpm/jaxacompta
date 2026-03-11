ALTER TABLE contacts ADD COLUMN adresses TEXT DEFAULT '[]';
UPDATE contacts SET adresses = CASE WHEN adresse IS NOT NULL AND adresse != '' THEN json_build_array(json_build_object('label', 'Principal', 'adresse', adresse))::text ELSE '[]' END;
