## Tables and Columns

| table_name               | column_name            | data_type                | is_nullable | column_default    |
| ------------------------ | ---------------------- | ------------------------ | ----------- | ----------------- |
| disposable_email_domains | domain                 | text                     | NO          | null              |
| profiles                 | id                     | uuid                     | NO          | null              |
| profiles                 | trial_ends_at          | timestamp with time zone | NO          | null              |
| profiles                 | stripe_customer_id     | text                     | YES         | null              |
| profiles                 | subscription_status    | text                     | NO          | 'trialing'::text  |
| profiles                 | created_at             | timestamp with time zone | NO          | now()             |
| profiles                 | payment_failed_at      | timestamp with time zone | YES         | null              |
| profiles                 | grace_period_ends_at   | timestamp with time zone | YES         | null              |
| profiles                 | email                  | text                     | YES         | null              |
| profiles                 | normalized_email       | text                     | YES         | null              |
| profiles                 | cancel_at_period_end   | boolean                  | NO          | false             |
| profiles                 | current_period_end     | timestamp with time zone | YES         | null              |
| profiles                 | subscription_event_at  | timestamp with time zone | YES         | null              |
| profiles                 | trial_followup_sent_at | timestamp with time zone | YES         | null              |
| profiles                 | comp_access            | boolean                  | NO          | false             |
| saved_contracts          | id                     | uuid                     | NO          | gen_random_uuid() |
| saved_contracts          | user_id                | uuid                     | NO          | auth.uid()        |
| saved_contracts          | strike                 | numeric                  | NO          | null              |
| saved_contracts          | expiration_date        | date                     | NO          | null              |
| saved_contracts          | notes                  | text                     | YES         | null              |
| saved_contracts          | contract_data          | jsonb                    | YES         | null              |
| saved_contracts          | created_at             | timestamp with time zone | NO          | now()             |




## Security Policies

| tablename       | policyname                           | cmd    | roles    | qual                   | with_check             |
| --------------- | ------------------------------------ | ------ | -------- | ---------------------- | ---------------------- |
| saved_contracts | Users can delete their own contracts | DELETE | {public} | (auth.uid() = user_id) | null                   |
| saved_contracts | Users can insert their own contracts | INSERT | {public} | null                   | (auth.uid() = user_id) |
| saved_contracts | Users can update their own contracts | UPDATE | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| saved_contracts | Users can view their own contracts   | SELECT | {public} | (auth.uid() = user_id) | null                   |
| profiles        | Users can view their own profile     | SELECT | {public} | (auth.uid() = id)      | null                   |




## Triggers

| event_object_schema | event_object_table | trigger_name              | action_timing | event_manipulation | action_statement                         |
| ------------------- | ------------------ | ------------------------- | ------------- | ------------------ | ---------------------------------------- |
| auth                | users              | on_auth_user_created      | AFTER         | INSERT             | EXECUTE FUNCTION handle_new_user()       |
| auth                | sessions           | trg_enforce_session_limit | AFTER         | INSERT             | EXECUTE FUNCTION enforce_session_limit() |




## Column Permissions on Profiles

| grantee       | column_name            | privilege_type |
| ------------- | ---------------------- | -------------- |
| postgres      | cancel_at_period_end   | INSERT         |
| postgres      | cancel_at_period_end   | REFERENCES     |
| postgres      | cancel_at_period_end   | SELECT         |
| postgres      | cancel_at_period_end   | UPDATE         |
| postgres      | comp_access            | INSERT         |
| postgres      | comp_access            | REFERENCES     |
| postgres      | comp_access            | SELECT         |
| postgres      | comp_access            | UPDATE         |
| postgres      | created_at             | INSERT         |
| postgres      | created_at             | REFERENCES     |
| postgres      | created_at             | SELECT         |
| postgres      | created_at             | UPDATE         |
| postgres      | current_period_end     | INSERT         |
| postgres      | current_period_end     | REFERENCES     |
| postgres      | current_period_end     | SELECT         |
| postgres      | current_period_end     | UPDATE         |
| postgres      | email                  | INSERT         |
| postgres      | email                  | REFERENCES     |
| postgres      | email                  | SELECT         |
| postgres      | email                  | UPDATE         |
| postgres      | grace_period_ends_at   | INSERT         |
| postgres      | grace_period_ends_at   | REFERENCES     |
| postgres      | grace_period_ends_at   | SELECT         |
| postgres      | grace_period_ends_at   | UPDATE         |
| postgres      | id                     | INSERT         |
| postgres      | id                     | REFERENCES     |
| postgres      | id                     | SELECT         |
| postgres      | id                     | UPDATE         |
| postgres      | normalized_email       | INSERT         |
| postgres      | normalized_email       | REFERENCES     |
| postgres      | normalized_email       | SELECT         |
| postgres      | normalized_email       | UPDATE         |
| postgres      | payment_failed_at      | INSERT         |
| postgres      | payment_failed_at      | REFERENCES     |
| postgres      | payment_failed_at      | SELECT         |
| postgres      | payment_failed_at      | UPDATE         |
| postgres      | stripe_customer_id     | INSERT         |
| postgres      | stripe_customer_id     | REFERENCES     |
| postgres      | stripe_customer_id     | SELECT         |
| postgres      | stripe_customer_id     | UPDATE         |
| postgres      | subscription_event_at  | INSERT         |
| postgres      | subscription_event_at  | REFERENCES     |
| postgres      | subscription_event_at  | SELECT         |
| postgres      | subscription_event_at  | UPDATE         |
| postgres      | subscription_status    | INSERT         |
| postgres      | subscription_status    | REFERENCES     |
| postgres      | subscription_status    | SELECT         |
| postgres      | subscription_status    | UPDATE         |
| postgres      | trial_ends_at          | INSERT         |
| postgres      | trial_ends_at          | REFERENCES     |
| postgres      | trial_ends_at          | SELECT         |
| postgres      | trial_ends_at          | UPDATE         |
| postgres      | trial_followup_sent_at | INSERT         |
| postgres      | trial_followup_sent_at | REFERENCES     |
| postgres      | trial_followup_sent_at | SELECT         |
| postgres      | trial_followup_sent_at | UPDATE         |
| anon          | cancel_at_period_end   | REFERENCES     |
| anon          | comp_access            | REFERENCES     |
| anon          | created_at             | REFERENCES     |
| anon          | current_period_end     | REFERENCES     |
| anon          | email                  | REFERENCES     |
| anon          | grace_period_ends_at   | REFERENCES     |
| anon          | id                     | REFERENCES     |
| anon          | normalized_email       | REFERENCES     |
| anon          | payment_failed_at      | REFERENCES     |
| anon          | stripe_customer_id     | REFERENCES     |
| anon          | subscription_event_at  | REFERENCES     |
| anon          | subscription_status    | REFERENCES     |
| anon          | trial_ends_at          | REFERENCES     |
| anon          | trial_followup_sent_at | REFERENCES     |
| authenticated | cancel_at_period_end   | REFERENCES     |
| authenticated | cancel_at_period_end   | SELECT         |
| authenticated | comp_access            | REFERENCES     |
| authenticated | comp_access            | SELECT         |
| authenticated | created_at             | REFERENCES     |
| authenticated | created_at             | SELECT         |
| authenticated | current_period_end     | REFERENCES     |
| authenticated | current_period_end     | SELECT         |
| authenticated | email                  | REFERENCES     |
| authenticated | email                  | SELECT         |
| authenticated | grace_period_ends_at   | REFERENCES     |
| authenticated | grace_period_ends_at   | SELECT         |
| authenticated | id                     | REFERENCES     |
| authenticated | id                     | SELECT         |
| authenticated | normalized_email       | REFERENCES     |
| authenticated | normalized_email       | SELECT         |
| authenticated | payment_failed_at      | REFERENCES     |
| authenticated | payment_failed_at      | SELECT         |
| authenticated | stripe_customer_id     | REFERENCES     |
| authenticated | stripe_customer_id     | SELECT         |
| authenticated | subscription_event_at  | REFERENCES     |
| authenticated | subscription_event_at  | SELECT         |
| authenticated | subscription_status    | REFERENCES     |
| authenticated | subscription_status    | SELECT         |
| authenticated | trial_ends_at          | REFERENCES     |
| authenticated | trial_ends_at          | SELECT         |
| authenticated | trial_followup_sent_at | REFERENCES     |
| authenticated | trial_followup_sent_at | SELECT         |
| service_role  | cancel_at_period_end   | REFERENCES     |
| service_role  | cancel_at_period_end   | SELECT         |

