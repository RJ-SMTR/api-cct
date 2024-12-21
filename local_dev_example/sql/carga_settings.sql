-- Setting types
INSERT INTO public.setting_type (id, name)
VALUES (1, 'boolean');
INSERT INTO public.setting_type (id, name)
VALUES (2, 'string');
INSERT INTO public.setting_type (id, name)
VALUES (3, 'number');
INSERT INTO public.setting_type (id, name)
VALUES (4, 'json');


-- Settings for local environment
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (2, 'auto_send_invite_schedule_hours', '25', NULL, false, 3, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (1, 'activate_auto_send_invite', 'true', NULL, true, 1, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (3, 'poll_db_enabled', 'true', NULL, false, 1, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (4, 'poll_db_cronjob', '*/1 * * * *', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (5, 'mail_invite_cronjob', '0 22 * * *', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (7, 'mail_report_enabled', 'true', NULL, false, 1, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (10, 'ab_test_enabled', 'false', '1', false, 1, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (11, 'user_file_max_upload_size', '10MB', '1', false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (9, 'mail_report_recipient_2', 'laurosilvestre.smtr@gmail.com', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (13, 'bigquery_env', 'production', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (17, 'mail_report_recipient_3', 'felipelins.smtr@gmail.com', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (14, 'cnab_current_nsr_date', '2024-06-28T04:00:01.983Z', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (18, 'cnab_last_nsr_sequence', '0', NULL, false, 3, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (15, 'cnab_current_nsr_sequence', '0', NULL, false, 3, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (19, 'cnab_jobs_enabled', 'true', NULL, false, 1, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (6, 'mail_report_cronjob', '0 9 * * *', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (16, 'api_env', 'local', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (8, 'mail_report_recipient_1', 'marcosbernardo@prefeitura.rio', NULL, false, 2, '2024-09-23 19:22:08.703643');
INSERT INTO public.setting (id, name, value, version, editable, "settingTypeId", "updatedAt")
VALUES (12, 'cnab_current_nsa', '568', NULL, false, 3, '2024-12-19 15:37:24.713758');

