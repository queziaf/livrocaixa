# Especificação: App de controle de gastos pessoais

## Objetivo
App web pessoal para substituir a planilha de controle financeiro. Permite
registrar gastos mensais (fixos e variáveis), marcar o que já foi pago,
registrar receitas por categoria e comparar meses ao longo do ano para saber
se o saldo está positivo ou negativo.

## Escopo técnico
- Uso individual, em um único computador (não precisa funcionar em múltiplos
  dispositivos).
- Aplicação web estática (HTML/CSS/JS ou React), **sem backend**.
- Persistência de dados via `localStorage` do navegador.
- Hospedagem: repositório no GitHub + GitHub Pages (deploy gratuito e simples
  para um app estático).

## Dados iniciais (pré-cadastrados)

### Gastos recorrentes (categoria: despesa fixa)
| Descrição | Dia de vencimento | Valor de referência |
|---|---|---|
| Condomínio | 10 | R$ 350,00 |
| Financiamento Caixa | 16 | R$ 3.512,54 |
| Cartão Nubank | 17 | R$ 1.471,22 |
| Cartão Caixa | 17 | R$ 5.376,78 |
| Empréstimo Nubank | 17 | R$ 1.132,93 |
| Empréstimo Itaú | 18 | R$ 3.262,45 |
| IPTU Cotia Casa | 20 | R$ 138,02 |
| Água | 20 | R$ 40,62 |
| Luz | 21 | R$ 369,13 |
| Internet Fibra | 25 | R$ 79,99 |

O usuário deve poder editar o valor de cada gasto recorrente mês a mês
(o valor real varia mensalmente, "valor de referência" é só um chute inicial),
além de adicionar novos gastos (fixos ou avulsos) e remover os que não usa.

### Categorias de receita (renda mensal)
- Salário
- Adiantamento
- Férias
- ⅓ (terço de férias)
- Outros

Cada categoria de receita pode ter datas de recebimento diferentes dentro do
mês — o usuário lança o valor recebido em cada categoria conforme o dinheiro
entra.

## Funcionalidades

### 1. Dashboard do mês atual
- Card com total gasto no mês
- Card com total de renda recebida no mês
- Card de saldo (renda − gastos), com destaque visual quando negativo
- Comparação percentual com o mês anterior (gastando mais ou menos)

### 2. Lista de contas do mês
- Cada gasto mostra: descrição, dia de vencimento, valor, status (pago/não
  pago via checkbox)
- Destaque visual para contas próximas do vencimento (ex.: nos próximos 3
  dias) ainda não pagas
- Botão para adicionar novo gasto (nome, valor, dia de vencimento, se é
  recorrente ou avulso)
- Editar ou remover gastos existentes

### 3. Registro de receitas
- Lançamento de valores recebidos por categoria (Salário, Adiantamento,
  Férias, ⅓, Outros), com data de recebimento
- Possibilidade de adicionar novas categorias de receita

### 4. Visão anual / comparação entre meses
- Gráfico ou tabela com o total gasto em cada mês do ano
- Gráfico ou tabela com o saldo (renda − gastos) de cada mês
- Comparação lado a lado entre dois meses escolhidos pelo usuário

### 5. Navegação entre meses
- O usuário pode navegar para meses anteriores/futuros e ver/editar os dados
  daquele mês especificamente

## Modelo de dados (sugestão)
```
Despesa {
  id
  descricao
  categoria: "fixa" | "avulsa"
  diaVencimento
  valor
  mes
  ano
  pago: boolean
}

Receita {
  id
  categoria: "Salário" | "Adiantamento" | "Férias" | "⅓" | "Outros" | custom
  valor
  dataRecebimento
  mes
  ano
}
```

## Prompt sugerido para dar ao Claude Code
> Crie um app web (HTML/CSS/JS puro, sem backend, dados salvos em
> localStorage) seguindo a especificação no arquivo
> especificacao-app-controle-gastos.md. Depois de criar e testar
> localmente, inicialize um repositório git, crie um repositório no GitHub
> chamado "controle-gastos" e faça o push do projeto. Em seguida, configure
> o GitHub Pages para publicar o app a partir da branch main.

## Próximos passos
1. Instale o Claude Code (se ainda não tiver): `npm install -g @anthropic-ai/claude-code`
2. Crie uma pasta para o projeto e rode `claude` dentro dela
3. Cole este arquivo na pasta do projeto e use o prompt sugerido acima
4. Acompanhe o Claude Code criar o app, testar localmente, subir pro GitHub
   e publicar no GitHub Pages
