/* Livro-caixa — dados e regras compartilhadas entre as páginas.
   Este arquivo deve ser incluído ANTES de app.js ou contas-fixas.js. */

const STORAGE_KEY = "livro-caixa-data-v1";

const MONTH_NAMES = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"
];

const DEFAULT_RECURRING = [
  { descricao: "Condomínio", dia: 10, valor: 350.00 },
  { descricao: "Financiamento Caixa", dia: 16, valor: 3512.54 },
  { descricao: "Cartão Nubank", dia: 17, valor: 1471.22 },
  { descricao: "Cartão Caixa", dia: 17, valor: 5376.78 },
  { descricao: "Empréstimo Nubank", dia: 17, valor: 1132.93 },
  { descricao: "Empréstimo Itaú", dia: 18, valor: 3262.45 },
  { descricao: "IPTU Cotia Casa", dia: 20, valor: 138.02 },
  { descricao: "Água", dia: 20, valor: 40.62 },
  { descricao: "Luz", dia: 21, valor: 369.13 },
  { descricao: "Internet Fibra", dia: 25, valor: 79.99 },
];

const DEFAULT_INCOME_CATEGORIES = ["Salário", "Adiantamento", "Férias", "⅓", "Outros"];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* cai para os padrões abaixo */ }
  }
  return {
    recurring: DEFAULT_RECURRING.map(r => ({ id: uid(), ...r })),
    expenses: [],       // { id, recurringId|null, mes, ano, descricao, dia, valor, pago }
    incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
    incomes: [],        // { id, categoria, mes, ano, dia, valor }
    _migratedZeroDefaults: false,
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

/* Migração ÚNICA (roda só uma vez, guardada por uma flag salva nos dados):
   versões antigas do app copiavam o valor de referência para contas novas.
   Zera apenas as que ainda não tinham sido marcadas como pagas na época.
   Sem a flag, isso rodaria toda vez que o app abrisse e apagaria valores
   reais digitados que coincidissem com o valor de referência. */
if (!data._migratedZeroDefaults) {
  data.expenses.forEach(e => {
    if (!e.recurringId || e.pago) return;
    const rec = data.recurring.find(r => r.id === e.recurringId);
    if (rec && e.valor === rec.valor) {
      e.valor = 0;
    }
  });
  data._migratedZeroDefaults = true;
  saveData();
}

const today = new Date();

function fmtMoney(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* Garante que toda conta fixa tenha uma entrada de gasto no mês indicado */
function ensureMonthExpenses(year, month) {
  let changed = false;
  data.recurring.forEach(rec => {
    const exists = data.expenses.some(e =>
      e.recurringId === rec.id && e.mes === month && e.ano === year
    );
    if (!exists) {
      data.expenses.push({
        id: uid(),
        recurringId: rec.id,
        mes: month,
        ano: year,
        descricao: rec.descricao,
        dia: rec.dia,
        valor: 0,
        pago: false,
      });
      changed = true;
    }
  });
  if (changed) saveData();
}

/* Garante que os 12 meses do ano (e dezembro do ano anterior, usado na
   comparação de janeiro) tenham as contas fixas geradas. */
function ensureYearExpenses(year) {
  for (let m = 0; m < 12; m++) ensureMonthExpenses(year, m);
  ensureMonthExpenses(year - 1, 11);
}

function expensesForMonth(year, month) {
  return data.expenses
    .filter(e => e.mes === month && e.ano === year)
    .sort((a, b) => a.dia - b.dia);
}

function incomesForMonth(year, month) {
  return data.incomes
    .filter(i => i.mes === month && i.ano === year)
    .sort((a, b) => a.dia - b.dia);
}

function totalExpenses(year, month) {
  return expensesForMonth(year, month).reduce((sum, e) => sum + e.valor, 0);
}

function totalIncome(year, month) {
  return incomesForMonth(year, month).reduce((sum, i) => sum + i.valor, 0);
}

/* Atualiza um campo de uma conta fixa (descrição/dia/valor). Quando o campo
   é descrição ou dia, propaga a mudança para todas as entradas de gasto já
   geradas a partir dessa conta fixa — sem isso, renomear uma conta fixa não
   refletia nos meses já lançados. O valor não é propagado de propósito: ele
   é só uma referência, o valor real de cada mês é independente. */
function updateRecurringField(id, field, value) {
  const rec = data.recurring.find(r => r.id === id);
  if (!rec) return;
  rec[field] = value;
  if (field === "descricao" || field === "dia") {
    data.expenses.forEach(e => {
      if (e.recurringId === id) e[field] = value;
    });
  }
  saveData();
}

/* Utilitário: pressionar Enter tira o foco do campo (dispara "change") */
function bindEnterBlurs(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("cell-input")) {
      e.target.blur();
    }
  });
}
