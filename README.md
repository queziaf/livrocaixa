# Livro-caixa

App pessoal de controle de gastos e receitas mensais. Os dados ficam
salvos na nuvem (Supabase), então funcionam em qualquer dispositivo onde
você fizer login com a mesma conta.

## Arquivos
- `login.html` — tela de login/cadastro
- `index.html` — painel mensal (contas do mês, receitas)
- `contas-fixas.html` — página de gerenciamento das contas fixas
- `graficos.html` — página de gráficos e visão anual
- `styles.css` — visual, compartilhado por todas as páginas
- `supabase-config.js` — credenciais do seu projeto Supabase
- `supabase-client.js` — cria a conexão com o Supabase a partir da config acima
- `data.js` — dados e regras compartilhadas (ler/escrever no Supabase)
- `auth.js` — protege as páginas internas (exige login) e trata o botão "Sair"
- `app.js` — lógica do painel mensal
- `contas-fixas.js` — lógica da página de contas fixas
- `graficos.js` — lógica da página de gráficos
- `login.js` — lógica da tela de login/cadastro
- `schema.sql` — script para criar as tabelas no Supabase (rodar uma única vez)

## Configuração do Supabase (uma vez só)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com)
2. No painel do projeto, vá em **SQL Editor** → **New query**, cole o
   conteúdo do arquivo `schema.sql` e clique em **Run**. Isso cria as
   tabelas e as regras de segurança (cada pessoa só vê os próprios dados).
3. Vá em **Project Settings** → **API** e copie:
   - **Project URL**
   - **anon public key**
4. Cole esses dois valores no arquivo `supabase-config.js` (já vem
   preenchido se foi o Claude quem configurou para você).
5. (Opcional) Em **Authentication** → **Providers** → **Email**, você pode
   desativar a exigência de confirmação por e-mail, para simplificar o
   primeiro acesso. Por padrão, o Supabase manda um e-mail de confirmação
   ao criar a conta.

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
  Supabase, associados à sua conta — não dependem mais do navegador.
- Cada pessoa só enxerga os próprios dados (protegido por regras de
  segurança no banco).
- As 10 contas fixas da sua planilha original já vêm pré-cadastradas na
  primeira vez que você faz login (gerenciadas na página "Contas fixas").
  Você pode editar o valor de cada uma mês a mês (elas variam) no painel
  mensal, adicionar novas contas fixas, contas avulsas, e lançar receitas
  por categoria.
- **Importante:** o `supabase-config.js` tem a chave pública ("anon key")
  do seu projeto. Ela é segura para ficar em um repositório público — as
  regras de segurança do banco (Row Level Security) que impedem qualquer
  pessoa de ver ou mexer nos dados de outra conta, mesmo tendo essa chave.
