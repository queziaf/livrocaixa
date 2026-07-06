/* Livro-caixa — cria o cliente do Supabase.
   Deve ser incluído depois da biblioteca @supabase/supabase-js e depois de
   supabase-config.js, e antes de data.js, auth.js e do script da página. */

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
