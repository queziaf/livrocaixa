/* Livro-caixa — página de contas fixas (contas-fixas.html).
   Depende de data.js, que deve ser incluído antes deste arquivo. */

function renderRecurringPage() {
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

bindEnterBlurs("recurringBody");

document.getElementById("recurringBody").addEventListener("change", (e) => {
  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const rec = data.recurring.find(x => x.id === id);
  if (!rec) return;

  if (field === "descricao") {
    updateRecurringField(id, "descricao", e.target.value.trim());
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    updateRecurringField(id, "dia", (v >= 1 && v <= 31) ? v : rec.dia);
  } else if (field === "valor") {
    const v = parseFloat(e.target.value);
    // valor de referência não precisa propagar para os meses já gerados
    rec.valor = isNaN(v) ? 0 : v;
    saveData();
  }
  renderRecurringPage();
});

document.getElementById("recurringBody").addEventListener("click", (e) => {
  const delId = e.target.dataset.deleteRecurring;
  if (!delId) return;
  if (!confirm("Remover esta conta fixa? Ela não será mais gerada em meses futuros (meses já lançados não são alterados).")) return;
  data.recurring = data.recurring.filter(x => x.id !== delId);
  saveData();
  renderRecurringPage();
});

document.getElementById("addRecurringBtn").addEventListener("click", () => {
  const newRec = { id: uid(), descricao: "", dia: 1, valor: 0 };
  data.recurring.push(newRec);
  saveData();
  ensureYearExpenses(today.getFullYear());
  renderRecurringPage();
  const el = document.querySelector(`[data-focus-id="rdesc-${newRec.id}"]`);
  if (el) el.focus();
});

/* ---------- Início ---------- */

renderRecurringPage();
