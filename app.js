/* Livro-caixa — painel mensal (index.html).
   Depende de data.js e auth.js, incluídos antes deste arquivo. */

let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed

async function render() {
  await ensureYearExpenses(viewYear);
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

  document.getElementById("summary").innerHTML = `
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
        <td class="check-cell"><input type="checkbox" data-expense-id="${e.id}" ${e.pago ? "checked" : ""} /></td>
        <td class="desc-cell">
          <input class="cell-input" type="text" data-field="descricao" data-id="${e.id}" value="${escapeAttr(e.descricao)}" />
        </td>
        <td class="dia-cell meta">
          <input class="cell-input dia-input" type="number" min="1" max="31" data-field="dia" data-id="${e.id}" value="${e.dia}" />
        </td>
        <td class="amount-cell amount">
          <input class="cell-input amount-input" type="text" inputmode="decimal" data-field="valor" data-id="${e.id}"
                 value="${e.valor === 0 ? "" : formatAmount(e.valor)}" placeholder="${placeholder}" />
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
        <select class="cell-input" data-field="categoria" data-id="${i.id}">
          ${data.incomeCategories.map(c =>
            `<option value="${escapeAttr(c)}" ${c === i.categoria ? "selected" : ""}>${c}</option>`
          ).join("")}
          <option value="__nova__">+ nova categoria…</option>
        </select>
      </td>
      <td class="dia-cell meta">
        <input class="cell-input dia-input" type="number" min="1" max="31" data-field="dia" data-id="${i.id}" value="${i.dia}" />
      </td>
      <td class="amount-cell amount">
        <input class="cell-input amount-input" type="text" inputmode="decimal" data-field="valor" data-id="${i.id}"
               value="${i.valor === 0 ? "" : formatAmount(i.valor)}" placeholder="0,00" />
      </td>
      <td class="row-actions">
        <button class="btn ghost" data-delete-income="${i.id}">remover</button>
      </td>
    </tr>
  `).join("");
}

/* ---------- Navegação de mês ---------- */

document.getElementById("prevMonth").addEventListener("click", async () => {
  viewMonth -= 1;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  await render();
});

document.getElementById("nextMonth").addEventListener("click", async () => {
  viewMonth += 1;
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  await render();
});

bindEnterBlurs("expenseBody");
bindEnterBlurs("incomeBody");
bindSelectOnFocus("expenseBody");
bindSelectOnFocus("incomeBody");

/* ---------- Contas do mês: checkbox + edição inline + remover + adicionar ---------- */

document.getElementById("expenseBody").addEventListener("change", async (e) => {
  if (e.target.type === "checkbox" && e.target.dataset.expenseId) {
    await updateExpenseField(e.target.dataset.expenseId, "pago", e.target.checked);
    renderSummary();
    renderExpenses();
    return;
  }

  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const exp = data.expenses.find(x => x.id === id);
  if (!exp) return;

  let value;
  if (field === "descricao") {
    value = e.target.value.trim();
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    value = (v >= 1 && v <= 31) ? v : exp.dia;
  } else if (field === "valor") {
    value = parseAmountInput(e.target.value);
  }
  await updateExpenseField(id, field, value);
  renderSummary();
  renderExpenses();
});

document.getElementById("expenseBody").addEventListener("click", async (e) => {
  const delId = e.target.dataset.deleteExpense;
  if (!delId) return;
  await deleteExpense(delId);
  renderSummary();
  renderExpenses();
});

document.getElementById("addExpenseBtn").addEventListener("click", async () => {
  const newExp = {
    id: uid(), recurringId: null, mes: viewMonth, ano: viewYear,
    descricao: "", dia: today.getDate(), valor: 0, pago: false,
  };
  await addExpense(newExp);
  renderSummary();
  renderExpenses();
  const el = document.querySelector(`[data-id="${newExp.id}"][data-field="descricao"]`);
  if (el) el.focus();
});

/* ---------- Receitas do mês: edição inline + remover + adicionar ---------- */

document.getElementById("incomeBody").addEventListener("change", async (e) => {
  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const inc = data.incomes.find(x => x.id === id);
  if (!inc) return;

  if (field === "categoria") {
    if (e.target.value === "__nova__") {
      const nome = prompt("Nome da nova categoria de receita:");
      if (nome && nome.trim()) {
        await addIncomeCategory(nome.trim());
        await updateIncomeField(id, "categoria", nome.trim());
      }
      renderIncomes();
      return;
    }
    await updateIncomeField(id, "categoria", e.target.value);
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    await updateIncomeField(id, "dia", (v >= 1 && v <= 31) ? v : inc.dia);
  } else if (field === "valor") {
    await updateIncomeField(id, "valor", parseAmountInput(e.target.value));
  }
  renderSummary();
  renderIncomes();
});

document.getElementById("incomeBody").addEventListener("click", async (e) => {
  const delId = e.target.dataset.deleteIncome;
  if (!delId) return;
  await deleteIncome(delId);
  renderSummary();
  renderIncomes();
});

document.getElementById("addIncomeBtn").addEventListener("click", async () => {
  const newInc = {
    id: uid(), categoria: data.incomeCategories[0], mes: viewMonth, ano: viewYear,
    dia: today.getDate(), valor: 0,
  };
  await addIncome(newInc);
  renderSummary();
  renderIncomes();
  const el = document.querySelector(`[data-id="${newInc.id}"][data-field="valor"]`);
  if (el) el.focus();
});

/* ---------- Início: aguarda o login antes de renderizar (ver auth.js) ---------- */

window.__initPage = render;
