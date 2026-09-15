# Livro-caixa

App pessoal de controle de gastos e receitas mensais. Os dados ficam
salvos na nuvem (Supabase), então funcionam em qualquer dispositivo onde
você fizer login com a mesma conta.

**Nota:** o app estava em processo de migração para o Neon (por causa da
pausa por inatividade do plano gratuito do Supabase), mas voltou
temporariamente pro Supabase por causa de um erro (`"jwk not found"`) do
lado do Neon, ainda sem solução confirmada com o suporte deles. Os
arquivos da versão Neon (`neon-config.js`, `neon-client.js`,
`schema-neon.sql`) não estão em uso agora, mas ficam disponíveis para
quando o problema for resolvido.

## Arquivos
- `login.html` — tela de login/cadastro
- `index.html` — painel mensal (contas do mês, receitas)
- `contas-fixas.html` — página de gerenciamento das contas fixas
- `graficos.html` — página de gráficos e visão anual
- `styles.css` — visual, compartilhado por todas as páginas
- `neon-config.js` — URLs do seu projeto Neon (Auth e Data API)
- `neon-client.js` — cria a conexão com o Neon a partir da config acima
- `data.js` — dados e regras compartilhadas (ler/escrever no Neon)
- `auth.js` — protege as páginas internas (exige login) e trata o botão "Sair"
- `app.js` — lógica do painel mensal
- `contas-fixas.js` — lógica da página de contas fixas
- `graficos.js` — lógica da página de gráficos
- `login.js` — lógica da tela de login/cadastro
- `schema-neon.sql` — script para criar as tabelas no Neon (rodar uma única vez)
- `schema.sql` / `fix-duplicatas.sql` — versões antigas, específicas do
  Supabase; mantidas só como histórico, não são mais usadas

## Configuração do Neon (uma vez só)

1. Crie uma conta gratuita em [console.neon.tech](https://console.neon.tech)
   e crie um projeto novo.
2. Vá na aba **Auth** do projeto → **Enable Auth** (login por e-mail/senha).
   Depois de habilitado, copie a **Auth Base URL** na aba **Configuration**.
3. Vá na aba **Data API** → **Enable**, marcando **Use Managed Better Auth**
   e **Grant public schema access**. Copie a **Data API URL** mostrada ali.
4. Cole essas duas URLs no arquivo `neon-config.js` (já vem preenchido se
   foi o Claude quem configurou para você).
5. Vá na aba **SQL Editor**, cole o conteúdo do arquivo `schema-neon.sql`
   e rode. Isso cria as tabelas e as regras de segurança (cada pessoa só
   vê os próprios dados).

## Como usar
1. Abra `login.html` e crie sua conta (e-mail + senha)
2. Depois de logado, você é levado ao painel mensal (`index.html`)
3. Acesse de qualquer outro dispositivo, faça login com a mesma conta, e
   os mesmos dados aparecem

## Como publicar no GitHub Pages (grátis)

1. Crie uma conta no [github.com](https://github.com) se ainda não tiver.
2. Crie um novo repositório (pode ser público), por exemplo `livro-caixa`.
   **Não** marque a opção de criar um README automático.
3. No terminal, dentro desta pasta, rode:
   ```
   git init
   git add .
   git commit -m "primeira versão do livro-caixa"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/livro-caixa.git
   git push -u origin main
   ```
   (troque `SEU-USUARIO` pelo seu nome de usuário no GitHub — o link exato
   aparece na página do repositório recém-criado, no botão verde "Code")
4. No GitHub, entre no repositório → **Settings** → **Pages**.
5. Em "Build and deployment", em **Source**, escolha **Deploy from a
   branch**. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique
   em **Save**.
6. Espere cerca de 1 minuto. O GitHub mostrará o link do site, algo como:
   `https://seu-usuario.github.io/livro-caixa/`
7. Acesse pelo link e comece por `login.html` (ex:
   `https://seu-usuario.github.io/livro-caixa/login.html`)

## Atualizando depois de mudanças
Sempre que editar o código (ou pedir para o Claude editar), suba de novo com:
```
git add .
git commit -m "descreva o que mudou"
git push
```

## Sobre os dados
- Os gastos, receitas e contas fixas ficam salvos no banco de dados do
  Neon, associados à sua conta — não dependem mais do navegador.
- Cada pessoa só enxerga os próprios dados (protegido por regras de
  segurança no banco — Row Level Security, usando `auth.user_id()`).
- As 10 contas fixas da sua planilha original já vêm pré-cadastradas na
  primeira vez que você faz login (gerenciadas na página "Contas fixas").
  Você pode editar o valor de cada uma mês a mês (elas variam) no painel
  mensal, adicionar novas contas fixas, contas avulsas, e lançar receitas
  por categoria.
- As sessões de login duram por volta de 15 minutos antes de precisar
  renovar — a biblioteca do Neon faz essa renovação sozinha, então na
  prática você não deve perceber isso enquanto usa o app.
