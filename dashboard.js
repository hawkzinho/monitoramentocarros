// =============================================
// dashboard.js
// =============================================

// ── Valores calculados guardados para o switch ──
let _dashVals = {
  faturamento: 0,
  lucroBruto: 0,
  totalDespGerais: 0,
  totalDespCarros: 0, // despesas dos carros vendidos no mês
  lucroLiquido: 0,
};

async function initDashboard() {
  fillMonthYear('monthSelect', 'yearSelect');
  document.getElementById('monthSelect').addEventListener('change', loadDashboard);
  document.getElementById('yearSelect').addEventListener('change', loadDashboard);

  // Switches — recalcula na hora sem nova requisição
  document.getElementById('toggleDespCarros')?.addEventListener('change', applyDashSwitches);
  document.getElementById('toggleLucroCarros')?.addEventListener('change', applyDashSwitches);
  document.getElementById('toggleMargemCarros')?.addEventListener('change', applyDashSwitches);

  await loadDashboard();
  await loadCharts();
}

async function loadDashboard() {
  const month = parseInt(document.getElementById('monthSelect').value);
  const year  = parseInt(document.getElementById('yearSelect').value);
  const { start, end } = getMonthRange(month, year);

  const allCardIds = [
    'cardFaturamento','cardDespesas','cardLucroBruto','cardLucroLiquido',
    'cardPctLucro','cardVendidos',
    'cardTotalVeiculos','cardEstoque','cardValorEstoque','cardDespEstoque'
  ];
  allCardIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '...'; });

  try {
    const [r1, r2, r3, r4] = await Promise.all([
      db.from('carros').select('*'),
      db.from('despesas_carros').select('carro_id, valor'),                                           // todas (para estoque)
      db.from('despesas_carros').select('carro_id, valor').gte('data', start).lte('data', end),       // filtradas por mês (para switch)
      db.from('despesas_gerais').select('valor, data').gte('data', start).lte('data', end),
    ]);

    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    if (r3.error) throw r3.error;
    if (r4.error) throw r4.error;

    const carros          = r1.data || [];
    const despCarrosTodos = r2.data || [];  // acumulado total (estoque)
    const despCarrosMes   = r3.data || [];  // só do mês selecionado (switch)
    const despGerais      = r4.data || [];

    // Mapa acumulado (para cards de estoque e lucro bruto dos vendidos)
    const despPorCarro = {};
    despCarrosTodos.forEach(d => {
      despPorCarro[d.carro_id] = (despPorCarro[d.carro_id] || 0) + (parseFloat(d.valor) || 0);
    });

    // Mapa filtrado por mês (para o switch "+ desp. veículos")
    const despPorCarroMes = {};
    despCarrosMes.forEach(d => {
      despPorCarroMes[d.carro_id] = (despPorCarroMes[d.carro_id] || 0) + (parseFloat(d.valor) || 0);
    });

    // Vendidos no mês
    const vendidosMes = carros.filter(c =>
      isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
    );

    // Em estoque (não vendidos)
    const emEstoque = carros.filter(c => !isCarroVendido(c.status));

    // ── Cálculos do mês ──
    const faturamento     = vendidosMes.reduce((s, c) => s + (parseFloat(c.valor_venda)  || 0), 0);
    const lucroBruto      = vendidosMes.reduce((s, c) =>
      s + (parseFloat(c.valor_venda)||0) - (parseFloat(c.valor_compra)||0) - (despPorCarro[c.id]||0), 0);
    const totalDespGerais = despGerais.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const lucroLiquido    = lucroBruto - totalDespGerais;

    // Despesas dos carros filtradas por mês (para o switch) — todos os carros, não só vendidos
    const totalDespCarros = despCarrosMes.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // Guarda para os switches
    _dashVals = { faturamento, lucroBruto, totalDespGerais, totalDespCarros, lucroLiquido };

    // % de lucro líquido sobre faturamento
    const pctLucro = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : null;

    // ── Informações do estoque ──
    const totalVeiculos   = carros.length;
    const totalCarros     = carros.filter(c => (c.tipo||'carro') === 'carro').length;
    const totalMotos      = carros.filter(c => c.tipo === 'moto').length;
    const qtdEstoque      = emEstoque.length;
    const carrosEstoque   = emEstoque.filter(c => (c.tipo||'carro') === 'carro').length;
    const motosEstoque    = emEstoque.filter(c => c.tipo === 'moto').length;
    const valorEstoque    = emEstoque.reduce((s, c) => s + (parseFloat(c.valor_compra) || 0), 0);
    const despEstoque     = emEstoque.reduce((s, c) => s + (despPorCarro[c.id] || 0), 0);

    // ── Atualiza cards do mês ──
    setText('cardFaturamento', formatCurrency(faturamento));
    setText('cardVendidos',    vendidosMes.length);

    // Despesas/Lucro/Margem — aplicados pelo switch
    applyDashSwitches();

    // ── Atualiza cards de estoque ──
    setText('cardTotalVeiculos',  totalVeiculos);
    setText('cardTotalCarros',    totalCarros);
    setText('cardTotalMotos',     totalMotos);
    setText('cardEstoque',        qtdEstoque);
    setText('cardCarrosEstoque',  carrosEstoque);
    setText('cardMotosEstoque',   motosEstoque);
    setText('cardValorEstoque',   formatCurrency(valorEstoque));
    setText('cardDespEstoque',    formatCurrency(despEstoque));

  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Erro ao carregar dashboard: ' + (err.message || err), 'error');
  }
}

let _dashCharts = {};

function applyDashSwitches() {
  const inclDespCarros   = document.getElementById('toggleDespCarros')?.checked;
  const inclLucroCarros  = document.getElementById('toggleLucroCarros')?.checked;
  const inclMargemCarros = document.getElementById('toggleMargemCarros')?.checked;

  const { faturamento, lucroBruto, totalDespGerais, totalDespCarros, lucroLiquido } = _dashVals;

  // Despesas
  const despExibida = totalDespGerais + (inclDespCarros ? totalDespCarros : 0);
  const labelDesp   = document.getElementById('labelDespesas');
  if (labelDesp) labelDesp.textContent = inclDespCarros ? 'Despesas Totais' : 'Despesas Gerais';
  setText('cardDespesas', formatCurrency(despExibida));

  // Lucro Líquido (lucroBruto já desconta despesas dos carros; lucroLiquido = lucroBruto - despGerais)
  const lucroExibido = lucroLiquido - (inclLucroCarros ? totalDespCarros : 0);
  const labelLucro   = document.getElementById('labelLucroLiquido');
  if (labelLucro) labelLucro.textContent = inclLucroCarros ? 'Lucro Líquido Total' : 'Lucro Líquido';
  setValCard('cardLucroBruto',   lucroBruto);
  setValCard('cardLucroLiquido', lucroExibido);

  // Margem
  const lucroMargem = lucroLiquido - (inclMargemCarros ? totalDespCarros : 0);
  const pctEl       = document.getElementById('cardPctLucro');
  const labelMargem = document.getElementById('labelMargem');
  if (labelMargem) labelMargem.textContent = inclMargemCarros ? 'Margem Real' : 'Margem de Lucro';
  if (pctEl) {
    if (faturamento <= 0) { pctEl.textContent = '—'; pctEl.className = 'card-value'; }
    else {
      const pct = (lucroMargem / faturamento) * 100;
      pctEl.textContent = pct.toFixed(1) + '%';
      pctEl.className = 'card-value ' + (pct >= 0 ? 'profit-positive' : 'profit-negative');
    }
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setValCard(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = formatCurrency(val);
  el.className = 'card-value ' + (val >= 0 ? 'profit-positive' : 'profit-negative');
}

// ── Charts ──
async function loadCharts() {
  if (typeof Chart === 'undefined') { console.error('Chart.js não carregado'); return; }

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace(/\./g,''),
    });
  }

  try {
    const [r1, r2, r3] = await Promise.all([
      db.from('carros').select('*'),
      db.from('despesas_carros').select('carro_id, valor'),
      db.from('despesas_gerais').select('valor, data'),
    ]);

    const carros     = r1.data || [];
    const despCarros = r2.data || [];
    const despGerais = r3.data || [];

    const despPorCarro = {};
    despCarros.forEach(d => {
      despPorCarro[d.carro_id] = (despPorCarro[d.carro_id]||0) + (parseFloat(d.valor)||0);
    });

    const dataFat = [], dataLucro = [], dataDesp = [];

    months.forEach(({ year, month }) => {
      const { start, end } = getMonthRange(month, year);
      const vendidos = carros.filter(c =>
        isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
      );
      dataFat.push(vendidos.reduce((s,c) => s+(parseFloat(c.valor_venda)||0), 0));
      dataLucro.push(vendidos.reduce((s,c) =>
        s+(parseFloat(c.valor_venda)||0)-(parseFloat(c.valor_compra)||0)-(despPorCarro[c.id]||0), 0));
      const dg = despGerais.filter(d => d.data >= start && d.data <= end)
        .reduce((s,d) => s+(parseFloat(d.valor)||0), 0);
      dataDesp.push(dg); // só despesas gerais no gráfico
    });

    buildCharts(months.map(m => m.label), dataFat, dataLucro, dataDesp);
  } catch (err) { console.error('Charts error:', err); }
}

function buildCharts(labels, dataFat, dataLucro, dataDesp) {
  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#8892a4' : '#9ca3af';

  Chart.defaults.font.family = "'Sora', sans-serif";
  Chart.defaults.font.size   = 11;

  const scales = {
    x: { grid: { color: gridColor }, ticks: { color: textColor } },
    y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => 'R$'+(v>=1000?(v/1000).toFixed(0)+'k':v) } },
  };
  const tip = { callbacks: { label: ctx => formatCurrency(ctx.raw) } };

  Object.values(_dashCharts).forEach(c => { try { c.destroy(); } catch(_){} });
  _dashCharts = {};

  _dashCharts.fat = new Chart(document.getElementById('chartFaturamento'), {
    type: 'bar',
    data: { labels, datasets: [{ data: dataFat, backgroundColor: 'rgba(59,130,246,0.75)', borderRadius: 5, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales },
  });

  _dashCharts.lucro = new Chart(document.getElementById('chartLucro'), {
    type: 'line',
    data: { labels, datasets: [{ data: dataLucro, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2.5, fill: true, tension: 0.4, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales },
  });

  _dashCharts.desp = new Chart(document.getElementById('chartDespesas'), {
    type: 'bar',
    data: { labels, datasets: [{ data: dataDesp, backgroundColor: 'rgba(239,68,68,0.75)', borderRadius: 5, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales },
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);