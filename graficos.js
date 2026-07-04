/* Livro-caixa — página de gráficos (graficos.html).
   Depende de data.js, que deve ser incluído antes deste arquivo. */

let viewYear = today.getFullYear();

function render() {
  ensureYearExpenses(viewYear);
  document.getElementById("yearLabel").textContent = viewYear;
  renderSummary();
  renderGastoRendaChart();
  renderSaldoChart();
  renderTrendChart();
  renderRanking();
}

function renderSummary() {
  const totals = yearTotals(viewYear);
  const totalGasto = totals.reduce((s, t) => s + t.gasto, 0);
  const totalRenda = totals.reduce((s, t) => s + t.renda, 0);
  const saldoAno = totalRenda - totalGasto;
  const mesesComGasto = totals.filter(t => t.gasto > 0).length || 1;
  const mediaGasto = totalGasto / mesesComGasto;

  document.getElementById("summary").innerHTML = `
    <div class="stat">
      <div class="label">Gasto total no ano</div>
      <div class="value">${fmtMoney(totalGasto)}</div>
    </div>
    <div class="stat">
      <div class="label">Renda total no ano</div>
      <div class="value">${fmtMoney(totalRenda)}</div>
    </div>
    <div class="stat ${saldoAno < 0 ? "negative" : "positive"}">
      <div class="label">Saldo do ano</div>
      <div class="value">${fmtMoney(saldoAno)}</div>
    </div>
    <div class="stat">
      <div class="label">Média mensal de gasto</div>
      <div class="value">${fmtMoney(mediaGasto)}</div>
    </div>
  `;
}

/* ---------- Gráfico: gasto x renda por mês (barras duplas) ---------- */

function renderGastoRendaChart() {
  const totals = yearTotals(viewYear);
  const max = Math.max(1, ...totals.map(t => Math.max(t.gasto, t.renda)));
  const container = document.getElementById("gastoRendaBars");
  container.innerHTML = totals.map((t, m) => {
    const hGasto = Math.max(t.gasto > 0 ? 2 : 0, (t.gasto / max) * 100);
    const hRenda = Math.max(t.renda > 0 ? 2 : 0, (t.renda / max) * 100);
    return `
      <div class="bar-col" title="${MONTH_NAMES[m]}: gasto ${fmtMoney(t.gasto)}, renda ${fmtMoney(t.renda)}">
        <div class="bar-pair">
          <div class="bar-mini gasto" style="height:${hGasto}%"></div>
          <div class="bar-mini renda" style="height:${hRenda}%"></div>
        </div>
        <div class="m-label">${MONTH_NAMES[m].slice(0, 3)}</div>
      </div>
    `;
  }).join("");
}

/* ---------- Gráfico: saldo por mês (barra única, cor por sinal) ---------- */

function renderSaldoChart() {
  const totals = yearTotals(viewYear);
  const maxAbs = Math.max(1, ...totals.map(t => Math.abs(t.saldo)));
  const container = document.getElementById("saldoBars");
  container.innerHTML = totals.map((t, m) => {
    const heightPct = Math.max(2, (Math.abs(t.saldo) / maxAbs) * 100);
    const negative = t.saldo < 0;
    return `
      <div class="bar-col ${negative ? "negative" : ""}" title="${MONTH_NAMES[m]}: saldo ${fmtMoney(t.saldo)}">
        <div class="bar" style="height:${heightPct}%"></div>
        <div class="m-label">${MONTH_NAMES[m].slice(0, 3)}</div>
      </div>
    `;
  }).join("");
}

/* ---------- Gráfico: saldo acumulado no ano (linha) ---------- */

function renderTrendChart() {
  const totals = yearTotals(viewYear);
  const cumulative = [];
  totals.reduce((acc, t, i) => {
    const next = acc + t.saldo;
    cumulative.push(next);
    return next;
  }, 0);

  const width = 700, height = 150, padX = 16, padY = 16;
  const maxAbs = Math.max(1, ...cumulative.map(Math.abs));
  const midY = height / 2;
  const stepX = (width - padX * 2) / (cumulative.length - 1);

  const points = cumulative.map((v, i) => {
    const x = padX + i * stepX;
    const y = midY - (v / maxAbs) * (midY - padY);
    return { x, y, v };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const dots = points.map(p =>
    `<circle class="trend-dot ${p.v < 0 ? "negative" : "positive"}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" />`
  ).join("");

  const svg = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line class="trend-zero" x1="${padX}" y1="${midY}" x2="${width - padX}" y2="${midY}" />
      <path class="trend-line" d="${pathD}" />
      ${dots}
    </svg>
    <div class="trend-labels">
      ${MONTH_NAMES.map(m => `<span>${m.slice(0, 3)}</span>`).join("")}
    </div>
  `;
  document.getElementById("trendChart").innerHTML = svg;
}

/* ---------- Ranking: maiores contas do ano ---------- */

function renderRanking() {
  const ranking = rankExpensesForYear(viewYear).slice(0, 10);
  const panel = document.getElementById("rankPanel");
  if (ranking.length === 0) {
    panel.innerHTML = `<div class="empty">Nenhum gasto lançado neste ano ainda.</div>`;
    return;
  }
  const max = ranking[0].total;
  panel.innerHTML = ranking.map(r => `
    <div class="rank-row">
      <div class="rank-name">${escapeAttr(r.descricao)}</div>
      <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${(r.total / max) * 100}%"></div></div>
      <div class="rank-value">${fmtMoney(r.total)}</div>
    </div>
  `).join("");
}

/* ---------- Navegação de ano ---------- */

document.getElementById("prevYear").addEventListener("click", () => {
  viewYear -= 1;
  render();
});

document.getElementById("nextYear").addEventListener("click", () => {
  viewYear += 1;
  render();
});

/* ---------- Início ---------- */

render();
