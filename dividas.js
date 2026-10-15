/* Livro-caixa — página de dívidas (dividas.html).
   Depende de data.js (incluído antes) e auth.js (incluído depois), igual às
   outras páginas. */

/* Cores das dívidas nos gráficos: as 5 primeiras posições da paleta categórica
   validada (ordem fixa, nunca "pulada"). Cada dívida guarda a sua posição
   (campo `cor`), então mantém a mesma cor mesmo que outra seja removida. */
const DEBT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const DEBT_OTHER_COLOR = "#898781"; // da 6ª dívida em diante
const PLOT_H = 180;                 // altura da área do gráfico, em px

let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexado
let chartSeries = [];
let showTable = false;

const debtColor = (debt) => DEBT_COLORS[debt.cor] || DEBT_OTHER_COLOR;
const debtName = (debt) => debt.nome || "(sem nome)";
const monthShort = (y, m) => `${MONTH_NAMES[m].slice(0, 3)}/${y}`;
const fmtSigned = (v) => (v > 0 ? "+" : "") + fmtMoney(v);
const fmtPct = (v) => v.toFixed(1).replace(".", ",") + "%";

/* Teto "redondo" para o eixo, de modo que o meio também seja um número limpo
   (ex.: 0 / 200 mil / 400 mil). */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const c of [1, 2, 4, 6, 8, 10]) if (c * p >= v) return c * p;
  return 10 * p;
}

function fmtCompact(v) {
  if (v === 0) return "R$ 0";
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

/* ---------- Render ---------- */

function render() {
  if (typeof debtsAvailable === "undefined" || typeof debtSeries !== "function") {
    throw new Error("data.js está desatualizado no site — suba a versão nova do data.js junto com dividas.js");
  }
  document.getElementById("setupNotice").hidden = debtsAvailable;
  document.getElementById("debtContent").hidden = !debtsAvailable;
  if (!debtsAvailable) return;

  const temDividas = data.debts.length > 0;
  document.getElementById("emptyState").hidden = temDividas;
  document.getElementById("hasDebts").hidden = !temDividas;

  const rotulo = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  document.getElementById("monthLabel").textContent = rotulo;
  document.getElementById("listMonthLabel").textContent = rotulo;
  document.getElementById("entryMonthLabel").textContent = rotulo;

  if (temDividas) {
    renderSummary();
    renderChart();
    renderDebtList();
    renderEntries();
  }
  renderManage();
}

function renderSummary() {
  const snap = debtsSnapshot(viewYear, viewMonth);
  const prev = prevMonthOf(viewYear, viewMonth);
  const snapPrev = debtsSnapshot(prev.ano, prev.mes);

  // Variação só entre as dívidas que têm saldo nos dois meses — assim o total
  // não "pula" quando uma dívida começa a ser anotada.
  let delta = null;
  snap.itens.forEach((it, i) => {
    const p = snapPrev.itens[i];
    if (it.saldo !== null && p.saldo !== null) delta = (delta || 0) + (it.saldo - p.saldo);
  });

  const semSaldo = snap.itens.every(it => it.saldo === null);
  const parcelas = snap.itens
    .filter(it => it.saldo !== 0) // dívida quitada não tem mais parcela
    .reduce((soma, it) => soma + it.debt.parcela, 0);
  const amort = amortizedTotals(viewYear, viewMonth);

  const deltaClasse = delta === null || delta === 0 ? "" : (delta < 0 ? "positive" : "negative");

  document.getElementById("summary").innerHTML = `
    <div class="stat">
      <div class="label">Saldo devedor total</div>
      <div class="value">${semSaldo ? "—" : fmtMoney(snap.total)}</div>
    </div>
    <div class="stat ${deltaClasse}">
      <div class="label">Vs. mês anterior</div>
      <div class="value">${delta === null ? "—" : fmtSigned(delta)}</div>
    </div>
    <div class="stat">
      <div class="label">Parcelas por mês</div>
      <div class="value">${fmtMoney(parcelas)}</div>
    </div>
    <div class="stat">
      <div class="label">Amortizado extra em ${viewYear}</div>
      <div class="value">${fmtMoney(amort.noAno)}</div>
    </div>
  `;
}

/* ---------- Gráfico: saldo devedor por dívida, 12 meses (barras empilhadas) ---------- */

function renderChart() {
  hideTip();
  chartSeries = debtSeries(viewYear, viewMonth, 12);
  const ultimo = chartSeries[chartSeries.length - 1];
  document.getElementById("rangeLabel").textContent = monthShort(ultimo.ano, ultimo.mes);

  // Legenda: sempre com 2+ dívidas (com uma só, o título já diz o que é)
  const legend = document.getElementById("debtLegend");
  legend.style.display = data.debts.length < 2 ? "none" : "";
  legend.innerHTML = data.debts.map(d =>
    `<span><span class="swatch" style="background:${debtColor(d)}"></span>${escapeAttr(debtName(d))}</span>`
  ).join("");

  const chart = document.getElementById("debtChart");
  const maxTotal = Math.max(0, ...chartSeries.map(m => m.total));

  if (maxTotal === 0) {
    chart.innerHTML = `<div class="empty chart-empty">Anote o saldo devedor no quadro “Lançar o mês” (abaixo) para ver a evolução aqui.</div>`;
  } else {
    const topo = niceMax(maxTotal);
    const k = PLOT_H / topo;
    const ticks = [
      { v: 0, pct: 0 },
      { v: topo / 2, pct: 50 },
      { v: topo, pct: 100 },
    ];

    const cols = chartSeries.map((m, idx) => {
      let acumulado = 0;
      const segs = [];
      m.itens.forEach(it => {
        const v = it.saldo || 0;
        if (v <= 0) return;
        const y0 = acumulado * k;
        acumulado += v;
        segs.push({ y0, y1: acumulado * k, cor: debtColor(it.debt) });
      });

      const segHtml = segs.map((s, i) => {
        const ehTopo = i === segs.length - 1;
        // 2px de respiro (cor do fundo) entre segmentos; só o topo é arredondado
        const h = Math.max(1, (s.y1 - s.y0) - (ehTopo ? 0 : 2));
        const raio = ehTopo ? "border-radius:4px 4px 0 0;" : "";
        return `<div class="dseg" style="bottom:${s.y0.toFixed(1)}px;height:${h.toFixed(1)}px;background:${s.cor};${raio}"></div>`;
      }).join("");

      const detalhes = m.itens
        .map(it => `${debtName(it.debt)} ${it.saldo === null ? "sem saldo anotado" : fmtMoney(it.saldo)}`)
        .join("; ");
      const aria = `${MONTH_NAMES[m.mes]} ${m.ano}: total ${fmtMoney(m.total)}. ${detalhes}`;

      return `<div class="dcol" tabindex="0" data-idx="${idx}" aria-label="${escapeAttr(aria)}">
        <div class="dstack" style="height:${(acumulado * k).toFixed(1)}px">${segHtml}</div>
      </div>`;
    }).join("");

    const xlabels = chartSeries.map((m, i) => {
      const comAno = i === 0 || m.mes === 0;
      return `<div class="dxlabel">${MONTH_NAMES[m.mes].slice(0, 3)}${comAno ? `<span class="dxyear">${m.ano}</span>` : ""}</div>`;
    }).join("");

    chart.innerHTML = `
      <div class="daxis" style="height:${PLOT_H}px">
        ${ticks.map(t => `<span style="bottom:${t.pct}%">${fmtCompact(t.v)}</span>`).join("")}
      </div>
      <div class="dplot" style="height:${PLOT_H}px">
        <div class="dgrid" style="bottom:50%"></div>
        <div class="dgrid" style="top:0"></div>
        <div class="dcols">${cols}</div>
      </div>
      <div></div>
      <div class="dxlabels">${xlabels}</div>
    `;
  }

  renderChartTable();
  applyTableToggle();
}

/* Mesmos números do gráfico, em tabela — alternativa para quem não enxerga bem
   as cores e para consultar os valores sem passar o mouse. */
function renderChartTable() {
  const cabecalho = `<tr><th>Mês</th>${data.debts.map(d => `<th>${escapeAttr(debtName(d))}</th>`).join("")}<th>Total</th></tr>`;
  const linhas = chartSeries.map(m => `
    <tr>
      <td>${monthShort(m.ano, m.mes)}</td>
      ${m.itens.map(it => `<td>${it.saldo === null ? "—" : fmtMoney(it.saldo)}</td>`).join("")}
      <td>${fmtMoney(m.total)}</td>
    </tr>`).join("");
  document.getElementById("chartTableWrap").innerHTML =
    `<table class="data-table"><thead>${cabecalho}</thead><tbody>${linhas}</tbody></table>`;
}

function applyTableToggle() {
  document.getElementById("debtChartWrap").hidden = showTable;
  document.getElementById("chartTableWrap").hidden = !showTable;
  const btn = document.getElementById("toggleTable");
  btn.textContent = showTable ? "Ver como gráfico" : "Ver como tabela";
  btn.setAttribute("aria-pressed", String(showTable));
}

/* ---------- Dica ao passar o mouse / focar numa coluna ---------- */

function tipRow(cor, nome, valor, ehTotal) {
  const row = document.createElement("div");
  row.className = "tip-row" + (ehTotal ? " tip-total" : "");
  if (cor) {
    const chave = document.createElement("span");
    chave.className = "tip-key";
    chave.style.background = cor;
    row.appendChild(chave);
  }
  const n = document.createElement("span");
  n.className = "tip-name";
  n.textContent = nome; // nomes vêm do usuário: sempre textContent
  const v = document.createElement("span");
  v.className = "tip-val";
  v.textContent = valor;
  row.append(n, v);
  return row;
}

function showTip(col) {
  const m = chartSeries[Number(col.dataset.idx)];
  if (!m) return;
  const el = document.getElementById("debtTip");
  el.replaceChildren();

  const titulo = document.createElement("div");
  titulo.className = "tip-title";
  titulo.textContent = `${MONTH_NAMES[m.mes]} ${m.ano}`;
  el.appendChild(titulo);

  m.itens.forEach(it => {
    el.appendChild(tipRow(debtColor(it.debt), debtName(it.debt), it.saldo === null ? "—" : fmtMoney(it.saldo), false));
  });
  el.appendChild(tipRow(null, "Total", fmtMoney(m.total), true));

  el.hidden = false;
  const painel = document.getElementById("chartPanel").getBoundingClientRect();
  const c = col.getBoundingClientRect();
  const area = col.parentElement.getBoundingClientRect();
  const w = el.offsetWidth;
  const centro = c.left + c.width / 2 - painel.left;
  // aparece ao lado da coluna, do lado que tiver mais espaço
  let left = centro < painel.width / 2 ? c.right - painel.left + 8 : c.left - painel.left - w - 8;
  left = Math.max(8, Math.min(left, painel.width - w - 8));
  el.style.left = `${left}px`;
  el.style.top = `${area.top - painel.top + 4}px`;
}

function hideTip() {
  const el = document.getElementById("debtTip");
  if (el) el.hidden = true;
}

const chartEl = document.getElementById("debtChart");
chartEl.addEventListener("pointerover", (e) => {
  const col = e.target.closest(".dcol");
  if (col) showTip(col);
});
chartEl.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hideTip(); });
chartEl.addEventListener("focusin", (e) => {
  const col = e.target.closest(".dcol");
  if (col) showTip(col);
});
chartEl.addEventListener("focusout", hideTip);
document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".dcol")) hideTip(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });

document.getElementById("toggleTable").addEventListener("click", () => {
  showTable = !showTable;
  applyTableToggle();
});

/* ---------- Saldo por dívida ---------- */

function renderDebtList() {
  const snap = debtsSnapshot(viewYear, viewMonth);
  const mesAtual = viewYear * 12 + viewMonth;

  document.getElementById("debtList").innerHTML = snap.itens.map(it => {
    const d = it.debt;
    const meta = [DEBT_TYPES[d.tipo] || "Dívida"];
    if (d.parcela > 0) meta.push(`parcela ${fmtMoney(d.parcela)}`);

    let valor, barra = "", sub = "";
    if (it.saldo === null) {
      valor = `<span class="debt-none">sem saldo anotado</span>`;
      sub = "Lance o saldo devedor no quadro “Lançar o mês”, logo abaixo.";
    } else {
      valor = fmtMoney(it.saldo);
      const primeiro = firstDebtBalance(d.id);
      const partes = [];

      if (it.saldo === 0) partes.push("Quitada");

      if (primeiro && primeiro.saldo > 0) {
        const reducao = primeiro.saldo - it.saldo;
        const pct = Math.min(100, Math.max(0, (reducao / primeiro.saldo) * 100));
        barra = `<div class="debt-track" role="img" aria-label="${fmtPct(pct)} do saldo inicial já reduzido"><div class="debt-fill" style="width:${pct.toFixed(1)}%"></div></div>`;

        const desde = monthShort(primeiro.ano, primeiro.mes);
        if (primeiro.ano * 12 + primeiro.mes >= mesAtual) {
          partes.push(`Acompanhando desde ${desde}`);
        } else if (reducao > 0) {
          partes.push(`Reduziu ${fmtMoney(reducao)} (${fmtPct(pct)}) desde ${desde}`);
        } else if (reducao < 0) {
          partes.push(`Subiu ${fmtMoney(-reducao)} desde ${desde}`);
        } else {
          partes.push(`Sem variação desde ${desde}`);
        }
      }

      if (!it.exato && it.deMes) partes.push(`saldo de ${monthShort(it.deMes.ano, it.deMes.mes)}`);
      sub = partes.join(" · ");
    }

    return `
      <div class="debt-row" style="--c:${debtColor(d)}">
        <div class="debt-name">
          <span class="dot"></span>
          <span class="debt-title">${escapeAttr(debtName(d))}</span>
          <span class="debt-meta">${meta.join(" · ")}</span>
        </div>
        <div class="debt-bar">${barra}</div>
        <div class="debt-value">${valor}</div>
        ${sub ? `<div class="debt-sub">${sub}</div>` : ""}
      </div>`;
  }).join("");
}

/* ---------- Lançar o mês ---------- */

function renderEntries() {
  document.getElementById("entryBody").innerHTML = data.debts.map(d => {
    const e = getDebtEntry(d.id, viewYear, viewMonth);
    const ultimo = debtBalanceAt(d.id, viewYear, viewMonth);
    const saldoVal = e && e.saldo !== null ? formatAmount(e.saldo) : "";
    const saldoPh = ultimo ? `último: ${fmtMoney(ultimo.saldo)}` : "0,00";
    const amortVal = e && e.amortizacao > 0 ? formatAmount(e.amortizacao) : "";
    return `
      <tr>
        <td class="desc-cell desc"><span class="dot" style="background:${debtColor(d)}"></span>${escapeAttr(debtName(d))}</td>
        <td class="amount-cell amount" data-label="saldo">
          <input class="cell-input amount-input" type="text" inputmode="decimal"
                 data-debt="${d.id}" data-field="saldo" value="${saldoVal}" placeholder="${escapeAttr(saldoPh)}" />
        </td>
        <td class="amount-cell amount" data-label="amortizou">
          <input class="cell-input amount-input" type="text" inputmode="decimal"
                 data-debt="${d.id}" data-field="amortizacao" value="${amortVal}" placeholder="0,00" />
        </td>
      </tr>`;
  }).join("");
}

document.getElementById("entryBody").addEventListener("change", async (e) => {
  const { debt, field } = e.target.dataset;
  if (!debt || !field) return;
  const bruto = e.target.value.trim();

  if (field === "saldo") {
    // vazio = "não anotei"; 0 = quitada
    const saldo = bruto === "" ? null : Math.max(0, parseAmountInput(bruto));
    await saveDebtEntry(debt, viewYear, viewMonth, { saldo });
  } else if (field === "amortizacao") {
    await saveDebtEntry(debt, viewYear, viewMonth, { amortizacao: Math.max(0, parseAmountInput(bruto)) });
  }
  render();
});

/* ---------- Minhas dívidas (cadastro) ---------- */

function renderManage() {
  const body = document.getElementById("manageBody");
  if (data.debts.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma dívida cadastrada.</td></tr>`;
    return;
  }
  body.innerHTML = data.debts.map(d => `
    <tr>
      <td class="desc-cell">
        <input class="cell-input" type="text" data-id="${d.id}" data-field="nome"
               value="${escapeAttr(d.nome)}" placeholder="Nome da dívida" />
      </td>
      <td class="tipo-cell">
        <select class="cell-input" data-id="${d.id}" data-field="tipo">
          ${Object.entries(DEBT_TYPES).map(([chave, texto]) =>
            `<option value="${chave}" ${chave === d.tipo ? "selected" : ""}>${texto}</option>`
          ).join("")}
        </select>
      </td>
      <td class="amount-cell amount" data-label="parcela">
        <input class="cell-input amount-input" type="text" inputmode="decimal" data-id="${d.id}" data-field="parcela"
               value="${d.parcela > 0 ? formatAmount(d.parcela) : ""}" placeholder="0,00" />
      </td>
      <td class="row-actions">
        <button class="btn ghost" data-delete-debt="${d.id}">remover</button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("manageBody").addEventListener("change", async (e) => {
  const { id, field } = e.target.dataset;
  if (!id || !field || !data.debts.some(d => d.id === id)) return;

  if (field === "nome") await updateDebtField(id, "nome", e.target.value.trim());
  else if (field === "tipo") await updateDebtField(id, "tipo", e.target.value);
  else if (field === "parcela") await updateDebtField(id, "parcela", Math.max(0, parseAmountInput(e.target.value)));
  render();
});

document.getElementById("manageBody").addEventListener("click", async (e) => {
  const id = e.target.dataset.deleteDebt;
  if (!id) return;
  if (!confirm("Remover esta dívida e todo o histórico de saldos dela? Isso não pode ser desfeito.")) return;
  await deleteDebt(id);
  render();
});

async function addBlankDebt() {
  const nova = {
    id: uid(), nome: "", tipo: "emprestimo", parcela: 0,
    cor: nextDebtColorSlot(), criadoEm: new Date().toISOString(),
  };
  await addDebt(nova);
  render();
  const campo = document.querySelector(`[data-id="${nova.id}"][data-field="nome"]`);
  if (campo) campo.focus();
}

/* Cria as 3 dívidas que já aparecem nas contas fixas. Só acontece quando você
   clica — nunca automaticamente. */
async function seedDebtsFromFixedBills() {
  const modelos = [
    { nome: "Financiamento Caixa", tipo: "financiamento" },
    { nome: "Empréstimo Nubank", tipo: "emprestimo" },
    { nome: "Empréstimo Itaú", tipo: "emprestimo" },
  ];
  const base = Date.now();
  for (let i = 0; i < modelos.length; i++) {
    const m = modelos[i];
    const fixa = data.recurring.find(r => r.descricao === m.nome)
      || DEFAULT_RECURRING.find(r => r.descricao === m.nome);
    await addDebt({
      id: uid(), nome: m.nome, tipo: m.tipo, parcela: fixa ? fixa.valor : 0,
      cor: nextDebtColorSlot(), criadoEm: new Date(base + i).toISOString(),
    });
  }
  render();
}

document.getElementById("addDebtBtn").addEventListener("click", addBlankDebt);
document.getElementById("emptyAddBtn").addEventListener("click", addBlankDebt);
document.getElementById("seedDebtsBtn").addEventListener("click", seedDebtsFromFixedBills);

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

["entryBody", "manageBody"].forEach(id => {
  bindEnterBlurs(id);
  bindSelectOnFocus(id);
});

/* ---------- Início: aguarda o login antes de renderizar (ver auth.js) ---------- */

window.__initPage = render;
