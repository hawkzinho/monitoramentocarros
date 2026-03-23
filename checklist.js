// =============================================
// checklist.js
// =============================================

let _carroId   = null;
let _carro     = null;
let _checklist = null;
let _readonly  = false;
let _allCarros = [];
let _allChecklists = [];

async function initChecklist() {
  const params = new URLSearchParams(window.location.search);
  _carroId = params.get('id');

  // Carrega todos os carros e checklists
  try {
    const [r1, r2] = await Promise.all([
      db.from('carros').select('id, modelo, placa, ano, tipo, status').order('modelo'),
      db.from('checklist').select('*'),
    ]);
    if (r1.error) throw r1.error;
    _allCarros     = r1.data || [];
    _allChecklists = r2.data || [];
  } catch(err) {
    showToast('Erro ao carregar dados', 'error');
    return;
  }

  if (_carroId) {
    // Modo: abriu direto num carro específico
    _carro     = _allCarros.find(c => c.id === _carroId);
    _checklist = _allChecklists.find(c => c.carro_id === _carroId) || null;
    renderChecklistForm();
  } else {
    // Modo: tela inicial de seleção
    renderHome();
  }
}

// ── TELA INICIAL ──
function renderHome() {
  const comChecklist    = _allChecklists.map(cl => cl.carro_id);
  const carrosFeitos    = _allCarros.filter(c => comChecklist.includes(c.id));
  const carrosPendentes = _allCarros.filter(c => !comChecklist.includes(c.id));

  document.getElementById('pageTitle').textContent = 'Checklist';
  document.getElementById('topbarRight').innerHTML = '';

  document.getElementById('mainContent').innerHTML = `

    <!-- Seletor de carro -->
    <div class="table-card" style="margin-bottom:20px">
      <div class="table-header">
        <h3>Fazer checklist de um veículo</h3>
      </div>
      <div style="padding:20px">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <label class="form-label">Selecione o veículo</label>
            <select class="form-select" id="selectCarro">
              <option value="">— Escolha um veículo —</option>
              ${_allCarros.map(c => {
                const feito = comChecklist.includes(c.id);
                const label = [c.modelo, c.placa, c.ano].filter(Boolean).join(' · ');
                return `<option value="${c.id}" ${feito ? 'data-feito="1"' : ''}>${feito ? '✅ ' : '📋 '}${label}</option>`;
              }).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="btnIrChecklist" style="height:36px">
            <i data-lucide="arrow-right" style="width:14px;height:14px"></i> Abrir checklist
          </button>
        </div>
      </div>
    </div>

    <!-- Carros com checklist feito -->
    <div class="cards-section-label">Checklists realizados (${carrosFeitos.length})</div>
    <div class="table-card" style="margin-bottom:20px">
      ${carrosFeitos.length === 0 ? `
        <div class="empty-state" style="padding:32px">
          <i data-lucide="clipboard-list" style="width:36px;height:36px;opacity:.25;margin-bottom:10px"></i>
          <p>Nenhum checklist realizado ainda</p>
        </div>` : `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Tipo</th>
              <th class="col-hide-mobile">Placa</th>
              <th class="col-hide-mobile">Ano</th>
              <th>Status</th>
              <th class="col-hide-mobile">Atualizado em</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${carrosFeitos.map(c => {
              const cl = _allChecklists.find(x => x.carro_id === c.id);
              const tipo = (c.tipo || 'carro') === 'moto' ? '🏍️ Moto' : '🚗 Carro';
              return `
                <tr>
                  <td><strong>${esc(c.modelo)}</strong></td>
                  <td>${tipo}</td>
                  <td class="col-hide-mobile">${c.placa || '—'}</td>
                  <td class="col-hide-mobile">${c.ano || '—'}</td>
                  <td>${statusBadge(c.status)}</td>
                  <td class="col-hide-mobile" style="font-size:12px;color:var(--text-muted)">${formatDate(cl?.updated_at?.split('T')[0])}</td>
                  <td>
                    <a href="checklist.html?id=${c.id}" class="btn btn-sm btn-secondary">
                      <i data-lucide="eye" style="width:13px;height:13px"></i> Ver
                    </a>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

    <!-- Carros pendentes -->
    <div class="cards-section-label">Pendentes (${carrosPendentes.length})</div>
    <div class="table-card">
      ${carrosPendentes.length === 0 ? `
        <div class="empty-state" style="padding:32px">
          <i data-lucide="check-circle" style="width:36px;height:36px;color:var(--accent);opacity:.4;margin-bottom:10px"></i>
          <p>Todos os veículos já têm checklist!</p>
        </div>` : `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Tipo</th>
              <th class="col-hide-mobile">Placa</th>
              <th class="col-hide-mobile">Ano</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${carrosPendentes.map(c => {
              const tipo = (c.tipo || 'carro') === 'moto' ? '🏍️ Moto' : '🚗 Carro';
              return `
                <tr>
                  <td><strong>${esc(c.modelo)}</strong></td>
                  <td>${tipo}</td>
                  <td class="col-hide-mobile">${c.placa || '—'}</td>
                  <td class="col-hide-mobile">${c.ano || '—'}</td>
                  <td>${statusBadge(c.status)}</td>
                  <td>
                    <a href="checklist.html?id=${c.id}" class="btn btn-sm btn-primary">
                      <i data-lucide="clipboard-list" style="width:13px;height:13px"></i> Fazer
                    </a>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;

  safeIcons(document.getElementById('mainContent'));

  document.getElementById('btnIrChecklist').addEventListener('click', () => {
    const id = document.getElementById('selectCarro').value;
    if (!id) { showToast('Selecione um veículo', 'warning'); return; }
    window.location.href = `checklist.html?id=${id}`;
  });
}

// ── FORMULÁRIO DE CHECKLIST ──
function renderChecklistForm() {
  if (!_carro) {
    document.getElementById('mainContent').innerHTML = '<p style="color:var(--danger);padding:40px">Veículo não encontrado.</p>';
    return;
  }

  const cl = _checklist || {};
  _readonly = !!_checklist;

  document.title = `Checklist — ${_carro.modelo}`;
  document.getElementById('pageTitle').textContent = `Checklist — ${_carro.modelo}`;
  document.getElementById('topbarRight').innerHTML = statusBadge(_carro.status);

  const views = [
    { key: 'obs_frente',    label: 'Frente',       img: 'car-frente.png'   },
    { key: 'obs_tras',      label: 'Traseira',      img: 'car-tras.png'     },
    { key: 'obs_lado_esq',  label: 'Lado Esquerdo', img: 'car-lado-esq.png' },
    { key: 'obs_lado_dir',  label: 'Lado Direito',  img: 'car-lado-dir.png' },
  ];

  const btnHtml = _checklist
    ? `<div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" id="btnEdit">
          <i data-lucide="pencil" style="width:14px;height:14px"></i> Editar
        </button>
        <button class="btn btn-primary btn-sm" id="btnSave" style="display:none">
          <i data-lucide="save" style="width:14px;height:14px"></i> Salvar
        </button>
        <button class="btn btn-danger btn-sm" id="btnDelete">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i> Excluir
        </button>
       </div>`
    : `<button class="btn btn-primary btn-sm" id="btnSave">
        <i data-lucide="save" style="width:14px;height:14px"></i> Salvar checklist
       </button>`;

  document.getElementById('mainContent').innerHTML = `

    <div class="checklist-vehicle-header">
      <div>
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Veículo inspecionado</div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">${esc(_carro.modelo)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px;display:flex;gap:12px;flex-wrap:wrap">
          ${_carro.placa ? `<span><i data-lucide="credit-card" style="width:11px;height:11px"></i> ${esc(_carro.placa)}</span>` : ''}
          ${_carro.ano   ? `<span><i data-lucide="calendar" style="width:11px;height:11px"></i> ${_carro.ano}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${_checklist ? `<span style="font-size:11px;color:var(--text-muted)">Salvo em ${formatDate(_checklist.updated_at?.split('T')[0])}</span>` : ''}
        ${btnHtml}
        <a href="checklist.html" class="btn btn-secondary btn-sm">
          <i data-lucide="arrow-left" style="width:13px;height:13px"></i> Voltar
        </a>
      </div>
    </div>

    ${!_checklist ? `
    <div class="checklist-intro">
      <i data-lucide="clipboard-list" style="width:18px;height:18px"></i>
      Descreva o estado de cada parte do veículo na entrada. Registre avarias, arranhões ou qualquer observação.
    </div>` : ''}

    <div class="checklist-grid">
      ${views.map(v => `
        <div class="checklist-card">
          <div class="checklist-card-label">
            <i data-lucide="scan-eye" style="width:14px;height:14px"></i>
            ${v.label}
          </div>
          <div class="checklist-img-wrap">
            <img src="${v.img}" alt="${v.label}" class="checklist-car-img">
          </div>
          <div class="checklist-obs-wrap">
            <textarea class="form-textarea checklist-textarea" id="field_${v.key}"
              placeholder="Descreva avarias nesta vista..."
              ${_readonly ? 'readonly' : ''}
            >${esc(cl[v.key] || '')}</textarea>
            ${_readonly && !cl[v.key] ? '<div class="checklist-no-obs"><i data-lucide="check-circle" style="width:13px;height:13px"></i> Sem avarias registradas</div>' : ''}
          </div>
        </div>`).join('')}
    </div>

    <div class="table-card" style="margin-top:6px">
      <div class="table-header"><h3>Observações Gerais</h3></div>
      <div style="padding:16px">
        <textarea class="form-textarea" id="field_obs_geral" style="min-height:90px"
          placeholder="Outras observações gerais sobre o veículo na entrada..."
          ${_readonly ? 'readonly' : ''}
        >${esc(cl.obs_geral || '')}</textarea>
        ${_readonly && !cl.obs_geral ? '<div class="checklist-no-obs" style="margin-top:8px"><i data-lucide="check-circle" style="width:13px;height:13px"></i> Nenhuma observação geral</div>' : ''}
      </div>
    </div>
  `;

  safeIcons(document.getElementById('mainContent'));

  document.getElementById('btnSave')?.addEventListener('click', saveChecklist);

  document.getElementById('btnEdit')?.addEventListener('click', () => {
    _readonly = false;
    document.querySelectorAll('.checklist-textarea, #field_obs_geral').forEach(el => el.removeAttribute('readonly'));
    document.getElementById('btnEdit').style.display = 'none';
    document.getElementById('btnSave').style.display = '';
    document.querySelectorAll('.checklist-no-obs').forEach(el => el.remove());
  });

  document.getElementById('btnDelete')?.addEventListener('click', deleteChecklist);
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function deleteChecklist() {
  const ok = await showConfirm(
    `Excluir o checklist de <strong>${esc(_carro.modelo)}</strong>?<br>
     <span style="font-size:12px;color:var(--text-muted)">Esta ação não pode ser desfeita.</span>`
  );
  if (!ok) return;

  try {
    const { error } = await db.from('checklist').delete().eq('carro_id', _carroId);
    if (error) throw error;
    showToast('Checklist excluído');
    _checklist = null;
    renderChecklistForm();
  } catch (err) {
    showToast('Erro ao excluir', 'error');
  }
}

async function saveChecklist() {
  const data = {
    carro_id:     _carroId,
    obs_frente:   document.getElementById('field_obs_frente')?.value.trim()    || null,
    obs_tras:     document.getElementById('field_obs_tras')?.value.trim()      || null,
    obs_lado_esq: document.getElementById('field_obs_lado_esq')?.value.trim()  || null,
    obs_lado_dir: document.getElementById('field_obs_lado_dir')?.value.trim()  || null,
    obs_geral:    document.getElementById('field_obs_geral')?.value.trim()     || null,
    updated_at:   new Date().toISOString(),
  };

  try {
    if (_checklist) {
      const { error } = await db.from('checklist').update(data).eq('carro_id', _carroId);
      if (error) throw error;
    } else {
      const { data: novo, error } = await db.from('checklist').insert([data]).select().single();
      if (error) throw error;
      _checklist = novo;
    }
    showToast('Checklist salvo!');
    const res = await db.from('checklist').select('*').eq('carro_id', _carroId).maybeSingle();
    _checklist = res.data;
    renderChecklistForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar: ' + (err.message || ''), 'error');
  }
}

document.addEventListener('DOMContentLoaded', initChecklist);