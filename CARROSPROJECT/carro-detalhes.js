// =============================================
// carro-detalhes.js
// =============================================
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
    document.title = `AutoGest - ${_carro.modelo}`;
    document.getElementById('pageTitle').textContent = _carro.modelo;
    renderCarroInfo(); renderDespesasTable();
  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar detalhes', 'error');
  }
}

function getTotalDespesas() { return _despesas.reduce((s,d) => s+(parseFloat(d.valor)||0),0); }

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderCarroInfo() {
  const total = getTotalDespesas();
  const lucro = calcLucroCarro(_carro, total);
  document.getElementById('carroStatus').innerHTML = statusBadge(_carro.status);
  const lucroDisplay = lucro === null
    ? `<span class="profit-na">N/A — carro não vendido</span>`
    : `<span class="${lucro >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(lucro)}</span>`;

  document.getElementById('carroInfo').innerHTML = `
    <div class="detail-grid">
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
      <div class="detail-item"><div class="detail-label">Lucro</div><div class="detail-value">${lucroDisplay}</div></div>
    </div>
    ${_carro.observacoes ? `<div style="margin-top:4px"><div class="detail-label" style="margin-bottom:8px">Observações</div>
      <div style="padding:13px 15px;background:var(--bg);border-radius:var(--radius-sm);font-size:13.5px;line-height:1.7">${esc(_carro.observacoes)}</div></div>` : ''}`;
}

function renderDespesasTable() {
  const tbody = document.getElementById('despesasBody');
  const total = getTotalDespesas();
  if (!_despesas.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:24px">
      <i data-lucide="receipt" style="width:32px;height:32px;opacity:.25;margin-bottom:10px"></i>
      <p>Nenhuma despesa cadastrada</p></div></td></tr>`;
  } else {
    tbody.innerHTML = _despesas.map(d => `
      <tr>
        <td>${esc(d.descricao)}</td>
        <td class="currency">${formatCurrency(d.valor)}</td>
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
  return `
    <div class="form-group">
      <label class="form-label">Descrição *</label>
      <input class="form-input" id="fDescricao" value="${esc(d?.descricao||'')}" placeholder="Ex: IPVA, revisão, funilaria...">
    </div>
    <div class="form-group">
      <label class="form-label">Valor (R$) *</label>
      <input class="form-input money-input" id="fValor" placeholder="0,00">
    </div>`;
}

function openAddDespesa() {
  showFormModal('Adicionar Despesa', despesaFormHtml(), {
    confirmText: 'Adicionar', onConfirm: () => saveDespesa(null), width: '400px',
  });
}

function openEditDespesa(id) {
  const d = _despesas.find(x => x.id === id);
  if (!d) return;
  showFormModal('Editar Despesa', despesaFormHtml(d), {
    confirmText: 'Salvar', onConfirm: () => saveDespesa(id), width: '400px',
  });
  setMoneyValue('fValor', d.valor);
}

async function saveDespesa(id) {
  const descricao = document.getElementById('fDescricao').value.trim();
  const valor     = getMoneyValue(document.getElementById('fValor'));
  if (!descricao) { showToast('Descrição é obrigatória', 'error'); return; }
  if (!valor || valor <= 0) { showToast('Informe um valor válido', 'error'); return; }
  try {
    if (id) {
      const { error } = await db.from('despesas_carros').update({ descricao, valor }).eq('id', id);
      if (error) throw error;
      showToast('Despesa atualizada');
    } else {
      const { error } = await db.from('despesas_carros').insert([{ carro_id: _carroId, descricao, valor }]);
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