// =============================================
// app.js - Utilitários compartilhados
// =============================================

// ── Lucide icon helper ──
function icon(name, size = 16) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;stroke-width:2;vertical-align:middle;flex-shrink:0"></i>`;
}

function safeIcons(scope) {
  try {
    if (!window.lucide) return;
    scope ? lucide.createIcons({ scope }) : lucide.createIcons();
  } catch(e) { /* versão sem scope support – tenta global */ try { lucide.createIcons(); } catch(_){} }
}

// ── Sidebar ──
const NAV_ITEMS = [
  { href: 'index.html',      lucide: 'layout-dashboard', label: 'Dashboard',  match: ['index', ''] },
  { href: 'carros.html',     lucide: 'car',              label: 'Veículos',   match: ['carros', 'carro-detalhes'] },
  { href: 'despesas.html',   lucide: 'receipt',          label: 'Despesas',   match: ['despesas'] },
  { href: 'relatorios.html', lucide: 'bar-chart-2',      label: 'Relatórios', match: ['relatorios'] },
  { href: 'checklist.html',  lucide: 'clipboard-list',   label: 'Checklist',  match: ['checklist'] },
];

function getCurrentPage() {
  let path = window.location.pathname || '';
  path = path.replace(/\/+$/, '');

  let page = path.split('/').pop() || 'index';
  page = page.toLowerCase();

  if (!page || page === '/') return 'index';

  return page.replace('.html', '');
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const page   = getCurrentPage();
  const isDark = localStorage.getItem('theme') === 'dark';

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <img src="logo.png" alt="Matheus Veículos" class="sidebar-logo-img">
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-label">Menu Principal</div>
      ${NAV_ITEMS.map(item => {
        const active = item.match.some(route => route === page);
        return `
          <a href="${item.href}" class="nav-item ${active ? 'active' : ''}">
            <span class="nav-icon">${icon(item.lucide, 16)}</span>
            <span>${item.label}</span>
          </a>`;
      }).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="theme-switch">
        <span class="theme-switch-label">${icon('moon', 13)} Modo escuro</span>
        <label class="switch">
          <input type="checkbox" id="themeToggle" ${isDark ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
    </div>
  `;

  document.getElementById('themeToggle').addEventListener('change', e => {
    const dark = e.target.checked;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });

  safeIcons(sidebar);
}

// ── Theme ──
function initTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Status Config ──
const STATUS_CONFIG = {
  disponivel: { label: 'Disponível', badge: 'badge-blue'   },
  vendido:    { label: 'Vendido',    badge: 'badge-green'  },
  repasse:    { label: 'Repasse',    badge: 'badge-purple' },
};

function statusBadge(status) {
  const cfg = STATUS_CONFIG[status] || { label: status, badge: 'badge-gray' };
  return `<span class="badge ${cfg.badge}">${cfg.label}</span>`;
}

// ── Formatters ──
function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Auto-reduz fonte de .card-value quando o texto é longo
function autoSizeCardValues() {
  document.querySelectorAll('.card-value').forEach(el => {
    const text = el.textContent || '';
    el.classList.remove('value-md', 'value-sm');
    if (text.length > 14) el.classList.add('value-sm');
    else if (text.length > 10) el.classList.add('value-md');
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR').format(value);
}

// ── Month/Year helpers ──
function getMonthOptions() {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    .map((label, i) => ({ value: i + 1, label }));
}

function getYearOptions(startYear = 2020) {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current + 1; y >= startYear; y--) years.push(y);
  return years;
}

function fillMonthYear(monthId, yearId) {
  const now      = new Date();
  const monthSel = document.getElementById(monthId);
  const yearSel  = document.getElementById(yearId);
  if (!monthSel || !yearSel) return;

  monthSel.innerHTML = '';
  yearSel.innerHTML  = '';

  getMonthOptions().forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    if (m.value === now.getMonth() + 1) opt.selected = true;
    monthSel.appendChild(opt);
  });

  getYearOptions().forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    yearSel.appendChild(opt);
  });
}

function getMonthRange(month, year) {
  const m     = parseInt(month);
  const y     = parseInt(year);
  const start = `${y}-${String(m).padStart(2,'0')}-01`;
  const end   = new Date(y, m, 0).toISOString().split('T')[0];
  return { start, end };
}

// ── Modal System ──
let _modalResolve = null;

function openModalOverlay() {
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal(value = null) {
  document.getElementById('modalOverlay').classList.remove('active');
  if (_modalResolve) { _modalResolve(value); _modalResolve = null; }
}

function buildModal(title, bodyHTML, footerHTML, width = null) {
  const modal = document.getElementById('modal');
  if (width) modal.style.maxWidth = width;
  else modal.style.maxWidth = '';

  modal.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" onclick="closeModal()">${icon('x', 16)}</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>
    <div class="modal-footer">${footerHTML}</div>
  `;
  openModalOverlay();
  safeIcons(modal);
  // Aplica máscara de dinheiro em todos os inputs de valor do modal
  initMoneyInputs(modal);
}

function showConfirm(message, title = 'Confirmar exclusão') {
  return new Promise(resolve => {
    _modalResolve = resolve;
    buildModal(
      title,
      `<p style="color:var(--text);line-height:1.7;font-size:13.5px">${message}</p>`,
      `<button class="btn btn-secondary" onclick="closeModal(false)">Cancelar</button>
       <button class="btn btn-danger" onclick="closeModal(true)">Excluir</button>`,
      '400px'
    );
  });
}

function showFormModal(title, bodyHTML, { confirmText = 'Salvar', onConfirm, width = null } = {}) {
  buildModal(
    title,
    bodyHTML,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" id="_modalOk">${confirmText}</button>`,
    width
  );
  document.getElementById('_modalOk').onclick = () => { if (onConfirm) onConfirm(); };
}

// ── Toast ──
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const iconsMap = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icon(iconsMap[type] || 'info', 15)}<span>${message}</span>`;
  container.appendChild(toast);
  safeIcons(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(110%)';
    setTimeout(() => toast.remove(), 320);
  }, 3200);
}

// ── Business Logic ──
function isCarroVendido(status) {
  return ['vendido', 'repasse'].includes(status);
}

function calcLucroCarro(carro, totalDespesas) {
  if (!isCarroVendido(carro.status)) return null;
  return (parseFloat(carro.valor_venda) || 0) - (parseFloat(carro.valor_compra) || 0) - (totalDespesas || 0);
}

// =============================================
// MÁSCARA DE DINHEIRO
// Comportamento: digita números → preenche da
// direita pra esquerda (estilo calculadora).
// Ex: 1 → 0,01 | 150 → 1,50 | 1500 → 15,00
// =============================================

function applyMoneyMask(input) {
  if (input.dataset.moneyMaskApplied) return;
  input.dataset.moneyMaskApplied = '1';
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('readonly', 'false');

  // Se vier com value numérico pré-preenchido, converte para centavos
  let rawVal = parseFloat(input.value || input.dataset.initValue || '0') || 0;
  let cents  = Math.round(rawVal * 100);
  updateDisplay();

  function updateDisplay() {
    input.dataset.cents = cents;
    if (cents === 0) {
      input.value = '';
      input.placeholder = '0,00';
      return;
    }
    const reais    = Math.floor(cents / 100);
    const centsPart = String(cents % 100).padStart(2, '0');
    const reaisStr = reais.toLocaleString('pt-BR');
    input.value = reaisStr + ',' + centsPart;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const newCents = parseInt(String(cents) + e.key);
      if (newCents > 999999999) return;
      cents = newCents;
      updateDisplay();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      cents = Math.floor(cents / 10);
      updateDisplay();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      cents = 0;
      updateDisplay();
    } else if (['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      // deixa passar
    } else {
      e.preventDefault();
    }
  });

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const digits = pasted.replace(/\D/g, '');
    if (!digits) return;
    const parsed = Math.min(parseInt(digits), 999999999);
    cents = parsed;
    updateDisplay();
  });

  input.addEventListener('click', () => {
    setTimeout(() => {
      try { input.setSelectionRange(input.value.length, input.value.length); } catch(_) {}
    }, 0);
  });
}

// Aplica a todos .money-input num container
function initMoneyInputs(container) {
  (container || document).querySelectorAll('.money-input').forEach(applyMoneyMask);
}

// Lê o valor numérico de um input com máscara
function getMoneyValue(input) {
  const c = parseInt(input.dataset.cents || '0');
  return c / 100;
}

// Seta valor programaticamente em input com máscara
function setMoneyValue(inputOrId, value) {
  const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;
  const num = parseFloat(value) || 0;
  input.dataset.initValue = num;
  if (input.dataset.moneyMaskApplied) {
    input.dataset.cents = Math.round(num * 100);
    const cents    = parseInt(input.dataset.cents);
    const reais    = Math.floor(cents / 100);
    const centsPart = String(cents % 100).padStart(2, '0');
    input.value   = cents === 0 ? '' : reais.toLocaleString('pt-BR') + ',' + centsPart;
  }
}

// ── Sidebar toggle (mobile) ──
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('active', !isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
}

// ── Init ──
initTheme();
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();

  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(null); });

  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  const hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.addEventListener('click', toggleSidebar);

  safeIcons();
  // Observer para redimensionar card values quando atualizados
  const cardObserver = new MutationObserver(autoSizeCardValues);
  document.querySelectorAll('.card-value').forEach(el => cardObserver.observe(el, { childList: true, characterData: true, subtree: true }));
  autoSizeCardValues();
});