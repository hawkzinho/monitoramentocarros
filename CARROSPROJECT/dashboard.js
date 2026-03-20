// =============================================
// dashboard.js
// =============================================

let _dashCharts = {};

async function initDashboard() {
  fillMonthYear('monthSelect', 'yearSelect');
  document.getElementById('monthSelect').addEventListener('change', loadDashboard);
  document.getElementById('yearSelect').addEventListener('change', loadDashboard);
  await loadDashboard();
  await loadCharts();
}

async function loadDashboard() {
  const month = parseInt(document.getElementById('monthSelect').value);
  const year  = parseInt(document.getElementById('yearSelect').value);
  const { start, end } = getMonthRange(month, year);

  ['cardFaturamento','cardInvestido','cardDespesas','cardLucroBruto','cardLucroLiquido','cardVendidos']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '...'; });

  try {
    const [r1, r2, r3] = await Promise.all([
      db.from('carros').select('*'),
      db.from('despesas_carros').select('carro_id, valor'),
      db.from('despesas_gerais').select('valor, data').gte('data', start).lte('data', end),
    ]);

    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    if (r3.error) throw r3.error;

    const carros    = r1.data || [];
    const despCarros = r2.data || [];
    const despGerais = r3.data || [];

    const despPorCarro = {};
    despCarros.forEach(d => {
      despPorCarro[d.carro_id] = (despPorCarro[d.carro_id] || 0) + (parseFloat(d.valor) || 0);
    });

    const vendidosMes = carros.filter(c =>
      isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
    );
    const emEstoque = carros.filter(c => !isCarroVendido(c.status));

    const faturamento    = vendidosMes.reduce((s, c) => s + (parseFloat(c.valor_venda)  || 0), 0);
    const totalInvestido = emEstoque.reduce((s, c)   => s + (parseFloat(c.valor_compra) || 0), 0);

    const lucroBruto = vendidosMes.reduce((s, c) =>
      s + (parseFloat(c.valor_venda)||0) - (parseFloat(c.valor_compra)||0) - (despPorCarro[c.id]||0), 0);

    const totalDespGerais = despGerais.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const totalDespCarros = vendidosMes.reduce((s, c) => s + (despPorCarro[c.id] || 0), 0);
    const despesasTotais  = totalDespCarros + totalDespGerais;
    const lucroLiquido    = lucroBruto - totalDespGerais;

    document.getElementById('cardFaturamento').textContent = formatCurrency(faturamento);
    document.getElementById('cardInvestido').textContent   = formatCurrency(totalInvestido);
    document.getElementById('cardDespesas').textContent    = formatCurrency(despesasTotais);
    document.getElementById('cardVendidos').textContent    = vendidosMes.length;

    const lb = document.getElementById('cardLucroBruto');
    lb.textContent = formatCurrency(lucroBruto);
    lb.className = 'card-value ' + (lucroBruto >= 0 ? 'profit-positive' : 'profit-negative');

    const ll = document.getElementById('cardLucroLiquido');
    ll.textContent = formatCurrency(lucroLiquido);
    ll.className = 'card-value ' + (lucroLiquido >= 0 ? 'profit-positive' : 'profit-negative');

  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Erro ao carregar dashboard: ' + (err.message || err), 'error');
  }
}

async function loadCharts() {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js não carregado');
    return;
  }

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
      despPorCarro[d.carro_id] = (despPorCarro[d.carro_id] || 0) + (parseFloat(d.valor) || 0);
    });

    const dataFat = [], dataLucro = [], dataDesp = [];

    months.forEach(({ year, month }) => {
      const { start, end } = getMonthRange(month, year);
      const vendidos = carros.filter(c =>
        isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
      );
      dataFat.push(  vendidos.reduce((s,c) => s + (parseFloat(c.valor_venda)||0), 0));
      dataLucro.push(vendidos.reduce((s,c) => s + (parseFloat(c.valor_venda)||0) - (parseFloat(c.valor_compra)||0) - (despPorCarro[c.id]||0), 0));
      const dg = despGerais.filter(d => d.data >= start && d.data <= end).reduce((s,d) => s+(parseFloat(d.valor)||0),0);
      const dc = vendidos.reduce((s,c) => s+(despPorCarro[c.id]||0),0);
      dataDesp.push(dc + dg);
    });

    const labels = months.map(m => m.label);
    buildCharts(labels, dataFat, dataLucro, dataDesp);

  } catch (err) {
    console.error('Charts error:', err);
  }
}

function buildCharts(labels, dataFat, dataLucro, dataDesp) {
  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#8892a4' : '#9ca3af';

  Chart.defaults.font.family = "'Sora', sans-serif";
  Chart.defaults.font.size   = 11;

  const scales = {
    x: { grid: { color: gridColor }, ticks: { color: textColor } },
    y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) } },
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