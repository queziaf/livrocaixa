/* Livro-caixa — página de contas fixas (contas-fixas.html).
   Depende de data.js e auth.js, incluídos antes deste arquivo. */

function renderRecurringPage() {
  const body = document.getElementById("recurringBody");
  if (data.recurring.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma conta fixa cadastrada.</td></tr>`;
    return;
  }
  body.innerHTML = data.recurring.map(r => `
    <tr>
      <td class="desc-cell">
        <input class="cell-input" type="text" data-field="descricao" data-id="${r.id}" value="${escapeAttr(r.descricao)}" />
      </td>
      <td class="dia-cell meta">
        <input class="cell-input dia-input" type="number" min="1" max="31" data-field="dia" data-id="${r.id}" value="${r.dia}" />
      </td>
      <td class="amount-cell amount">
        <input class="cell-input amount-input" type="number" step="0.01" data-field="valor" data-id="${r.id}" value="${r.valor}" />
      </td>
      <td class="row-actions">
        <button class="btn ghost" data-delete-recurring="${r.id}">remover</button>
      </td>
    </tr>
  `).join("");
}

bindEnterBlurs("recurringBody");

document.getElementById("recurringBody").addEventListener("change", async (e) => {
  const field = e.target.dataset.field;
  const id = e.target.dataset.id;
  if (!field || !id) return;
  const rec = data.recurring.find(x => x.id === id);
  if (!rec) return;

  if (field === "descricao") {
    await updateRecurringField(id, "descricao", e.target.value.trim());
  } else if (field === "dia") {
    const v = parseInt(e.target.value, 10);
    await updateRecurringField(id, "dia", (v >= 1 && v <= 31) ? v : rec.dia);
  } else if (field === "valor") {
    const v = parseFloat(e.target.value);
    await updateRecurringField(id, "valor", isNaN(v) ? 0 : v);
  }
  renderRecurringPage();
});

document.getElementById("recurringBody").addEventListener("click", async (e) => {
  const delId = e.target.dataset.deleteRecurring;
  if (!delId) return;
  if (!confirm("Remover esta conta fixa? Ela não será mais gerada em meses futuros (meses já lançados não são alterados).")) return;
  await deleteRecurring(delId);
  renderRecurringPage();
});

document.getElementById("addRecurringBtn").addEventListener("click", async () => {
  const newRec = { id: uid(), descricao: "", dia: 1, valor: 0 };
  await addRecurring(newRec);
  await ensureYearExpenses(today.getFullYear());
  renderRecurringPage();
  const el = document.querySelector(`[data-id="${newRec.id}"][data-field="descricao"]`);
  if (el) el.focus();
});

/* ---------- Início: aguarda o login antes de renderizar (ver auth.js) ---------- */

window.__initPage = renderRecurringPage;
