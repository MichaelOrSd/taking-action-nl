// Public configuration for this Taking Action NL instance.
// The anon key is safe to publish: it can only do what the database's
// row-level security rules allow (insert a signature, read public counts).
// Replace both values with your own Supabase project's after running
// supabase/schema.sql. See README.md.
window.TA = window.TA || {};
window.TA.supabaseUrl = "https://YOUR-PROJECT.supabase.co";
window.TA.supabaseAnonKey = "YOUR-ANON-KEY";
