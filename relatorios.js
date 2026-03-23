// =============================================
// relatorios.js
// =============================================

let _relChart = null;

async function initRelatorios() {
  fillMonthYear('monthSelect', 'yearSelect');
  document.getElementById('monthSelect').addEventListener('change', loadRelatorio);
  document.getElementById('yearSelect').addEventListener('change', loadRelatorio);
  await loadRelatorio();
}

async function loadRelatorio() {
  const month = parseInt(document.getElementById('monthSelect').value);
  const year  = parseInt(document.getElementById('yearSelect').value);
  const { start, end } = getMonthRange(month, year);

  setLoading(true);

  try {
    const [r1, r2, r3] = await Promise.all([
      db.from('carros').select('*'),
      db.from('despesas_carros').select('carro_id, valor'),
      db.from('despesas_gerais').select('descricao, valor, data').gte('data', start).lte('data', end),
    ]);

    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    if (r3.error) throw r3.error;

    const carros     = r1.data || [];
    const despCarros = r2.data || [];
    const despGerais = r3.data || [];

    const despPorCarro = {};
    despCarros.forEach(d => {
      despPorCarro[d.carro_id] = (despPorCarro[d.carro_id] || 0) + (parseFloat(d.valor) || 0);
    });

    const vendidos = carros.filter(c =>
      isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
    );

    const faturamento    = vendidos.reduce((s, c) => s + (parseFloat(c.valor_venda)||0), 0);
    const lucroBruto     = vendidos.reduce((s, c) => s + (parseFloat(c.valor_venda)||0) - (parseFloat(c.valor_compra)||0) - (despPorCarro[c.id]||0), 0);
    const despGeraisTotal = despGerais.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const despCarrosTotal = vendidos.reduce((s, c) => s + (despPorCarro[c.id]||0), 0);
    const despesasTotais  = despCarrosTotal + despGeraisTotal;
    const lucroLiquido    = lucroBruto - despGeraisTotal;

    // Cards
    setCard('cardFaturamento',  faturamento,     false);
    setCard('cardVendidos',     vendidos.length, true);
    setCard('cardDespesas',     despesasTotais,  false);
    setCard('cardLucroBruto',   lucroBruto,      false, true);
    setCard('cardLucroLiquido', lucroLiquido,    false, true);

    renderVendidosTable(vendidos, despPorCarro);
    renderDespGeraisTable(despGerais);

    setLoading(false);

    await loadAnualChart(year);

  } catch (err) {
    setLoading(false);
    console.error('Relatorio error:', err);
    showToast('Erro ao carregar relatório: ' + (err.message || err), 'error');
  }
}

function setCard(id, value, isCount, colorize) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = isCount ? value : formatCurrency(value);
  if (colorize) el.className = 'card-value ' + (value >= 0 ? 'profit-positive' : 'profit-negative');
}

function setLoading(on) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderVendidosTable(vendidos, despPorCarro) {
  const tbody = document.getElementById('vendidosBody');
  const tfoot = document.getElementById('vendidosFooter');

  if (!vendidos.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:20px"><p>Nenhum carro vendido neste mês</p></div></td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  let totVenda = 0, totCompra = 0, totDesp = 0, totLucro = 0;

  tbody.innerHTML = vendidos.map(c => {
    const desp   = despPorCarro[c.id] || 0;
    const venda  = parseFloat(c.valor_venda)  || 0;
    const compra = parseFloat(c.valor_compra) || 0;
    const lucro  = venda - compra - desp;
    totVenda  += venda;
    totCompra += compra;
    totDesp   += desp;
    totLucro  += lucro;
    return `
      <tr>
        <td><strong>${esc(c.modelo)}</strong></td>
        <td class="col-hide-mobile">${(c.tipo||'carro')==='moto'?'🏍️ Moto':'🚗 Carro'}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="currency">${formatCurrency(venda)}</td>
        <td class="currency col-hide-mobile">${formatCurrency(compra)}</td>
        <td class="currency col-hide-mobile">${formatCurrency(desp)}</td>
        <td class="currency ${lucro >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(lucro)}</td>
      </tr>`;
  }).join('');

  tfoot.innerHTML = `
    <tr>
      <td colspan="3" style="font-weight:600">Total</td>
      <td class="currency">${formatCurrency(totVenda)}</td>
      <td class="currency col-hide-mobile">${formatCurrency(totCompra)}</td>
      <td class="currency col-hide-mobile">${formatCurrency(totDesp)}</td>
      <td class="currency ${totLucro >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(totLucro)}</td>
    </tr>`;
}

function renderDespGeraisTable(despGerais) {
  const tbody = document.getElementById('despGeraisBody');
  const tfoot = document.getElementById('despGeraisFooter');

  if (!despGerais.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:20px"><p>Nenhuma despesa geral no período</p></div></td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  const total = despGerais.reduce((s,d) => s+(parseFloat(d.valor)||0),0);

  tbody.innerHTML = despGerais.map(d => `
    <tr>
      <td>${esc(d.descricao)}</td>
      <td class="currency">${formatCurrency(d.valor)}</td>
      <td>${formatDate(d.data)}</td>
    </tr>`).join('');

  tfoot.innerHTML = `
    <tr>
      <td style="font-weight:600">Total</td>
      <td class="currency">${formatCurrency(total)}</td>
      <td></td>
    </tr>`;
}

async function loadAnualChart(year) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js não carregado');
    return;
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: new Date(year, i, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace(/\./g,''),
  }));

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

    months.forEach(({ month }) => {
      const { start, end } = getMonthRange(month, year);
      const vendidos = carros.filter(c =>
        isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
      );
      const fat   = vendidos.reduce((s,c) => s+(parseFloat(c.valor_venda)||0),0);
      const lucro = vendidos.reduce((s,c) => s+(parseFloat(c.valor_venda)||0)-(parseFloat(c.valor_compra)||0)-(despPorCarro[c.id]||0),0);
      const dg    = despGerais.filter(d => d.data >= start && d.data <= end).reduce((s,d)=>s+(parseFloat(d.valor)||0),0);
      const dc    = vendidos.reduce((s,c)=>s+(despPorCarro[c.id]||0),0);
      dataFat.push(fat);
      dataLucro.push(lucro);
      dataDesp.push(dc+dg);
    });

    // ── Totais anuais ──
    const totalFat  = dataFat.reduce((s,v)=>s+v,0);
    const totalLucro = dataLucro.reduce((s,v)=>s+v,0);
    const totalDesp  = dataDesp.reduce((s,v)=>s+v,0);

    const elFat  = document.getElementById('anualFaturamento');
    const elLucro = document.getElementById('anualLucro');
    const elDesp  = document.getElementById('anualDespesas');
    if (elFat)  elFat.textContent  = formatCurrency(totalFat);
    if (elLucro) {
      elLucro.textContent = formatCurrency(totalLucro);
      elLucro.className = 'chart-total-value ' + (totalLucro >= 0 ? 'profit-positive' : 'profit-negative');
    }
    if (elDesp)  elDesp.textContent  = formatCurrency(totalDesp);

    const labels    = months.map(m => m.label);
    const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#8892a4' : '#9ca3af';

    Chart.defaults.font.family = "'Sora', sans-serif";
    Chart.defaults.font.size   = 11;

    if (_relChart) { try { _relChart.destroy(); } catch(_){} }

    _relChart = new Chart(document.getElementById('chartAnual'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Faturamento', data: dataFat,   backgroundColor: 'rgba(59,130,246,0.8)',  borderRadius: 4, borderSkipped: false },
          { label: 'Lucro',       data: dataLucro, backgroundColor: 'rgba(16,185,129,0.8)',  borderRadius: 4, borderSkipped: false },
          { label: 'Despesas',    data: dataDesp,  backgroundColor: 'rgba(239,68,68,0.8)',   borderRadius: 4, borderSkipped: false },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: textColor, padding: 16 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => 'R$'+(v>=1000?(v/1000).toFixed(0)+'k':v) } },
        },
      },
    });

  } catch (err) {
    console.error('Annual chart error:', err);
  }
}

document.addEventListener('DOMContentLoaded', initRelatorios);