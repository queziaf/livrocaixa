/* Livro-caixa — controle de gastos e receitas pessoais
   Todos os dados são salvos no localStorage do navegador. */

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
    try { return JSON.parse(raw); } catch (e) { /* fall through to defaults */ }
  }
  return {
    recurring: DEFAULT_RECURRING.map(r => ({ id: uid(), ...r })),
    expenses: [],       // { id, recurringId|null, mes, ano, descricao, dia, valor, pago }
    incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
    incomes: [],         // { id, categoria, mes, ano, dia, valor }
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

/* Migração única: versões anteriores copiavam o valor de referência para
   contas novas. Zera apenas as que ainda não foram marcadas como pagas —
   o que já foi pago/editado de propósito não é tocado. */
(function migrateZeroDefaults() {
  let changed = false;
  data.expenses.forEach(e => {
    if (!e.recurringId || e.pago) return;
    const rec = data.recurring.find(r => r.id === e.recurringId);
    if (rec && e.valor === rec.valor) {
      e.valor = 0;
      changed = true;
    }
  });
  if (changed) saveData();
})();

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed

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
   comparação de janeiro) tenham as contas fixas geradas — sem isso, o
   gráfico anual e a comparação "vs. mês anterior" ficavam mostrando meses
   ainda não visitados como zerados. */
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

/* ---------- Render ---------- */

function render() {
  ensureYearExpenses(viewYear);
  renderHeader();
  renderSummary();
  renderExpenses();
  renderIncomes();
  renderYear();
  renderRecurring();
}

function renderHeader() {
  document.getElementById("monthLabel").textContent =
    `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  document.getElementById("yearLabel").textContent = viewYear;
}

function renderSummary() {
  const gasto = totalExpenses(viewYear, viewMonth);
  const renda = totalIncome(viewYear, viewMonth);
  const saldo = renda - gasto;

  let prevMonth = viewMonth - 1, prevYear = viewYear;
  if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
  const gastoPrev = totalExpenses(prevYear, prevMonth);
  let variacaoTxt = "—";
  let variacaoClass = "";
  if (gastoPrev > 0) {
    const variacao = ((gasto - gastoPrev) / gastoPrev) * 100;
    variacaoTxt = (variacao > 0 ? "+" : "") + variacao.toFixed(1) + "%";
    variacaoClass = variacao > 0 ? "negative" : "positive";
  }

  const el = document.getElementById("summary");
  el.innerHTML = `
    <div class="stat">
      <div class="label">Gasto do mês</div>
      <div class="value">${fmtMoney(gasto)}</div>
    </div>
    <div class="stat">
      <div class="label">Renda do mês</div>
      <div class="value">${fmtMoney(renda)}</div>
    </div>
    <div class="stat ${saldo < 0 ? "negative" : "positive"}">
      <div class="label">Saldo do mês</div>
      <div class="value">${fmtMoney(saldo)}</div>
    </div>
    <div class="stat ${variacaoClass}">
      <div class="label">Vs. mês anterior</div>
      <div class="value">${variacaoTxt}</div>
    </div>
  `;
}

function diffDays(year, month, day) {
  const target = new Date(year, month, day);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

/* ---------- Tabela: contas do mês (edição inline) ---------- */

function renderExpenses() {
  const body = document.getElementById("expenseBody");
  const list = expensesForMonth(viewYear, viewMonth);
  if (list.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="empty">Nenhuma conta cadastrada neste mês.</td></tr>`;
    return;
  }
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  body.innerHTML = list.map(e => {
    const days = diffDays(viewYear, viewMonth, e.dia);
    let rowClass = "";
    if (!e.pago && isCurrentMonth) {
      if (days < 0) rowClass = "overdue";
      else if (days <= 3) rowClass = "due-soon";
    }
    const rec = e.recurringId ? data.recurring.find(r => r.id === e.recurringId) : null;
    const placeholder = rec ? `ref. ${fmtMoney(rec.valor)}` : "0,00";
    return `
      <tr class="${rowClass}">
        <td><input type="checkbox" data-expense-id="${e.id}" ${e.pago ? "checked" : ""} /></td>
        <td class="desc-cell">
          <input class="cell-input" type="text" data-focus-id="desc-${e.id}"
                 data-field="descricao" data-id="${e.id}" value="${escapeAttr(e.descricao)}" />
        </td>
        <td class="dia-cell meta">
          <input class="cell-input dia-input" type="number" min="1" max="31" data-focus-id="dia-${e.id}"
                 data-field="dia" data-id="${e.id}" value="${e.dia}" />
        </td>
        <td class="amount-cell amount">
          <input class="cell-input amount-input" type="number" step="0.01" data-focus-id="valor-${e.id}"
                 data-field="valor" data-id="${e.id}" value="${e.valor === 0 ? "" : e.valor}"
                 placeholder="${placeholder}" />
        </td>
        <td class="row-actions">
          <button class="btn ghost" data-delete-expense="${e.id}" aria-label="Remover">remover</button>
        </td>
      </tr>
    `;
  }).join("");
}

/* ---------- Tabela: receitas do mês (edição inline) ---------- */

function renderIncomes() {
  const body = document.getElementById("incomeBody");
  const list = incomesForMonth(viewYear, viewMonth);
  if (list.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma receita lançada neste mês.</td></tr>`;
    return;
  }
  body.innerHTML = list.map(i => `
    <tr>
      <td class="desc-cell">
        <select class="cell-input" data-focus-id="cat-${i.id}" data-field="categoria" data-id="${i.id}">
          ${data.incomeCategories.map(c =>
            `<option value="${escapeAttr(c)}" ${c === i.categoria ? "selected" : ""}>${c}</option>`
          ).join("")}
          <option value="__nova__">+ nova categoria…</option>
        </select>
      </td>
      <td class="dia-cell meta">
        <input class="cell-input dia-input" type="number" min="1" max="31" data-focus-id="dia-${i.id}"
               data-field="dia" data-id="${i.id}" value="${i.dia}" />
      </td>
      <td class="amount-cell amount">
        <input class="cell-input amount-input" type="number" step="0.01" data-focus-id="valor-${i.id}"
               data-field="valor" data-id="${i.id}" value="${i.valor === 0 ? "" : i.valor}" placeholder="0,00" />
      </td>
      <td class="row-actions">
        <button class="btn ghost" data-delete-income="${i.id}">remover</button>
      </td>
    </tr>
  `).join("");
}

function renderYear() {
  const container = document.getElementById("yearBars");
  const totals = [];
  for (let m = 0; m < 12; m++) {
    totals.push({
      gasto: totalExpenses(viewYear, m),
      saldo: totalIncome(viewYear, m) - totalExpenses(viewYear, m),
    });
  }
  const maxGasto = Math.max(1, ...totals.map(t => t.gasto));
  container.innerHTML = totals.map((t, m) => {
    const heightPct = Math.max(2, (t.gasto / maxGasto) * 100);
    const isCurrent = m === viewMonth;
    const negative = t.saldo < 0;
    return `
      <div class="bar-col ${isCurrent ? "current" : ""} ${negative ? "negative" : ""}" data-goto-month="${m}" title="${MONTH_NAMES[m]}: gasto ${fmtMoney(t.gasto)}, saldo ${fmtMoney(t.saldo)}">
        <div class="bar" style="height:${heightPct}%"></div>
        <div class="m-label">${MONTH_NAMES[m].slice(0, 3)}</div>
      </div>
    `;
  }).join("");
}

/* ---------- Tabela: contas fixas (edição inline) ---------- */

function renderRecurring() {
  const body = document.getElementById("recurringBody");
  if (data.recurring.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma conta fixa cadastrada.</td></tr>`;
    return;
  }
  body.innerHTML = data.recurring.map(r => `
    <tr>
      <td class="desc-cell">
        <input class="cell-input" type="text" data-focus-id="rdesc-${r.id}"
               data-field="descricao" data-id="${r.id}" value="${escapeAttr(r.descricao)}" />
      </td>
      <td class="dia-cell meta">
        <input class="cell-input dia-input" type="number" min="1" max="31" data-focus-id="rdia-${r.id}"
               data-field="dia" data-id="${r.id}" value="${r.dia}" />
      </td>
      <td class="amount-cell amount">
        <input class="cell-input amount-input" type="number" step="0.01" data-focus-id="rvalor-${r.id}"
               data-field="valor" data-id="${r.id}" value="${r.valor}" />
      </td>
      <td class="row-actions">
        <button class="btn ghost" data-delete-recurring="${r.id}">remover</button>
      </td>
    </tr>
  `).join("");
}

/* ---------- Navegação de mês ---------- */

document.getElementById("prevMonth").addEventListener("click", () => {
  viewMonth -= 1;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  render();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  viewMonth += 1;
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  render();
});

document.getElementById("yearBars").addEventListener("click", (e) => {
  const col = e.target.closest("[data-goto-month]");
  if (!col) return;
  viewMonth = parseInt(col.dataset.gotoMonth, 10);
  render();
});

/* ---------- Utilitário: Enter tira o foco do campo (dispara "change") ---------- */

function bindEnterBlurs(containerId) {
  document.getElementById(containerId).addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("cell-input")) {
      e.target.blur();
    }
  });
}
bindEnterBlurs("expenseBody");
bindEnterBlurs("incomeBody");
bindEnterBlurs("recurringBody");

/* ---------- Contas do mês: checkbox + edição inline + remover + adicionar ---------- */

document.getElementById("expenseBody").addEventListener("change", (e) => {
  if (e.target.type === "checkbox" && e.target.dataset.expenseId) {
    const exp = data.expenses.find(x => x.id === e.target.dataset.expenseId);
    exp.pago = e.target.checked;
    saveData();
    renderSummary();
    renderExpenses();
    return;
  }

  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const exp = data.expenses.find(x => x.id === id);
  if (!exp) return;

  if (field === "descricao") {
    exp.descricao = e.target.value.trim();
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    exp.dia = (v >= 1 && v <= 31) ? v : exp.dia;
  } else if (field === "valor") {
    const v = parseFloat(e.target.value);
    exp.valor = isNaN(v) ? 0 : v;
  }
  saveData();
  renderSummary();
  renderExpenses();
  renderYear();
});

document.getElementById("expenseBody").addEventListener("click", (e) => {
  const delId = e.target.dataset.deleteExpense;
  if (!delId) return;
  data.expenses = data.expenses.filter(x => x.id !== delId);
  saveData();
  renderSummary();
  renderExpenses();
  renderYear();
});

document.getElementById("addExpenseBtn").addEventListener("click", () => {
  const newExp = {
    id: uid(), recurringId: null, mes: viewMonth, ano: viewYear,
    descricao: "", dia: today.getDate(), valor: 0, pago: false,
  };
  data.expenses.push(newExp);
  saveData();
  renderSummary();
  renderExpenses();
  renderYear();
  const el = document.querySelector(`[data-focus-id="desc-${newExp.id}"]`);
  if (el) el.focus();
});

/* ---------- Receitas do mês: edição inline + remover + adicionar ---------- */

document.getElementById("incomeBody").addEventListener("change", (e) => {
  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const inc = data.incomes.find(x => x.id === id);
  if (!inc) return;

  if (field === "categoria") {
    if (e.target.value === "__nova__") {
      const nome = prompt("Nome da nova categoria de receita:");
      if (nome && nome.trim()) {
        const nomeTrim = nome.trim();
        if (!data.incomeCategories.includes(nomeTrim)) {
          data.incomeCategories.push(nomeTrim);
        }
        inc.categoria = nomeTrim;
        saveData();
      }
      renderIncomes();
      return;
    }
    inc.categoria = e.target.value;
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    inc.dia = (v >= 1 && v <= 31) ? v : inc.dia;
  } else if (field === "valor") {
    const v = parseFloat(e.target.value);
    inc.valor = isNaN(v) ? 0 : v;
  }
  saveData();
  renderSummary();
  renderIncomes();
  renderYear();
});

document.getElementById("incomeBody").addEventListener("click", (e) => {
  const delId = e.target.dataset.deleteIncome;
  if (!delId) return;
  data.incomes = data.incomes.filter(x => x.id !== delId);
  saveData();
  renderSummary();
  renderIncomes();
  renderYear();
});

document.getElementById("addIncomeBtn").addEventListener("click", () => {
  const newInc = {
    id: uid(), categoria: data.incomeCategories[0], mes: viewMonth, ano: viewYear,
    dia: today.getDate(), valor: 0,
  };
  data.incomes.push(newInc);
  saveData();
  renderSummary();
  renderIncomes();
  renderYear();
  const el = document.querySelector(`[data-focus-id="valor-${newInc.id}"]`);
  if (el) el.focus();
});

/* ---------- Contas fixas: edição inline + remover + adicionar ---------- */

document.getElementById("recurringBody").addEventListener("change", (e) => {
  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const rec = data.recurring.find(x => x.id === id);
  if (!rec) return;

  if (field === "descricao") {
    rec.descricao = e.target.value.trim();
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    rec.dia = (v >= 1 && v <= 31) ? v : rec.dia;
  } else if (field === "valor") {
    const v = parseFloat(e.target.value);
    rec.valor = isNaN(v) ? 0 : v;
  }
  saveData();
  renderRecurring();
  renderExpenses(); // atualiza o placeholder de referência exibido nas contas do mês
});

document.getElementById("recurringBody").addEventListener("click", (e) => {
  const delId = e.target.dataset.deleteRecurring;
  if (!delId) return;
  if (!confirm("Remover esta conta fixa? Ela não será mais gerada em meses futuros (meses já lançados não são alterados).")) return;
  data.recurring = data.recurring.filter(x => x.id !== delId);
  saveData();
  renderRecurring();
});

document.getElementById("addRecurringBtn").addEventListener("click", () => {
  const newRec = { id: uid(), descricao: "", dia: 1, valor: 0 };
  data.recurring.push(newRec);
  saveData();
  ensureYearExpenses(viewYear);
  renderRecurring();
  renderExpenses();
  renderYear();
  const el = document.querySelector(`[data-focus-id="rdesc-${newRec.id}"]`);
  if (el) el.focus();
});

/* ---------- Início ---------- */

render();
