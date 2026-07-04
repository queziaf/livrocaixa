# Livro-caixa

App pessoal de controle de gastos e receitas mensais. Roda 100% no navegador,
sem servidor — os dados ficam salvos no `localStorage` do computador onde
você usar o app.

## Como usar localmente
Basta abrir o arquivo `index.html` no navegador (duplo clique já funciona).

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

## Atualizando depois de mudanças
Sempre que editar o código (ou pedir para o Claude editar), suba de novo com:
```
git add .
git commit -m "descreva o que mudou"
git push
```

## Sobre os dados
- Os gastos e receitas ficam salvos apenas no navegador que você usar.
- Se limpar os dados do navegador (cache/localStorage) ou usar outro
  computador, o histórico não estará lá — não é sincronizado na nuvem.
- As 10 contas fixas da sua planilha já vêm pré-cadastradas. Você pode
  editar o valor de cada uma mês a mês (elas variam), adicionar novas
  contas fixas, contas avulsas, e lançar receitas por categoria.
