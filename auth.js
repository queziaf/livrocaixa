/* Livro-caixa — guarda de autenticação das páginas internas
   (index.html, contas-fixas.html, graficos.html).
   Depende de neon-client.js e data.js, incluídos antes deste arquivo.
   Se não houver sessão ativa, redireciona para login.html. Se houver,
   carrega os dados do Neon e então chama window.__initPage(), que
   cada página define como sua função de renderização inicial. */

async function afterLogin() {
  await fetchAllData();

  const hasLocalBackup = !!localStorage.getItem(LOCAL_BACKUP_KEY);
  const alreadyHasCloudData = data.expenses.some(e => e.valor > 0 || e.pago) || data.incomes.length > 0;

  if (hasLocalBackup && !alreadyHasCloudData) {
    const quer = confirm(
      "Encontrei dados salvos neste navegador de uma versão anterior do app.\n\n" +
      "Quer importar esses dados para sua conta agora? (isso só é oferecido uma vez)"
    );
    if (quer) {
      await migrateLocalDataToCloud();
      await fetchAllData();
    }
  }

  if (window.__initPage) window.__initPage();
}

(async function guardPage() {
  await neonClientReady;
  const { data: sessionData, error } = await neonClient.auth.getSession();
  if (error || !sessionData.session) {
    location.href = "login.html";
    return;
  }
  await afterLogin();
})();

const logoutLink = document.getElementById("logoutLink");
if (logoutLink) {
  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await neonClientReady;
    await neonClient.auth.signOut();
    location.href = "login.html";
  });
}
