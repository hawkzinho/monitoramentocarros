// =============================================
// carros.js - Gestão de Carros
// =============================================

let _carros       = [];
let _despPorCarro = {};
let _sortField    = 'created_at';
let _sortDir      = 'desc';
let _searchQuery  = '';
let _filterStatus = '';
let _formDespesas = [];

async function loadCarros() {
  setTableLoading('carrosBody', 9);
  try {
    const [r1, r2] = await Promise.all([
      db.from('carros').select('*').order('created_at', { ascending: false }),
      db.from('despesas_carros').select('carro_id, valor'),
    ]);
    if (r1.error) throw r1.error;
    if (r2.error) throw r2.error;
    _carros = r1.data || [];
    _despPorCarro = {};
    (r2.data || []).forEach(d => {
      _despPorCarro[d.carro_id] = (_despPorCarro[d.carro_id] || 0) + (parseFloat(d.valor) || 0);
    });
    renderTable();
    renderCarrosCards();
  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar carros', 'error');
  }
}

function renderCarrosCards() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const { start, end } = getMonthRange(month, year);

  const emEstoque  = _carros.filter(c => !isCarroVendido(c.status));
  const vendidosMes = _carros.filter(c =>
    isCarroVendido(c.status) && c.data_venda >= start && c.data_venda <= end
  );

  const valorEstoque = emEstoque.reduce((s, c) => s + (parseFloat(c.valor_compra) || 0), 0);
  const despEstoque  = emEstoque.reduce((s, c) => s + (_despPorCarro[c.id] || 0), 0);

  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long' });

  setText('cardTotalVeiculos', _carros.length);
  setText('cardEstoque',       emEstoque.length);
  setText('cardValorEstoque',  formatCurrency(valorEstoque));
  setText('cardDespEstoque',   formatCurrency(despEstoque));
  setText('cardVendidosMes',   vendidosMes.length);
  setText('cardVendidosMesSub', monthName.charAt(0).toUpperCase() + monthName.slice(1));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setTableLoading(tbodyId, cols) {
  document.getElementById(tbodyId).innerHTML =
    `<tr><td colspan="${cols}"><div class="loading"><div class="spinner"></div> Carregando...</div></td></tr>`;
}

function getFiltered() {
  let list = [..._carros];
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    list = list.filter(c => c.modelo?.toLowerCase().includes(q) || c.placa?.toLowerCase().includes(q));
  }
  if (_filterStatus) list = list.filter(c => c.status === _filterStatus);
  list.sort((a, b) => {
    let va, vb;
    switch (_sortField) {
      case 'data_compra':  va = a.data_compra || '';  vb = b.data_compra || '';  break;
      case 'valor_compra': va = parseFloat(a.valor_compra)||0; vb = parseFloat(b.valor_compra)||0; break;
      case 'status':       va = a.status || '';       vb = b.status || '';       break;
      case 'modelo':       va = a.modelo?.toLowerCase()||''; vb = b.modelo?.toLowerCase()||''; break;
      default:             va = a.created_at || '';   vb = b.created_at || '';
    }
    if (va < vb) return _sortDir === 'asc' ? -1 : 1;
    if (va > vb) return _sortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return list;
}

function setSort(field) {
  if (_sortField === field) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
  else { _sortField = field; _sortDir = 'asc'; }
  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === field) th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
  });
  renderTable();
}

function renderTable() {
  const tbody    = document.getElementById('carrosBody');
  const filtered = getFiltered();
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <i data-lucide="car" style="width:36px;height:36px;opacity:.25;margin-bottom:10px"></i>
      <p>Nenhum carro encontrado</p></div></td></tr>`;
    safeIcons(tbody); return;
  }
  tbody.innerHTML = filtered.map(c => {
    const desp  = _despPorCarro[c.id] || 0;
    const lucro = calcLucroCarro(c, desp);
    const lucroHtml = lucro === null
      ? '<span class="profit-na">—</span>'
      : `<span class="currency ${lucro >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(lucro)}</span>`;
    return `
      <tr>
        <td><strong>${esc(c.modelo)}</strong>
          ${c.cor ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(c.cor)}</div>` : ''}
        </td>
        <td>${c.placa ? esc(c.placa) : '—'}</td>
        <td class="col-hide-mobile">${c.ano || '—'}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="currency">${formatCurrency(c.valor_compra)}</td>
        <td class="currency">${formatCurrency(c.valor_venda)}</td>
        <td class="currency col-hide-mobile">${formatCurrency(desp)}</td>
        <td>${lucroHtml}</td>
        <td>
          <div class="actions">
            <a href="carro-detalhes.html?id=${c.id}" class="btn btn-icon btn-xs" title="Ver detalhes">
              <i data-lucide="eye" style="width:13px;height:13px"></i></a>
            <button class="btn btn-icon btn-xs" onclick="openEditCarro('${c.id}')" title="Editar">
              <i data-lucide="pencil" style="width:13px;height:13px"></i></button>
            <button class="btn btn-icon btn-xs" onclick="openChangeStatus('${c.id}')" title="Mudar status">
              <i data-lucide="refresh-cw" style="width:13px;height:13px"></i></button>
            <button class="btn btn-icon btn-xs btn-icon-danger" onclick="deleteCarro('${c.id}')" title="Excluir">
              <i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
  safeIcons(tbody);
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Formulário ──
function carroFormHtml(c = null) {
  const needsDate = isCarroVendido(c?.status);
  return `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Modelo *</label>
        <input class="form-input" id="fModelo" value="${esc(c?.modelo || '')}" placeholder="Ex: Honda Civic 2020">
      </div>
      <div class="form-group">
        <label class="form-label">Placa</label>
        <input class="form-input" id="fPlaca" value="${esc(c?.placa || '')}" placeholder="ABC-1D23">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Cor</label>
        <input class="form-input" id="fCor" value="${esc(c?.cor || '')}" placeholder="Branco">
      </div>
      <div class="form-group">
        <label class="form-label">Ano</label>
        <input class="form-input" type="number" id="fAno" value="${c?.ano || ''}" placeholder="${new Date().getFullYear()}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Quilometragem (km)</label>
        <input class="form-input" type="number" id="fKm" value="${c?.quilometragem || ''}" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="fStatus" onchange="toggleFormDataVenda()">
          ${statusOptions(c?.status || 'disponivel')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data de Compra</label>
        <input class="form-input" type="date" id="fDataCompra" value="${c?.data_compra || ''}">
      </div>
      <div class="form-group" id="dataVendaGroup" style="${needsDate ? '' : 'display:none'}">
        <label class="form-label">Data de Venda</label>
        <input class="form-input" type="date" id="fDataVenda" value="${c?.data_venda || ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Valor de Compra (R$)</label>
        <input class="form-input money-input" id="fValorCompra" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Valor de Venda (R$)</label>
        <input class="form-input money-input" id="fValorVenda" placeholder="0,00">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observações</label>
      <textarea class="form-textarea" id="fObs">${esc(c?.observacoes || '')}</textarea>
    </div>
    <div class="form-section-divider"><span>Despesas do Carro</span></div>
    <div id="formDespesasList"></div>
    <button type="button" class="btn-add-despesa" onclick="addFormDespesa()">
      <i data-lucide="plus" style="width:14px;height:14px"></i> Adicionar despesa
    </button>`;
}

function toggleFormDataVenda() {
  const sel   = document.getElementById('fStatus');
  const group = document.getElementById('dataVendaGroup');
  if (sel && group) group.style.display = isCarroVendido(sel.value) ? '' : 'none';
}

function statusOptions(selected) {
  return Object.entries(STATUS_CONFIG)
    .map(([k,v]) => `<option value="${k}" ${k===selected?'selected':''}>${v.label}</option>`)
    .join('');
}

// ── Despesas inline ──
function addFormDespesa(desc = '', val = 0) {
  _formDespesas.push({ descricao: desc, valor: val });
  renderFormDespesas();
}

function removeFormDespesa(idx) {
  _formDespesas.splice(idx, 1);
  renderFormDespesas();
}

function renderFormDespesas() {
  const container = document.getElementById('formDespesasList');
  if (!container) return;

  if (!_formDespesas.length) { container.innerHTML = ''; return; }

  container.innerHTML = _formDespesas.map((d, i) => `
    <div class="despesa-row" id="despRow${i}">
      <input class="form-input" id="dDesc${i}" placeholder="Descrição (ex: pintura, revisão...)"
        value="${esc(d.descricao)}" oninput="_formDespesas[${i}].descricao=this.value" style="flex:1">
      <div style="position:relative;width:150px;flex-shrink:0">
        <span class="input-prefix">R$</span>
        <input class="form-input money-input" id="dValor${i}"
          placeholder="0,00" style="padding-left:34px">
      </div>
      <button type="button" class="btn btn-icon btn-xs btn-icon-danger" onclick="removeFormDespesa(${i})" title="Remover">
        <i data-lucide="x" style="width:12px;height:12px"></i>
      </button>
    </div>`).join('');

  safeIcons(container);
  initMoneyInputs(container);

  // Preenche valores já existentes
  _formDespesas.forEach((d, i) => {
    if (d.valor) setMoneyValue(`dValor${i}`, d.valor);
  });
}

// Lê despesas do form antes de salvar
function readFormDespesas() {
  return _formDespesas.map((d, i) => {
    const valInput = document.getElementById(`dValor${i}`);
    return {
      descricao: d.descricao,
      valor: valInput ? getMoneyValue(valInput) : (parseFloat(d.valor) || 0),
    };
  }).filter(d => d.descricao?.trim() && d.valor > 0);
}

// ── Add / Edit ──
function openAddCarro() {
  _formDespesas = [];
  showFormModal('Adicionar Carro', carroFormHtml(null), {
    confirmText: 'Adicionar', onConfirm: () => saveCarro(null), width: '620px',
  });
  renderFormDespesas();
}

async function openEditCarro(id) {
  const carro = _carros.find(c => c.id === id);
  if (!carro) return;
  _formDespesas = [];
  try {
    const { data } = await db.from('despesas_carros').select('*').eq('carro_id', id);
    _formDespesas = (data || []).map(d => ({ id: d.id, descricao: d.descricao, valor: parseFloat(d.valor)||0 }));
  } catch(e) {}

  showFormModal('Editar Carro', carroFormHtml(carro), {
    confirmText: 'Salvar', onConfirm: () => saveCarro(id), width: '620px',
  });

  // Preenche valores monetários APÓS modal abrir
  setMoneyValue('fValorCompra', carro.valor_compra || 0);
  setMoneyValue('fValorVenda',  carro.valor_venda  || 0);
  renderFormDespesas();
}

async function saveCarro(id) {
  const modelo = document.getElementById('fModelo').value.trim();
  if (!modelo) { showToast('Modelo é obrigatório', 'error'); return; }

  const data = {
    modelo,
    placa:         document.getElementById('fPlaca').value.trim()       || null,
    cor:           document.getElementById('fCor').value.trim()         || null,
    ano:           parseInt(document.getElementById('fAno').value)      || null,
    quilometragem: parseInt(document.getElementById('fKm').value)       || null,
    status:        document.getElementById('fStatus').value,
    data_compra:   document.getElementById('fDataCompra').value         || null,
    data_venda:    document.getElementById('fDataVenda')?.value         || null,
    valor_compra:  getMoneyValue(document.getElementById('fValorCompra')) || null,
    valor_venda:   getMoneyValue(document.getElementById('fValorVenda'))  || null,
    observacoes:   document.getElementById('fObs').value.trim()         || null,
  };

  const despesasValidas = readFormDespesas();

  try {
    let carroId = id;
    if (id) {
      const { error } = await db.from('carros').update(data).eq('id', id);
      if (error) throw error;
      await db.from('despesas_carros').delete().eq('carro_id', id);
    } else {
      const { data: novo, error } = await db.from('carros').insert([data]).select().single();
      if (error) throw error;
      carroId = novo.id;
    }

    if (despesasValidas.length) {
      const rows = despesasValidas.map(d => ({ carro_id: carroId, descricao: d.descricao.trim(), valor: d.valor }));
      const { error } = await db.from('despesas_carros').insert(rows);
      if (error) throw error;
    }

    showToast(id ? 'Carro atualizado' : 'Carro adicionado');
    closeModal();
    await loadCarros();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar: ' + (err.message || ''), 'error');
  }
}

async function deleteCarro(id) {
  const carro = _carros.find(c => c.id === id);
  const ok = await showConfirm(`Excluir o carro <strong>${esc(carro?.modelo||'')}</strong>?<br>
    <span style="font-size:12px;color:var(--text-muted)">As despesas vinculadas também serão excluídas.</span>`);
  if (!ok) return;
  try {
    const { error } = await db.from('carros').delete().eq('id', id);
    if (error) throw error;
    showToast('Carro excluído');
    await loadCarros();
  } catch (err) {
    showToast('Erro ao excluir', 'error');
  }
}

// ── Change Status ──
function openChangeStatus(id) {
  const carro = _carros.find(c => c.id === id);
  if (!carro) return;
  const today = new Date().toISOString().split('T')[0];
  showFormModal('Mudar Status', `
    <p style="margin-bottom:16px;font-size:13px;color:var(--text-muted)">
      Carro: <strong style="color:var(--text)">${esc(carro.modelo)}</strong>
    </p>
    <div class="form-group">
      <label class="form-label">Novo Status</label>
      <select class="form-select" id="newStatus" onchange="toggleDataVendaModal()">
        ${statusOptions(carro.status)}
      </select>
    </div>
    <div class="form-group" id="dataVendaGroupModal" style="${isCarroVendido(carro.status)?'':'display:none'}">
      <label class="form-label">Data de Venda *</label>
      <input class="form-input" type="date" id="newDataVenda" value="${carro.data_venda || today}">
    </div>`,
    { confirmText: 'Salvar', onConfirm: () => saveStatus(id), width: '400px' }
  );
}

function toggleDataVendaModal() {
  const sel   = document.getElementById('newStatus');
  const group = document.getElementById('dataVendaGroupModal');
  if (sel && group) group.style.display = isCarroVendido(sel.value) ? '' : 'none';
}

async function saveStatus(id) {
  const newStatus = document.getElementById('newStatus').value;
  const update    = { status: newStatus };
  if (isCarroVendido(newStatus)) {
    const dv = document.getElementById('newDataVenda')?.value;
    if (!dv) { showToast('Informe a data de venda', 'warning'); return; }
    update.data_venda = dv;
  }
  try {
    const { error } = await db.from('carros').update(update).eq('id', id);
    if (error) throw error;
    showToast('Status atualizado');
    closeModal();
    await loadCarros();
  } catch (err) {
    showToast('Erro ao atualizar status', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btnAddCarro').addEventListener('click', openAddCarro);
  document.getElementById('searchInput').addEventListener('input', e => { _searchQuery = e.target.value; renderTable(); });
  document.getElementById('filterStatus').addEventListener('change', e => { _filterStatus = e.target.value; renderTable(); });
  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => setSort(th.dataset.sort));
  });
  await loadCarros();
});