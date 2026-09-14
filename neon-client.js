/* Livro-caixa — cria o cliente do Neon (Auth + Data API).
   Depende de neon-config.js, incluído antes deste arquivo.

   Usa import() dinâmico para carregar a biblioteca (assim nenhuma página
   precisa virar <script type="module">, e o resto do app continua igual).
   Qualquer código que use `neonClient` deve primeiro esperar a promise
   `neonClientReady` — é isso que os outros arquivos (data.js, auth.js,
   login.js) já fazem. */

let neonClient = null;

const neonClientReady = (async () => {
  const { createClient, SupabaseAuthAdapter } = await import(
    "https://cdn.jsdelivr.net/npm/@neondatabase/neon-js@0.7.0-beta/+esm"
  );
  neonClient = createClient({
    auth: { url: NEON_AUTH_URL, adapter: SupabaseAuthAdapter() },
    dataApi: { url: NEON_DATA_API_URL },
  });
  return neonClient;
})();
