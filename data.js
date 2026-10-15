/* Livro-caixa — dados e regras compartilhadas entre as páginas.
   Depende de supabase-config.js e supabase-client.js. Deve ser incluído antes de
   auth.js e do script de cada página (app.js / contas-fixas.js / graficos.js). */

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
  debts: [],        // dívidas (empréstimos e financiamentos)
  debtEntries: [],  // saldo devedor e amortização de cada dívida, mês a mês
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

/* Insere, mas se alguma linha esbarrar numa trava de unicidade do banco
   (ex: a mesma conta fixa já gerada para o mesmo mês), ignora essa linha
   em silêncio em vez de dar erro — usada para gerar as contas do mês
   automaticamente, protegendo contra criar duplicatas mesmo se a função
   for chamada mais de uma vez ao mesmo tempo. */
async function dbUpsertSkipDuplicates(table, rows, conflictColumns) {
  const { error } = await supabaseClient
    .from(table)
    .upsert(rows, { onConflict: conflictColumns, ignoreDuplicates: true });
  if (error) console.error(`Erro ao gerar registros em "${table}":`, error);
  return !error;
}

/* Carrega tudo do Supabase para dentro de `data`. Semeia com os padrões
   apenas numa conta genuinamente nova (sem NENHUM histórico ainda) — se
   você já usou o app e depois apagou todas as contas fixas de propósito,
   elas não voltam sozinhas. */
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

  const contaGenuinamenteNova = recRes.data.length === 0 && expRes.data.length === 0;

  if (contaGenuinamenteNova) {
    const seed = DEFAULT_RECURRING.map(r => ({ id: uid(), ...r }));
    await dbInsert("recurring", seed.map(r => ({ id: r.id, descricao: r.descricao, dia: r.dia, valor: r.valor })));
    data.recurring = seed;
  } else {
    data.recurring = recRes.data.map(r => ({ id: r.id, descricao: r.descricao, dia: r.dia, valor: Number(r.valor) }));
  }

  if (catRes.data.length === 0 && contaGenuinamenteNova) {
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

  await fetchDebtsData();
}

/* Importa, uma única vez, os dados que existiam no localStorage deste
   navegador (versão anterior do app, antes da sincronização em nuvem). */
async function migrateLocalDataToCloud() {
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

async function dbUpsert(table, rows) {
  const { error } = await supabaseClient.from(table).upsert(rows);
  if (error) console.error(`Erro ao importar em "${table}":`, error);
  return !error;
}

/* ---------- Backup manual (baixar/importar um arquivo .json) ---------- */

/* Baixa um arquivo .json com tudo que está no banco agora — útil como
   segurança, por exemplo se o projeto do Supabase ficar indisponível. */
function exportBackup() {
  const backup = {
    app: "livro-caixa",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    recurring: data.recurring,
    expenses: data.expenses,
    incomeCategories: data.incomeCategories,
    incomes: data.incomes,
    debts: data.debts,
    debtEntries: data.debtEntries,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dataStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `livro-caixa-backup-${dataStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Importa um arquivo .json gerado por exportBackup(). Usa "upsert" (não
   "insert"), então é seguro rodar mais de uma vez com o mesmo arquivo —
   ele atualiza em vez de duplicar. Serve tanto para restaurar num projeto
   novo no Supabase quanto para recuperar depois de perder acesso. */
async function importBackupFile(file) {
  const text = await file.text();
  let backup;
  try {
    backup = JSON.parse(text);
  } catch (e) {
    alert("Esse arquivo não parece ser um backup válido do Livro-caixa.");
    return;
  }
  if (!backup || backup.app !== "livro-caixa" || !Array.isArray(backup.expenses)) {
    alert("Esse arquivo não parece ser um backup válido do Livro-caixa.");
    return;
  }

  if (!confirm(
    "Importar esse backup vai restaurar as contas fixas, contas do mês, " +
    "categorias e receitas dele na sua conta atual (atualiza o que já " +
    "existir com o mesmo id, sem duplicar). Quer continuar?"
  )) return;

  if (backup.recurring?.length) {
    await dbUpsert("recurring", backup.recurring.map(r => ({ id: r.id, descricao: r.descricao, dia: r.dia, valor: r.valor })));
  }
  if (backup.expenses?.length) {
    await dbUpsert("expenses", backup.expenses.map(e => ({
      id: e.id, recurring_id: e.recurringId, mes: e.mes, ano: e.ano,
      descricao: e.descricao, dia: e.dia, valor: e.valor, pago: e.pago,
    })));
  }
  if (backup.incomeCategories?.length) {
    await dbUpsert("income_categories", backup.incomeCategories.map(nome => ({ id: uid(), nome })));
  }
  if (backup.incomes?.length) {
    await dbUpsert("incomes", backup.incomes.map(i => ({
      id: i.id, categoria: i.categoria, mes: i.mes, ano: i.ano, dia: i.dia, valor: i.valor,
    })));
  }

  // Dívidas (backups antigos não têm esses campos — nesse caso não há nada a fazer)
  let faltamTabelasDeDividas = false;
  if (backup.debts?.length || backup.debtEntries?.length) {
    if (!debtsAvailable) {
      faltamTabelasDeDividas = true;
    } else {
      if (backup.debts?.length) {
        await dbUpsert("debts", backup.debts.map(d => ({
          id: d.id, nome: d.nome, tipo: d.tipo, parcela: d.parcela, cor: d.cor, criado_em: d.criadoEm,
        })));
      }
      if (backup.debtEntries?.length) {
        await dbUpsert("debt_entries", backup.debtEntries.map(e => ({
          id: e.id, debt_id: e.debtId, mes: e.mes, ano: e.ano, saldo: e.saldo, amortizacao: e.amortizacao,
        })));
      }
    }
  }

  await fetchAllData();
  if (window.__initPage) window.__initPage();
  alert(
    "Backup importado com sucesso!" +
    (faltamTabelasDeDividas
      ? "\n\nObs.: o backup tem dívidas, mas as tabelas de dívidas ainda não existem no banco. " +
        "Rode o schema-dividas.sql no Supabase e importe o backup de novo para trazê-las."
      : "")
  );
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
  if (toInsert.length) {
    await dbUpsertSkipDuplicates("expenses", toInsert, "user_id,recurring_id,mes,ano");
  }
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

/* ---------- Dívidas (saldo devedor) ---------- */

const DEBT_TYPES = { emprestimo: "Empréstimo", financiamento: "Financiamento" };
const DEBT_COLOR_SLOTS = 5; // cores distintas nos gráficos; da 6ª dívida em diante vira cinza

/* Fica falso enquanto as tabelas de dívidas não existirem no banco (ou se a
   consulta falhar) — assim o resto do app continua funcionando normalmente. */
let debtsAvailable = false;

async function fetchDebtsData() {
  try {
    const [dRes, eRes] = await Promise.all([
      supabaseClient.from("debts").select("*").order("criado_em", { ascending: true }),
      supabaseClient.from("debt_entries").select("*"),
    ]);
    const err = dRes.error || eRes.error;
    if (err) throw err;

    data.debts = dRes.data.map(d => ({
      id: d.id, nome: d.nome, tipo: d.tipo, parcela: Number(d.parcela),
      cor: d.cor, criadoEm: d.criado_em,
    }));
    data.debtEntries = eRes.data.map(e => ({
      id: e.id, debtId: e.debt_id, mes: e.mes, ano: e.ano,
      saldo: e.saldo === null ? null : Number(e.saldo),
      amortizacao: Number(e.amortizacao),
    }));
    debtsAvailable = true;
  } catch (err) {
    debtsAvailable = false;
    data.debts = [];
    data.debtEntries = [];
    console.warn("Tabelas de dívidas indisponíveis (rode o schema-dividas.sql no Supabase):", err);
  }
}

/* Menor posição de cor ainda livre — cada dívida mantém a mesma cor mesmo
   que outra seja removida depois. */
function nextDebtColorSlot() {
  const usadas = new Set(data.debts.map(d => d.cor));
  for (let i = 0; i < DEBT_COLOR_SLOTS; i++) if (!usadas.has(i)) return i;
  return DEBT_COLOR_SLOTS;
}

async function addDebt(debt) {
  data.debts.push(debt);
  return dbInsert("debts", {
    id: debt.id, nome: debt.nome, tipo: debt.tipo, parcela: debt.parcela,
    cor: debt.cor, criado_em: debt.criadoEm,
  });
}

async function updateDebtField(id, field, value) {
  const d = data.debts.find(x => x.id === id);
  if (!d) return;
  d[field] = value;
  await dbUpdate("debts", id, { [field]: value });
}

async function deleteDebt(id) {
  data.debts = data.debts.filter(d => d.id !== id);
  data.debtEntries = data.debtEntries.filter(e => e.debtId !== id);
  await dbDelete("debts", id); // os lançamentos dela somem junto (cascade no banco)
}

function getDebtEntry(debtId, year, month) {
  return data.debtEntries.find(e => e.debtId === debtId && e.ano === year && e.mes === month) || null;
}

/* Grava o lançamento de uma dívida num mês. Cria na primeira vez, atualiza
   depois, e apaga se ficar vazio (sem saldo e sem amortização) — assim não
   sobram linhas "fantasma" no banco. `patch` pode ter `saldo` (número ou
   null) e/ou `amortizacao`. */
async function saveDebtEntry(debtId, year, month, patch) {
  let entry = getDebtEntry(debtId, year, month);
  const isNew = !entry;
  if (isNew) entry = { id: uid(), debtId, mes: month, ano: year, saldo: null, amortizacao: 0 };
  Object.assign(entry, patch);
  const vazio = entry.saldo === null && !(entry.amortizacao > 0);

  if (isNew) {
    if (vazio) return;
    data.debtEntries.push(entry);
    await dbInsert("debt_entries", {
      id: entry.id, debt_id: debtId, mes: month, ano: year,
      saldo: entry.saldo, amortizacao: entry.amortizacao,
    });
  } else if (vazio) {
    data.debtEntries = data.debtEntries.filter(e => e.id !== entry.id);
    await dbDelete("debt_entries", entry.id);
  } else {
    await dbUpdate("debt_entries", entry.id, { saldo: entry.saldo, amortizacao: entry.amortizacao });
  }
}

/* Último saldo anotado de uma dívida até o mês indicado (inclusive). Se você
   não lançou nada num mês, vale o saldo do último mês em que lançou. Devolve
   null se ainda não há nenhum saldo anotado até lá. */
function debtBalanceAt(debtId, year, month) {
  const alvo = year * 12 + month;
  let melhor = null;
  for (const e of data.debtEntries) {
    if (e.debtId !== debtId || e.saldo === null) continue;
    const k = e.ano * 12 + e.mes;
    if (k <= alvo && (!melhor || k > melhor.k)) melhor = { k, saldo: e.saldo, mes: e.mes, ano: e.ano };
  }
  return melhor;
}

/* Primeiro saldo já anotado de uma dívida (ponto de partida do acompanhamento). */
function firstDebtBalance(debtId) {
  let primeiro = null;
  for (const e of data.debtEntries) {
    if (e.debtId !== debtId || e.saldo === null) continue;
    const k = e.ano * 12 + e.mes;
    if (!primeiro || k < primeiro.k) primeiro = { k, saldo: e.saldo, mes: e.mes, ano: e.ano };
  }
  return primeiro;
}

/* Foto do saldo devedor num mês: um item por dívida + o total. */
function debtsSnapshot(year, month) {
  const itens = data.debts.map(debt => {
    const b = debtBalanceAt(debt.id, year, month);
    return {
      debt,
      saldo: b ? b.saldo : null,
      deMes: b ? { mes: b.mes, ano: b.ano } : null,
      exato: !!b && b.mes === month && b.ano === year,
    };
  });
  const total = itens.reduce((soma, it) => soma + (it.saldo || 0), 0);
  return { itens, total };
}

function prevMonthOf(year, month) {
  return month === 0 ? { ano: year - 1, mes: 11 } : { ano: year, mes: month - 1 };
}

/* Os `count` meses terminando em (endYear, endMonth), do mais antigo ao mais novo. */
function debtSeries(endYear, endMonth, count = 12) {
  const serie = [];
  for (let i = count - 1; i >= 0; i--) {
    let m = endMonth - i;
    let y = endYear;
    while (m < 0) { m += 12; y -= 1; }
    serie.push({ ano: y, mes: m, ...debtsSnapshot(y, m) });
  }
  return serie;
}

/* Quanto foi amortizado a mais: no mês, no ano até o mês, e no total até o mês. */
function amortizedTotals(year, month) {
  const alvo = year * 12 + month;
  let noMes = 0, noAno = 0, total = 0;
  for (const e of data.debtEntries) {
    const k = e.ano * 12 + e.mes;
    if (k > alvo) continue;
    total += e.amortizacao;
    if (e.ano === year) noAno += e.amortizacao;
    if (k === alvo) noMes += e.amortizacao;
  }
  return { noMes, noAno, total };
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
