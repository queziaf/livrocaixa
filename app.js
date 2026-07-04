/* Livro-caixa — painel mensal (index.html).
   Depende de data.js, que deve ser incluído antes deste arquivo. */

let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed

function render() {
  ensureYearExpenses(viewYear);
  renderHeader();
  renderSummary();
  renderExpenses();
  renderIncomes();
}

function renderHeader() {
  document.getElementById("monthLabel").textContent =
    `${MONTH_NAMES[viewMonth]} ${viewYear}`;
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

bindEnterBlurs("expenseBody");
bindEnterBlurs("incomeBody");

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
});

document.getElementById("expenseBody").addEventListener("click", (e) => {
  const delId = e.target.dataset.deleteExpense;
  if (!delId) return;
  data.expenses = data.expenses.filter(x => x.id !== delId);
  saveData();
  renderSummary();
  renderExpenses();
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
});

document.getElementById("incomeBody").addEventListener("click", (e) => {
  const delId = e.target.dataset.deleteIncome;
  if (!delId) return;
  data.incomes = data.incomes.filter(x => x.id !== delId);
  saveData();
  renderSummary();
  renderIncomes();
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
  const el = document.querySelector(`[data-focus-id="valor-${newInc.id}"]`);
  if (el) el.focus();
});

/* ---------- Início ---------- */

render();
