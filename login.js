/* Livro-caixa — login e cadastro via Neon Auth.
   Depende de neon-config.js e neon-client.js, incluídos antes
   deste arquivo. */

const form = document.getElementById("authForm");
const messageEl = document.getElementById("authMessage");
const titleEl = document.getElementById("authTitle");
const submitEl = document.getElementById("authSubmit");
const toggleEl = document.getElementById("toggleMode");

let mode = "login";

function updateModeUI() {
  titleEl.textContent = mode === "login" ? "Entrar" : "Criar conta";
  submitEl.textContent = mode === "login" ? "Entrar" : "Criar conta";
  toggleEl.textContent = mode === "login" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar";
  messageEl.textContent = "";
  messageEl.classList.remove("ok");
}

toggleEl.addEventListener("click", (e) => {
  e.preventDefault();
  mode = mode === "login" ? "signup" : "login";
  updateModeUI();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.textContent = "";
  messageEl.classList.remove("ok");

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  submitEl.disabled = true;
  await neonClientReady;

  if (mode === "login") {
    const { error } = await neonClient.auth.signInWithPassword({ email, password });
    submitEl.disabled = false;
    if (error) { messageEl.textContent = "Erro: " + error.message; return; }
    location.href = "index.html";
  } else {
    const { error } = await neonClient.auth.signUp({ email, password });
    submitEl.disabled = false;
    if (error) { messageEl.textContent = "Erro: " + error.message; return; }
    mode = "login";
    updateModeUI();
    messageEl.textContent = "Conta criada. Agora é só entrar com o e-mail e senha.";
    messageEl.classList.add("ok");
  }
});

/* Se já estiver logado, pula direto pro app */
(async () => {
  await neonClientReady;
  const { data: sessionData } = await neonClient.auth.getSession();
  if (sessionData && sessionData.session) location.href = "index.html";
})();

updateModeUI();
