// =============================================
// carro-detalhes.js
// =============================================

const FLAGS_CONFIG = [
  { key: 'nota_entrada',       label: 'Nota de entrada' },
  { key: 'vistoria_entrada',   label: 'Vistoria de entrada' },
  { key: 'atpv_reconhecida',   label: 'ATPV reconhecida' },
  { key: 'renave',             label: 'Renave' },
  { key: 'envio_despachante',  label: 'Envio para o despachante' },
  { key: 'pagamento_taxa',     label: 'Pagamento da taxa' },
];

function getFlags(c) {
  if (!c?.flags) return {};
  if (typeof c.flags === 'string') { try { return JSON.parse(c.flags); } catch { return {}; } }
  return c.flags || {};
}

function allFlagsDone(flags) {
  return FLAGS_CONFIG.every(f => flags[f.key]);
}

let _carroId = null, _carro = null, _despesas = [];

async function loadDetalhes() {
  const params = new URLSearchParams(window.location.search);
  _carroId = params.get('id');
  if (!_carroId) { document.getElementById('carroInfo').innerHTML = '<p>ID não informado.</p>'; return; }
  try {
    const [r1, r2] = await Promise.all([
      db.from('carros').select('*').eq('id', _carroId).single(),
      db.from('despesas_carros').select('*').eq('carro_id', _carroId).order('created_at', { ascending: true }),
    ]);
    if (r1.error) throw r1.error;
    _carro = r1.data; _despesas = r2.data || [];
    document.title = `Matheus Veículos - ${_carro.modelo}`;
    document.getElementById('pageTitle').textContent = _carro.modelo;

    const clRes = await db.from('checklist').select('id').eq('carro_id', _carroId).maybeSingle();
    const hasChecklist = !!clRes.data;
    const btnCl = document.getElementById('btnChecklist');
    if (btnCl) {
      btnCl.href = `checklist.html?id=${_carroId}`;
      btnCl.className = `btn btn-sm ${hasChecklist ? 'btn-icon-checklist-done' : 'btn-secondary'}`;
      btnCl.innerHTML = `<i data-lucide="${hasChecklist ? 'clipboard-check' : 'clipboard-list'}" style="width:14px;height:14px"></i> ${hasChecklist ? 'Ver checklist' : 'Fazer checklist'}`;
      safeIcons(btnCl.parentElement);
    }
    renderCarroInfo();
    renderDespesasTable();
  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar detalhes', 'error');
  }
}

function getTotalDespesas() { return _despesas.reduce((s,d) => s+(parseFloat(d.valor)||0),0); }

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderCarroInfo() {
  const total   = getTotalDespesas();
  const vendido = isCarroVendido(_carro.status);
  const compra  = parseFloat(_carro.valor_compra) || 0;
  const venda   = parseFloat(_carro.valor_venda)  || 0;
  const flags   = getFlags(_carro);
  const done    = allFlagsDone(flags);

  let lucroVal = null, lucroLabel = 'Lucro', lucroEstimado = false;
  if (vendido) { lucroVal = venda - compra - total; }
  else if (venda > 0) { lucroVal = venda - compra - total; lucroLabel = 'Lucro Estimado'; lucroEstimado = true; }

  let pctDisplay = '';
  if (lucroVal !== null && compra > 0) {
    const pct = (lucroVal / compra) * 100;
    pctDisplay = `
      <div class="detail-item detail-item-highlight">
        <div class="detail-label">${lucroEstimado ? 'Margem estimada' : 'Margem de lucro'}</div>
        <div class="detail-value ${pct >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size:22px">${pct.toFixed(1)}%</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:3px">sobre o valor de compra</div>
      </div>`;
  }

  let lucroDisplay;
  if (lucroVal === null) {
    lucroDisplay = `<span class="profit-na">—</span>`;
  } else {
    const cls = lucroVal >= 0 ? 'profit-positive' : 'profit-negative';
    const tag = lucroEstimado
      ? `<span style="font-size:10px;background:var(--warning-light);color:var(--warning);padding:2px 7px;border-radius:20px;font-weight:600;margin-left:6px">estimado</span>`
      : '';
    lucroDisplay = `<span class="${cls}">${formatCurrency(lucroVal)}</span>${tag}`;
  }

  // Badge TRANSFERIDO
  const transferidoHtml = (vendido && done)
    ? `<div style="margin-top:16px"><span class="badge-transferido" style="font-size:14px;padding:6px 18px">✅ TRANSFERIDO</span></div>`
    : '';

  // Flags section
  const flagsHtml = `
    <div class="flags-section">
      <div class="flags-section-title">
        <i data-lucide="clipboard-check" style="width:15px;height:15px"></i>
        Flags de Transferência
        ${done ? '<span class="badge badge-green" style="margin-left:8px">Completo</span>' : `<span class="badge badge-yellow" style="margin-left:8px">${FLAGS_CONFIG.filter(f=>!flags[f.key]).length} pendente(s)</span>`}
      </div>
      <div class="flags-grid-view">
        ${FLAGS_CONFIG.map(f => `
          <div class="flag-view-item ${flags[f.key] ? 'flag-done' : 'flag-pending'}">
            <i data-lucide="${flags[f.key] ? 'check-circle' : 'circle'}" style="width:15px;height:15px"></i>
            <span>${f.label}</span>
          </div>`).join('')}
      </div>
      ${transferidoHtml}
    </div>`;

  document.getElementById('carroStatus').innerHTML = statusBadge(_carro.status);

  document.getElementById('carroInfo').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Tipo</div><div class="detail-value">${(_carro.tipo||'carro') === 'moto' ? '🏍️ Moto' : '🚗 Carro'}</div></div>
      <div class="detail-item"><div class="detail-label">Modelo</div><div class="detail-value">${esc(_carro.modelo)}</div></div>
      <div class="detail-item"><div class="detail-label">Placa</div><div class="detail-value">${esc(_carro.placa)||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Cor</div><div class="detail-value">${esc(_carro.cor)||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Ano</div><div class="detail-value">${_carro.ano||'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Quilometragem</div><div class="detail-value">${_carro.quilometragem?formatNumber(_carro.quilometragem)+' km':'—'}</div></div>
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(_carro.status)}</div></div>
      <div class="detail-item"><div class="detail-label">Data de Compra</div><div class="detail-value">${formatDate(_carro.data_compra)}</div></div>
      <div class="detail-item"><div class="detail-label">Data de Venda</div><div class="detail-value">${formatDate(_carro.data_venda)}</div></div>
      <div class="detail-item"><div class="detail-label">Valor de Compra</div><div class="detail-value currency">${formatCurrency(_carro.valor_compra)}</div></div>
      <div class="detail-item"><div class="detail-label">Valor de Venda</div><div class="detail-value currency">${formatCurrency(_carro.valor_venda)}</div></div>
      <div class="detail-item"><div class="detail-label">Total Despesas</div><div class="detail-value currency">${formatCurrency(total)}</div></div>
      <div class="detail-item"><div class="detail-label">${lucroLabel}</div><div class="detail-value">${lucroDisplay}</div></div>
      ${pctDisplay}
    </div>
    ${_carro.observacoes ? `<div style="margin-top:12px"><div class="detail-label" style="margin-bottom:8px">Observações</div>
      <div style="padding:13px 15px;background:var(--bg);border-radius:var(--radius-sm);font-size:13.5px;line-height:1.7">${esc(_carro.observacoes)}</div></div>` : ''}
    ${flagsHtml}`;

  safeIcons(document.getElementById('carroInfo'));
}

function renderDespesasTable() {
  const tbody = document.getElementById('despesasBody');
  const total = getTotalDespesas();
  if (!_despesas.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:24px">
      <i data-lucide="receipt" style="width:32px;height:32px;opacity:.25;margin-bottom:10px"></i>
      <p>Nenhuma despesa cadastrada</p></div></td></tr>`;
  } else {
    tbody.innerHTML = _despesas.map(d => `
      <tr>
        <td>${esc(d.descricao)}</td>
        <td class="currency">${formatCurrency(d.valor)}</td>
        <td>${d.data ? formatDate(d.data) : '—'}</td>
        <td><div class="actions">
          <button class="btn btn-icon btn-xs" onclick="openEditDespesa('${d.id}')">
            <i data-lucide="pencil" style="width:13px;height:13px"></i></button>
          <button class="btn btn-icon btn-xs btn-icon-danger" onclick="deleteDespesa('${d.id}')">
            <i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
        </div></td>
      </tr>`).join('');
  }
  document.getElementById('despesasTotal').textContent = formatCurrency(total);
  safeIcons(tbody);
  renderCarroInfo();
}

function despesaFormHtml(d = null) {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="form-group">
      <label class="form-label">Descrição *</label>
      <input class="form-input" id="fDescricao" value="${esc(d?.descricao||'')}" placeholder="Ex: IPVA, revisão, funilaria...">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor (R$) *</label>
        <input class="form-input money-input" id="fValor" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input class="form-input" type="date" id="fDataDesp" value="${d?.data || today}">
      </div>
    </div>`;
}

function openAddDespesa() {
  showFormModal('Adicionar Despesa', despesaFormHtml(), {
    confirmText: 'Adicionar', onConfirm: () => saveDespesa(null), width: '420px',
  });
}

function openEditDespesa(id) {
  const d = _despesas.find(x => x.id === id);
  if (!d) return;
  showFormModal('Editar Despesa', despesaFormHtml(d), {
    confirmText: 'Salvar', onConfirm: () => saveDespesa(id), width: '420px',
  });
  setMoneyValue('fValor', d.valor);
}

async function saveDespesa(id) {
  const descricao = document.getElementById('fDescricao').value.trim();
  const valor     = getMoneyValue(document.getElementById('fValor'));
  const data      = document.getElementById('fDataDesp')?.value || null;
  if (!descricao) { showToast('Descrição é obrigatória', 'error'); return; }
  if (!valor || valor <= 0) { showToast('Informe um valor válido', 'error'); return; }
  try {
    if (id) {
      const { error } = await db.from('despesas_carros').update({ descricao, valor, data }).eq('id', id);
      if (error) throw error;
      showToast('Despesa atualizada');
    } else {
      const { error } = await db.from('despesas_carros').insert([{ carro_id: _carroId, descricao, valor, data }]);
      if (error) throw error;
      showToast('Despesa adicionada');
    }
    closeModal();
    await reloadDespesas();
  } catch (err) { showToast('Erro ao salvar despesa', 'error'); }
}

async function deleteDespesa(id) {
  const d  = _despesas.find(x => x.id === id);
  const ok = await showConfirm(`Excluir despesa <strong>${esc(d?.descricao||'')}</strong>?`);
  if (!ok) return;
  try {
    const { error } = await db.from('despesas_carros').delete().eq('id', id);
    if (error) throw error;
    showToast('Despesa excluída');
    await reloadDespesas();
  } catch (err) { showToast('Erro ao excluir', 'error'); }
}

async function reloadDespesas() {
  const res = await db.from('despesas_carros').select('*').eq('carro_id', _carroId).order('created_at', { ascending: true });
  _despesas = res.data || [];
  renderDespesasTable();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btnAddDespesa').addEventListener('click', openAddDespesa);
  await loadDetalhes();
});