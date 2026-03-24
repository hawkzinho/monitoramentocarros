// =============================================
// despesas.js - Despesas Gerais
// =============================================
let _despesas = [], _searchQuery = '', _sortDir = 'desc';

async function loadDespesas() {
  setLoading(true);
  try {
    const { data, error } = await db.from('despesas_gerais').select('*').order('data', { ascending: false });
    if (error) throw error;
    _despesas = data || [];
    renderTable();
  } catch (err) { showToast('Erro ao carregar despesas', 'error'); }
  finally { setLoading(false); }
}

function setLoading(on) {
  if (on) document.getElementById('despesasBody').innerHTML =
    `<tr><td colspan="4"><div class="loading"><div class="spinner"></div> Carregando...</div></td></tr>`;
}

function getFiltered() {
  let list = [..._despesas];
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    list = list.filter(d => d.descricao?.toLowerCase().includes(q));
  }
  list.sort((a,b) => {
    const va = a.data||'', vb = b.data||'';
    if (va < vb) return _sortDir==='asc'?-1:1;
    if (va > vb) return _sortDir==='asc'?1:-1;
    return 0;
  });
  return list;
}

function toggleSort() {
  _sortDir = _sortDir==='asc'?'desc':'asc';
  const th = document.querySelector('th[data-sort="data"]');
  if (th) { th.classList.remove('sort-asc','sort-desc'); th.classList.add(_sortDir==='asc'?'sort-asc':'sort-desc'); }
  renderTable();
}

function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderTable() {
  const filtered = getFiltered();
  const tbody    = document.getElementById('despesasBody');
  const total    = filtered.reduce((s,d)=>s+(parseFloat(d.valor)||0),0);
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">
      <i data-lucide="receipt" style="width:36px;height:36px;opacity:.25;margin-bottom:10px"></i>
      <p>Nenhuma despesa encontrada</p></div></td></tr>`;
    document.getElementById('footerTotal').textContent = formatCurrency(0);
    safeIcons(tbody); return;
  }
  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td>${esc(d.descricao)}</td>
      <td class="currency">${formatCurrency(d.valor)}</td>
      <td>${formatDate(d.data)}</td>
      <td><div class="actions">
        <button class="btn btn-icon btn-xs" onclick="openEdit('${d.id}')">
          <i data-lucide="pencil" style="width:13px;height:13px"></i></button>
        <button class="btn btn-icon btn-xs btn-icon-danger" onclick="deleteDespesa('${d.id}')">
          <i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
      </div></td>
    </tr>`).join('');
  document.getElementById('footerTotal').textContent = formatCurrency(total);
  safeIcons(tbody);
}

function despesaFormHtml(d = null) {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="form-group">
      <label class="form-label">Descrição *</label>
      <input class="form-input" id="fDescricao" value="${esc(d?.descricao||'')}" placeholder="Ex: Aluguel, energia, salário...">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor (R$) *</label>
        <input class="form-input money-input" id="fValor" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input class="form-input" type="date" id="fData" value="${d?.data||today}">
      </div>
    </div>`;
}

function openAdd() {
  showFormModal('Adicionar Despesa Geral', despesaFormHtml(), {
    confirmText: 'Adicionar', onConfirm: () => save(null), width: '440px',
  });
}

function openEdit(id) {
  const d = _despesas.find(x => x.id === id);
  if (!d) return;
  showFormModal('Editar Despesa', despesaFormHtml(d), {
    confirmText: 'Salvar', onConfirm: () => save(id), width: '440px',
  });
  setMoneyValue('fValor', d.valor);
}

async function save(id) {
  const descricao = document.getElementById('fDescricao').value.trim();
  const valor     = getMoneyValue(document.getElementById('fValor'));
  const data      = document.getElementById('fData').value;
  if (!descricao) { showToast('Descrição é obrigatória', 'error'); return; }
  if (!valor || valor <= 0) { showToast('Informe um valor válido', 'error'); return; }
  if (!data)   { showToast('Informe a data', 'error'); return; }
  try {
    if (id) {
      const { error } = await db.from('despesas_gerais').update({ descricao, valor, data }).eq('id', id);
      if (error) throw error;
      showToast('Despesa atualizada');
    } else {
      const { error } = await db.from('despesas_gerais').insert([{ descricao, valor, data }]);
      if (error) throw error;
      showToast('Despesa adicionada');
    }
    closeModal();
    await loadDespesas();
  } catch (err) { showToast('Erro ao salvar', 'error'); }
}

async function deleteDespesa(id) {
  const d  = _despesas.find(x => x.id === id);
  const ok = await showConfirm(`Excluir a despesa <strong>${esc(d?.descricao||'')}</strong>?`);
  if (!ok) return;
  try {
    const { error } = await db.from('despesas_gerais').delete().eq('id', id);
    if (error) throw error;
    showToast('Despesa excluída');
    await loadDespesas();
  } catch (err) { showToast('Erro ao excluir', 'error'); }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btnAdd').addEventListener('click', openAdd);
  document.getElementById('searchInput').addEventListener('input', e => { _searchQuery = e.target.value; renderTable(); });
  document.querySelector('th[data-sort="data"]')?.addEventListener('click', toggleSort);
  await loadDespesas();
});