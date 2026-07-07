/* Livro-caixa — dados e regras compartilhadas entre as páginas.
   Depende de supabase-client.js. Deve ser incluído antes de auth.js e do
   script de cada página (app.js / contas-fixas.js / graficos.js). */

const LOCAL_BACKUP_KEY = "livro-caixa-data-v1"; // usado só para a migração única

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

/* Espelho em memória dos dados do usuário logado. Populado por
   fetchAllData() depois do login — veja auth.js. */
let data = {
  recurring: [],
  expenses: [],
  incomeCategories: [],
  incomes: [],
};

const today = new Date();

function fmtMoney(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* Formata um número para exibir dentro dos campos editáveis, sempre com
   separador de milhar e duas casas decimais (ex: 1124 -> "1.124,00"). */
function formatAmount(v) {
  return (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Interpreta o texto digitado num campo de valor. Aceita tanto o formato
   brasileiro ("1.124,00") quanto casos em que o teclado do dispositivo
   insere ponto como decimal ("1124.5") — sem confundir esse ponto com
   separador de milhar. */
function parseAmountInput(str) {
  if (!str) return 0;
  let s = String(str).trim();
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = s.split(".");
    if (partes.length > 2 || (partes.length === 2 && partes[1].length > 2)) {
      // mais de um ponto, ou dígitos demais depois dele: são separadores de milhar
      s = s.replace(/\./g, "");
    }
    // um único ponto com até 2 dígitos depois: já é o decimal, mantém como está
  }
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

/* ---------- Camada de acesso ao Supabase ---------- */

async function dbInsert(table, rows) {
  const { error } = await supabaseClient.from(table).insert(rows);
  if (error) console.error(`Erro ao salvar em "${table}":`, error);
  return !error;
}

async function dbUpdate(table, id, patch) {
  const { error } = await supabaseClient.from(table).update(patch).eq("id", id);
  if (error) console.error(`Erro ao atualizar "${table}":`, error);
  return !error;
}

async function dbDelete(table, id) {
  const { error } = await supabaseClient.from(table).delete().eq("id", id);
  if (error) console.error(`Erro ao remover de "${table}":`, error);
  return !error;
}

/* Carrega tudo do Supabase para dentro de `data`. Na primeira vez que o
   usuário loga (nenhuma conta fixa cadastrada), semeia com os padrões. */
async function fetchAllData() {
  const [recRes, expRes, catRes, incRes] = await Promise.all([
    supabaseClient.from("recurring").select("*"),
    supabaseClient.from("expenses").select("*"),
    supabaseClient.from("income_categories").select("*"),
    supabaseClient.from("incomes").select("*"),
  ]);

  const err = recRes.error || expRes.error || catRes.error || incRes.error;
  if (err) {
    console.error("Erro ao carregar dados do Supabase:", err);
    alert("Não foi possível carregar seus dados agora. Veja o console (F12) para detalhes.");
    return;
  }

  if (recRes.data.length === 0) {
    const seed = DEFAULT_RECURRING.map(r => ({ id: uid(), ...r }));
    await dbInsert("recurring", seed.map(r => ({ id: r.id, descricao: r.descricao, dia: r.dia, valor: r.valor })));
    data.recurring = seed;
  } else {
    data.recurring = recRes.data.map(r => ({ id: r.id, descricao: r.descricao, dia: r.dia, valor: Number(r.valor) }));
  }

  if (catRes.data.length === 0) {
    const seedCats = DEFAULT_INCOME_CATEGORIES.map(nome => ({ id: uid(), nome }));
    await dbInsert("income_categories", seedCats);
    data.incomeCategories = seedCats.map(c => c.nome);
  } else {
    data.incomeCategories = catRes.data.map(c => c.nome);
  }

  data.expenses = expRes.data.map(e => ({
    id: e.id, recurringId: e.recurring_id, mes: e.mes, ano: e.ano,
    descricao: e.descricao, dia: e.dia, valor: Number(e.valor), pago: e.pago,
  }));

  data.incomes = incRes.data.map(i => ({
    id: i.id, categoria: i.categoria, mes: i.mes, ano: i.ano, dia: i.dia, valor: Number(i.valor),
  }));
}

/* Importa, uma única vez, os dados que existiam no localStorage deste
   navegador (versão anterior do app, antes da sincronização em nuvem). */
async function migrateLocalDataToSupabase() {
  const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
  if (!raw) return false;
  let local;
  try { local = JSON.parse(raw); } catch (e) { return false; }

  if (local.recurring?.length) {
    await dbInsert("recurring", local.recurring.map(r => ({ id: r.id, descricao: r.descricao, dia: r.dia, valor: r.valor })));
  }
  if (local.expenses?.length) {
    await dbInsert("expenses", local.expenses.map(e => ({
      id: e.id, recurring_id: e.recurringId, mes: e.mes, ano: e.ano,
      descricao: e.descricao, dia: e.dia, valor: e.valor, pago: e.pago,
    })));
  }
  if (local.incomeCategories?.length) {
    await dbInsert("income_categories", local.incomeCategories.map(nome => ({ id: uid(), nome })));
  }
  if (local.incomes?.length) {
    await dbInsert("incomes", local.incomes.map(i => ({
      id: i.id, categoria: i.categoria, mes: i.mes, ano: i.ano, dia: i.dia, valor: i.valor,
    })));
  }
  localStorage.removeItem(LOCAL_BACKUP_KEY);
  return true;
}

/* ---------- Contas fixas ---------- */

async function addRecurring(rec) {
  data.recurring.push(rec);
  await dbInsert("recurring", { id: rec.id, descricao: rec.descricao, dia: rec.dia, valor: rec.valor });
}

async function updateRecurringField(id, field, value) {
  const rec = data.recurring.find(r => r.id === id);
  if (!rec) return;
  rec[field] = value;
  await dbUpdate("recurring", id, { [field]: value });

  // Propaga descrição/dia para as contas do mês já geradas a partir dela
  if (field === "descricao" || field === "dia") {
    data.expenses.forEach(e => { if (e.recurringId === id) e[field] = value; });
    const { error } = await supabaseClient.from("expenses").update({ [field]: value }).eq("recurring_id", id);
    if (error) console.error("Erro ao propagar alteração da conta fixa:", error);
  }
}

async function deleteRecurring(id) {
  data.recurring = data.recurring.filter(r => r.id !== id);
  data.expenses.forEach(e => { if (e.recurringId === id) e.recurringId = null; });
  await dbDelete("recurring", id);
}

/* ---------- Contas do mês (gastos) ---------- */

async function addExpense(exp) {
  data.expenses.push(exp);
  await dbInsert("expenses", {
    id: exp.id, recurring_id: exp.recurringId, mes: exp.mes, ano: exp.ano,
    descricao: exp.descricao, dia: exp.dia, valor: exp.valor, pago: exp.pago,
  });
}

async function updateExpenseField(id, field, value) {
  const exp = data.expenses.find(e => e.id === id);
  if (!exp) return;
  exp[field] = value;
  await dbUpdate("expenses", id, { [field]: value });
}

async function deleteExpense(id) {
  data.expenses = data.expenses.filter(e => e.id !== id);
  await dbDelete("expenses", id);
}

/* Garante que toda conta fixa tenha uma entrada de gasto no mês indicado */
async function ensureMonthExpenses(year, month) {
  const toInsert = [];
  data.recurring.forEach(rec => {
    const exists = data.expenses.some(e =>
      e.recurringId === rec.id && e.mes === month && e.ano === year
    );
    if (!exists) {
      const novo = {
        id: uid(), recurringId: rec.id, mes: month, ano: year,
        descricao: rec.descricao, dia: rec.dia, valor: 0, pago: false,
      };
      data.expenses.push(novo);
      toInsert.push({
        id: novo.id, recurring_id: novo.recurringId, mes: novo.mes, ano: novo.ano,
        descricao: novo.descricao, dia: novo.dia, valor: novo.valor, pago: novo.pago,
      });
    }
  });
  if (toInsert.length) await dbInsert("expenses", toInsert);
}

/* Garante os 12 meses do ano (e dezembro do ano anterior, usado na
   comparação de janeiro). */
async function ensureYearExpenses(year) {
  for (let m = 0; m < 12; m++) await ensureMonthExpenses(year, m);
  await ensureMonthExpenses(year - 1, 11);
}

function expensesForMonth(year, month) {
  return data.expenses
    .filter(e => e.mes === month && e.ano === year)
    .sort((a, b) => a.dia - b.dia);
}

function totalExpenses(year, month) {
  return expensesForMonth(year, month).reduce((sum, e) => sum + e.valor, 0);
}

/* ---------- Receitas ---------- */

async function addIncome(inc) {
  data.incomes.push(inc);
  await dbInsert("incomes", {
    id: inc.id, categoria: inc.categoria, mes: inc.mes, ano: inc.ano, dia: inc.dia, valor: inc.valor,
  });
}

async function updateIncomeField(id, field, value) {
  const inc = data.incomes.find(i => i.id === id);
  if (!inc) return;
  inc[field] = value;
  await dbUpdate("incomes", id, { [field]: value });
}

async function deleteIncome(id) {
  data.incomes = data.incomes.filter(i => i.id !== id);
  await dbDelete("incomes", id);
}

async function addIncomeCategory(nome) {
  if (data.incomeCategories.includes(nome)) return;
  data.incomeCategories.push(nome);
  await dbInsert("income_categories", { id: uid(), nome });
}

function incomesForMonth(year, month) {
  return data.incomes
    .filter(i => i.mes === month && i.ano === year)
    .sort((a, b) => a.dia - b.dia);
}

function totalIncome(year, month) {
  return incomesForMonth(year, month).reduce((sum, i) => sum + i.valor, 0);
}

/* ---------- Agregações anuais (página de gráficos) ---------- */

function yearTotals(year) {
  const totals = [];
  for (let m = 0; m < 12; m++) {
    const gasto = totalExpenses(year, m);
    const renda = totalIncome(year, m);
    totals.push({ gasto, renda, saldo: renda - gasto });
  }
  return totals;
}

function rankExpensesForYear(year) {
  const map = {};
  for (let m = 0; m < 12; m++) {
    expensesForMonth(year, m).forEach(e => {
      const nome = e.descricao.trim() || "(sem nome)";
      map[nome] = (map[nome] || 0) + e.valor;
    });
  }
  return Object.entries(map)
    .map(([descricao, total]) => ({ descricao, total }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

/* ---------- Utilitário: Enter tira o foco do campo (dispara "change") ---------- */

function bindEnterBlurs(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("cell-input")) {
      e.target.blur();
    }
  });
}

/* Seleciona todo o texto do campo de valor ao focar, pra digitar por cima
   sem precisar apagar manualmente o "1.124,00" que já está lá. */
function bindSelectOnFocus(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener("focusin", (e) => {
    if (e.target.classList.contains("amount-input")) e.target.select();
  });
}
