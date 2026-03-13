const SUPABASE_URL = 'https://gzcrkyvpveqatgvartqc.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Y3JreXZwdmVxYXRndmFydHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDA1NTIsImV4cCI6MjA4OTAxNjU1Mn0.KmwLDJyqRVBGwhp8dnNVCDBkrZmnxRiIa-BMFDQWphQ'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

let todosVeiculos  = []
let veiculoAbertoId = null

// ══════════════════════════════════════════
// PROTEÇÃO DE SESSÃO
// ══════════════════════════════════════════
async function inicializar() {
  const { data: { session } } = await db.auth.getSession()
  if (!session) { window.location.href = 'login.html'; return }
  const emailEl = document.getElementById('navUserEmail')
  if (emailEl) emailEl.textContent = session.user.email
  carregarVeiculos()
}

async function fazerLogout() {
  await db.auth.signOut()
  window.location.href = 'login.html'
}

// ══════════════════════════════════════════
// MÁSCARAS DE INPUT
// ══════════════════════════════════════════
function mascaraDinheiro(input) {
  let v = input.value.replace(/\D/g, '')
  if (!v) { input.value = ''; return }
  v = (parseInt(v) / 100).toFixed(2)
  input.value = 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mascaraKm(input) {
  let v = input.value.replace(/\D/g, '')
  if (!v) { input.value = ''; return }
  input.value = parseInt(v).toLocaleString('pt-BR') + ' km'
}

function parseDinheiro(str) {
  if (!str) return 0
  return parseFloat(str.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

function parseKm(str) {
  if (!str) return 0
  return parseInt(str.replace(/\D/g, '')) || 0
}

// ══════════════════════════════════════════
// STATS
// ══════════════════════════════════════════
function atualizarStats(veiculos) {
  const total       = veiculos.length
  const disponiveis = veiculos.filter(v => v.status === 'disponivel').length
  const mes         = new Date().getMonth()
  const ano         = new Date().getFullYear()

  const vendidosMes   = veiculos.filter(v => {
    if (v.status !== 'vendido') return false
    const d = new Date(v.criado_em)
    return d.getMonth() === mes && d.getFullYear() === ano
  })

  const lucroTotal    = veiculos
    .filter(v => v.status !== 'vendido')
    .reduce((a, v) => a + (v.preco_venda - v.preco_compra), 0)

  const receitaMes    = vendidosMes.reduce((a, v) => a + Number(v.preco_venda), 0)

  document.getElementById('statTotal').textContent          = total
  document.getElementById('statTotalSub').textContent       = `${veiculos.filter(v=>v.status==='reservado').length} reservado(s)`
  document.getElementById('statDisponiveis').textContent    = disponiveis
  document.getElementById('statDisponiveisSub').textContent = total ? `${Math.round(disponiveis/total*100)}% do estoque` : '—'
  document.getElementById('statVendidos').textContent       = vendidosMes.length
  document.getElementById('statVendidosSub').textContent    = receitaMes ? `R$ ${formatBRL(receitaMes)}` : 'nenhum este mês'
  document.getElementById('statLucro').textContent          = `R$ ${formatBRL(lucroTotal)}`
  document.getElementById('statLucroSub').textContent       = 'margem potencial no estoque'
}

// ══════════════════════════════════════════
// CARREGAR VEÍCULOS
// ══════════════════════════════════════════
async function carregarVeiculos() {
  mostrarLoading(true)
  const { data, error } = await db
    .from('veiculos')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) { console.error(error); mostrarLoading(false); return }

  todosVeiculos = data || []
  popularFiltroMarcas()
  atualizarStats(todosVeiculos)
  filtrar()
  mostrarLoading(false)
}

function mostrarLoading(show) {
  document.getElementById('loadingState').style.display = show ? 'block' : 'none'
  document.getElementById('emptyState').style.display   = 'none'
  document.getElementById('cardsGrid').style.display    = 'none'
}

function popularFiltroMarcas() {
  const marcas  = [...new Set(todosVeiculos.map(v => v.marca))].sort()
  const sel     = document.getElementById('filtroMarca')
  const atual   = sel.value
  sel.innerHTML = '<option value="">Todas as Marcas</option>'
  marcas.forEach(m => {
    const o = document.createElement('option')
    o.value = m; o.textContent = m
    if (m === atual) o.selected = true
    sel.appendChild(o)
  })
}

// ══════════════════════════════════════════
// FILTRAR E RENDERIZAR CARDS
// ══════════════════════════════════════════
function filtrar() {
  const txt    = document.getElementById('filtroTexto').value.toLowerCase()
  const status = document.getElementById('filtroStatus').value
  const marca  = document.getElementById('filtroMarca').value
  const ordem  = document.getElementById('filtroOrdem').value

  let lista = todosVeiculos.filter(v => {
    const mTxt    = !txt    || `${v.marca} ${v.modelo} ${v.placa}`.toLowerCase().includes(txt)
    const mStatus = !status || v.status === status
    const mMarca  = !marca  || v.marca  === marca
    return mTxt && mStatus && mMarca
  })

  lista.sort((a, b) => {
    if (ordem === 'preco_venda_desc') return b.preco_venda - a.preco_venda
    if (ordem === 'preco_venda_asc')  return a.preco_venda - b.preco_venda
    if (ordem === 'km_asc')           return a.km - b.km
    return new Date(b.criado_em) - new Date(a.criado_em)
  })

  const grid  = document.getElementById('cardsGrid')
  const empty = document.getElementById('emptyState')
  document.getElementById('sectionCount').textContent = `${lista.length} VEÍCULO${lista.length !== 1 ? 'S' : ''}`

  if (!lista.length) { grid.style.display = 'none'; empty.style.display = 'block'; return }
  empty.style.display = 'none'
  grid.style.display  = 'grid'
  grid.innerHTML      = lista.map(cardHTML).join('')
}

// ══════════════════════════════════════════
// CARD HTML
// ══════════════════════════════════════════
const STATUS_CFG = {
  disponivel: { label: 'Disponível', cls: 'badge-disponivel', btn: '',     txt: 'VER DETALHES' },
  reservado:  { label: 'Reservado',  cls: 'badge-reservado',  btn: '',     txt: 'VER DETALHES' },
  vendido:    { label: 'Vendido',    cls: 'badge-vendido',    btn: 'sold', txt: 'VENDIDO'      },
  manutencao: { label: 'Manutenção', cls: 'badge-manutencao', btn: 'manut',txt: 'MANUTENÇÃO'  },
}
const CORES_PH = ['#dce4ea','#e4dcea','#dceae4','#eae4dc','#dce4e0','#e8e0dc']

function cardHTML(v) {
  const st  = STATUS_CFG[v.status] || STATUS_CFG.disponivel
  const bg  = CORES_PH[(v.id || '').charCodeAt(0) % CORES_PH.length]
  const img = v.foto_capa
    ? `<img src="${v.foto_capa}" alt="${esc(v.marca)} ${esc(v.modelo)}" loading="lazy" />`
    : `<div class="card-photo-placeholder" style="background:${bg}">
        <svg width="56" height="40" viewBox="0 0 56 40" fill="none" style="opacity:.28">
          <rect x="4" y="14" width="48" height="20" rx="2" fill="#001a33"/>
          <rect x="10" y="6" width="36" height="12" rx="2" fill="#001a33"/>
          <circle cx="14" cy="34" r="5" fill="#001a33"/><circle cx="42" cy="34" r="5" fill="#001a33"/>
          <circle cx="14" cy="34" r="2.5" fill="${bg}"/><circle cx="42" cy="34" r="2.5" fill="${bg}"/>
        </svg>
      </div>`

  return `
  <div class="vehicle-card" onclick="abrirDetalhes('${v.id}')">
    <div class="card-photo">${img}<span class="status-badge ${st.cls}">${st.label}</span></div>
    <div class="card-body">
      <div class="card-marca">${esc(v.marca)}</div>
      <div class="card-modelo">${esc(v.modelo)}</div>
      <div class="card-meta">
        <span class="meta-tag">${v.ano}</span><span class="meta-sep">·</span>
        <span class="meta-tag">${esc(v.combustivel)}</span><span class="meta-sep">·</span>
        <span class="meta-tag">${esc(v.cambio)}</span>
      </div>
      <div class="card-placa"><span class="placa-dot">●</span>${esc(v.placa)}</div>
      <div class="card-price-row">
        <div>
          <div class="price-label">Preço de Venda</div>
          <div class="price-value"><span class="price-currency">R$</span>${formatBRL(v.preco_venda)}</div>
        </div>
        <div class="km-col">
          <div class="km-value">${formatBRL(v.km)} km</div>
          <div class="km-label">Quilometragem</div>
        </div>
      </div>
    </div>
    <button class="card-btn ${st.btn}" onclick="event.stopPropagation();abrirDetalhes('${v.id}')">${st.txt}</button>
  </div>`
}

// ══════════════════════════════════════════
// MODAL DETALHES — INFORMAÇÕES
// ══════════════════════════════════════════
function abrirDetalhes(id) {
  const v = todosVeiculos.find(x => x.id === id)
  if (!v) return
  veiculoAbertoId = id

  // Reseta abas
  trocarAba('detInfos', document.querySelector('.modal-tab'))

  const st     = STATUS_CFG[v.status] || STATUS_CFG.disponivel
  const lucro  = v.preco_venda - v.preco_compra
  const margem = v.preco_compra > 0 ? ((lucro / v.preco_compra) * 100).toFixed(1) : '0.0'

  document.getElementById('modalDetalhesTitle').textContent = `${v.marca} ${v.modelo} · ${v.ano}`

  document.getElementById('modalDetalhesBody').innerHTML = `
    ${v.foto_capa ? `<img src="${v.foto_capa}" style="width:100%;max-height:220px;object-fit:cover;margin-bottom:16px;display:block"/>` : ''}
    <div class="detail-grid">
      <div class="detail-cell"><div class="detail-label">Marca</div><div class="detail-value" style="color:var(--green);text-transform:uppercase;letter-spacing:.08em">${esc(v.marca)}</div></div>
      <div class="detail-cell"><div class="detail-label">Modelo</div><div class="detail-value">${esc(v.modelo)}</div></div>
      <div class="detail-cell"><div class="detail-label">Ano</div><div class="detail-value">${v.ano}</div></div>
      <div class="detail-cell"><div class="detail-label">Cor</div><div class="detail-value">${esc(v.cor || '—')}</div></div>
      <div class="detail-cell"><div class="detail-label">Placa</div><div class="detail-value"><span class="placa-tag"><span class="dot">●</span>${esc(v.placa)}</span></div></div>
      <div class="detail-cell"><div class="detail-label">Quilometragem</div><div class="detail-value">${formatBRL(v.km)} km</div></div>
      <div class="detail-cell"><div class="detail-label">Combustível</div><div class="detail-value">${esc(v.combustivel)}</div></div>
      <div class="detail-cell"><div class="detail-label">Câmbio</div><div class="detail-value">${esc(v.cambio)}</div></div>
      <div class="detail-cell"><div class="detail-label">Condição</div><div class="detail-value">${condicaoBadge(v.condicao)}</div></div>
      <div class="detail-cell"><div class="detail-label">Nº de Donos</div><div class="detail-value">${v.donos}</div></div>
      <div class="detail-cell full"><div class="detail-label">Status</div><div class="detail-value"><span class="status-badge ${st.cls}" style="position:static;display:inline-block">${st.label}</span></div></div>
      ${v.observacoes ? `<div class="detail-cell full"><div class="detail-label">Observações</div><div class="detail-value" style="font-weight:400;color:var(--muted);font-size:13px;line-height:1.6">${esc(v.observacoes)}</div></div>` : ''}
    </div>
    <div class="modal-price-bar">
      <div>
        <div class="price-bar-label">Preço de Venda</div>
        <div class="price-bar-value"><span class="price-bar-green">R$ </span>${formatBRL(v.preco_venda)}</div>
        <div class="price-bar-sub">Compra: R$ ${formatBRL(v.preco_compra)} · Lucro estimado: <span>R$ ${formatBRL(lucro)} (${margem}%)</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-delete" onclick="confirmarDelete('${v.id}')">EXCLUIR</button>
        <button class="btn-edit"   onclick="abrirEditar('${v.id}')">EDITAR</button>
      </div>
    </div>`

  // Renderiza galeria e despesas em background
  renderizarGaleria(v)
  carregarDespesas(v.id)

  abrirModal('modalDetalhes')
}

function condicaoBadge(c) {
  const map = { 'Ótimo': '#16a34a', 'Bom': '#2563eb', 'Regular': '#d97706', 'Ruim': '#dc2626' }
  const cor = map[c] || '#6b7c8d'
  return `<span style="background:${cor}18;color:${cor};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:3px 9px;border:1px solid ${cor}40">${esc(c)}</span>`
}

// ══════════════════════════════════════════
// ABAS DO MODAL
// ══════════════════════════════════════════
function trocarAba(painelId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'))
  document.getElementById(painelId).classList.add('active')
  if (btn) btn.classList.add('active')
}

// ══════════════════════════════════════════
// GALERIA DE FOTOS
// ══════════════════════════════════════════
function renderizarGaleria(v) {
  const fotos = v.fotos_galeria || []
  const el    = document.getElementById('galeriaFotos')

  if (!fotos.length) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--muted);font-size:13px">Nenhuma foto adicionada ainda.</div>'
    return
  }

  el.innerHTML = fotos.map((url, i) => `
    <div class="galeria-item">
      <img src="${url}" loading="lazy" onclick="verFotoGrande('${url}')" />
      <button class="galeria-del" onclick="removerFotoGaleria(${i})" title="Remover">✕</button>
    </div>`).join('')
}

async function uploadGaleria(event) {
  const v     = todosVeiculos.find(x => x.id === veiculoAbertoId)
  if (!v) return

  const files = Array.from(event.target.files)
  const atual = v.fotos_galeria || []

  if (atual.length + files.length > 6) {
    alert(`Você já tem ${atual.length} foto(s). Máximo é 6 no total. Selecione no máximo ${6 - atual.length}.`)
    event.target.value = ''
    return
  }

  const statusEl = document.getElementById('galeriaUploadStatus')
  statusEl.textContent = 'Enviando fotos…'
  statusEl.style.display = 'block'

  const novasUrls = []
  for (const file of files) {
    try {
      const { blob, fileName } = await compressImageToWebP(file, { quality: 0.80, maxWidth: 1280, maxHeight: 960 })
      const path = `veiculos/${v.id}/galeria/${fileName}`
      const { error: upErr } = await db.storage.from('autoestoque-fotos').upload(path, blob, { contentType: 'image/webp', upsert: true })
      if (upErr) throw upErr
      const { data } = db.storage.from('autoestoque-fotos').getPublicUrl(path)
      novasUrls.push(data.publicUrl)
    } catch (e) {
      console.error(e)
    }
  }

  const novaLista = [...atual, ...novasUrls]
  const { error } = await db.from('veiculos').update({ fotos_galeria: novaLista }).eq('id', v.id)
  if (error) { statusEl.textContent = 'Erro ao salvar: ' + error.message; return }

  // Atualiza cache local
  v.fotos_galeria = novaLista
  renderizarGaleria(v)
  statusEl.textContent = `${novasUrls.length} foto(s) adicionada(s) com sucesso!`
  event.target.value = ''
  setTimeout(() => { statusEl.style.display = 'none' }, 3000)
}

async function removerFotoGaleria(index) {
  if (!confirm('Remover esta foto?')) return
  const v     = todosVeiculos.find(x => x.id === veiculoAbertoId)
  if (!v) return

  const novaLista = (v.fotos_galeria || []).filter((_, i) => i !== index)
  const { error } = await db.from('veiculos').update({ fotos_galeria: novaLista }).eq('id', v.id)
  if (error) { alert('Erro: ' + error.message); return }

  v.fotos_galeria = novaLista
  renderizarGaleria(v)
}

function verFotoGrande(url) {
  window.open(url, '_blank')
}

// ══════════════════════════════════════════
// DESPESAS
// ══════════════════════════════════════════
async function carregarDespesas(veiculoId) {
  const { data, error } = await db
    .from('despesas')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .order('data', { ascending: false })

  if (error) { console.error(error); return }
  renderizarDespesas(data || [])
}

function renderizarDespesas(lista) {
  const el = document.getElementById('listaDespesas')

  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:13px">Nenhuma despesa registrada.</div>'
    document.getElementById('totalDespesas').innerHTML = ''
    return
  }

  const total = lista.reduce((a, d) => a + Number(d.valor), 0)

  el.innerHTML = `
    <div class="despesa-lista">
      ${lista.map(d => `
        <div class="despesa-row">
          <div class="despesa-info">
            <div class="despesa-desc">${esc(d.descricao)}</div>
            <div class="despesa-data">${formatarData(d.data)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="despesa-valor">R$ ${formatBRL(d.valor)}</div>
            <button class="despesa-del" onclick="excluirDespesa('${d.id}')">✕</button>
          </div>
        </div>`).join('')}
    </div>`

  document.getElementById('totalDespesas').innerHTML = `
    <div class="despesa-total-row">
      <span>Total de despesas</span>
      <span style="color:#e74c3c;font-weight:800">R$ ${formatBRL(total)}</span>
    </div>`
}

async function adicionarDespesa() {
  const desc  = document.getElementById('despDescricao').value.trim()
  const valor = parseDinheiro(document.getElementById('despValor').value)
  const erroEl = document.getElementById('despesaErro')

  if (!desc || !valor) {
    erroEl.textContent = 'Preencha a descrição e o valor.'
    erroEl.style.display = 'block'
    return
  }
  erroEl.style.display = 'none'

  const { error } = await db.from('despesas').insert({
    veiculo_id: veiculoAbertoId,
    descricao:  desc,
    valor:      valor,
    data:       new Date().toISOString().split('T')[0]
  })

  if (error) { erroEl.textContent = 'Erro: ' + error.message; erroEl.style.display = 'block'; return }

  document.getElementById('despDescricao').value = ''
  document.getElementById('despValor').value     = ''
  carregarDespesas(veiculoAbertoId)
}

async function excluirDespesa(id) {
  if (!confirm('Remover esta despesa?')) return
  const { error } = await db.from('despesas').delete().eq('id', id)
  if (error) { alert('Erro: ' + error.message); return }
  carregarDespesas(veiculoAbertoId)
}

// ══════════════════════════════════════════
// MODAL CADASTRO / EDIÇÃO
// ══════════════════════════════════════════
function abrirModalCadastro() {
  document.getElementById('modalCadastroTitle').textContent = 'Cadastrar Veículo'
  document.getElementById('editId').value = ''
  document.getElementById('formCadastro').reset()
  document.getElementById('fotoPreview').style.display = 'none'
  limparMensagens()
  abrirModal('modalCadastro')
}

function abrirEditar(id) {
  const v = todosVeiculos.find(x => x.id === id)
  if (!v) return
  fecharModal('modalDetalhes')

  document.getElementById('modalCadastroTitle').textContent = 'Editar Veículo'
  document.getElementById('editId').value = v.id

  document.getElementById('fMarca').value        = v.marca        || ''
  document.getElementById('fModelo').value       = v.modelo       || ''
  document.getElementById('fAno').value          = v.ano          || ''
  document.getElementById('fCor').value          = v.cor          || ''
  document.getElementById('fPlaca').value        = v.placa        || ''
  document.getElementById('fKm').value           = v.km ? formatBRL(v.km) + ' km' : ''
  document.getElementById('fDonos').value        = v.donos        || 1
  document.getElementById('fCombustivel').value  = v.combustivel  || 'Flex'
  document.getElementById('fCambio').value       = v.cambio       || 'Manual'
  document.getElementById('fCondicao').value     = v.condicao     || 'Ótimo'
  document.getElementById('fPrecoCompra').value  = v.preco_compra ? 'R$ ' + Number(v.preco_compra).toLocaleString('pt-BR',{minimumFractionDigits:2}) : ''
  document.getElementById('fPrecoVenda').value   = v.preco_venda  ? 'R$ ' + Number(v.preco_venda).toLocaleString('pt-BR',{minimumFractionDigits:2})  : ''
  document.getElementById('fStatus').value       = v.status       || 'disponivel'
  document.getElementById('fObs').value          = v.observacoes  || ''

  if (v.foto_capa) {
    document.getElementById('fotoPreviewImg').src   = v.foto_capa
    document.getElementById('fotoPreview').style.display = 'block'
  } else {
    document.getElementById('fotoPreview').style.display = 'none'
  }

  limparMensagens()
  abrirModal('modalCadastro')
}

function previewFoto(event) {
  const file = event.target.files[0]
  if (!file) return
  document.getElementById('fotoPreviewImg').src = URL.createObjectURL(file)
  document.getElementById('fotoPreview').style.display = 'block'
}

// ══════════════════════════════════════════
// SALVAR VEÍCULO
// ══════════════════════════════════════════
async function salvarVeiculo(event) {
  event.preventDefault()
  const btn = document.getElementById('btnSalvar')
  btn.disabled = true; btn.textContent = 'Salvando…'
  limparMensagens()

  try {
    const id = document.getElementById('editId').value
    let fotoUrl = id ? (todosVeiculos.find(x => x.id === id) || {}).foto_capa || null : null

    const fotoInput = document.getElementById('fFoto')
    if (fotoInput.files[0]) {
      const { blob, fileName } = await compressImageToWebP(fotoInput.files[0], { quality: 0.80, maxWidth: 1280, maxHeight: 960 })
      const path = `veiculos/${id || 'temp_' + Date.now()}/capa/${fileName}`
      const { error: upErr } = await db.storage.from('autoestoque-fotos').upload(path, blob, { contentType: 'image/webp', upsert: true })
      if (upErr) throw upErr
      const { data } = db.storage.from('autoestoque-fotos').getPublicUrl(path)
      fotoUrl = data.publicUrl
    }

    const payload = {
      marca:        document.getElementById('fMarca').value.trim(),
      modelo:       document.getElementById('fModelo').value.trim(),
      ano:          parseInt(document.getElementById('fAno').value),
      cor:          document.getElementById('fCor').value.trim() || null,
      placa:        document.getElementById('fPlaca').value.trim().toUpperCase(),
      km:           parseKm(document.getElementById('fKm').value),
      donos:        parseInt(document.getElementById('fDonos').value) || 1,
      combustivel:  document.getElementById('fCombustivel').value,
      cambio:       document.getElementById('fCambio').value,
      condicao:     document.getElementById('fCondicao').value,
      preco_compra: parseDinheiro(document.getElementById('fPrecoCompra').value),
      preco_venda:  parseDinheiro(document.getElementById('fPrecoVenda').value),
      status:       document.getElementById('fStatus').value,
      observacoes:  document.getElementById('fObs').value.trim() || null,
    }
    if (fotoUrl !== undefined) payload.foto_capa = fotoUrl

    let error
    if (id) {
      ;({ error } = await db.from('veiculos').update(payload).eq('id', id))
    } else {
      ;({ error } = await db.from('veiculos').insert(payload))
    }
    if (error) throw error

    mostrarSucesso(id ? 'Veículo atualizado!' : 'Veículo cadastrado com sucesso!')
    await carregarVeiculos()
    setTimeout(() => fecharModal('modalCadastro'), 1200)

  } catch (err) {
    mostrarErro(err.message || 'Erro ao salvar.')
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar Veículo'
  }
}

// ══════════════════════════════════════════
// EXCLUIR VEÍCULO
// ══════════════════════════════════════════
async function confirmarDelete(id) {
  if (!confirm('Excluir este veículo permanentemente?')) return
  const { error } = await db.from('veiculos').delete().eq('id', id)
  if (error) { alert('Erro: ' + error.message); return }
  fecharModal('modalDetalhes')
  await carregarVeiculos()
}

// ══════════════════════════════════════════
// MODAIS
// ══════════════════════════════════════════
function abrirModal(id) {
  document.getElementById(id).classList.add('open')
  document.body.style.overflow = 'hidden'
}
function fecharModal(id) {
  document.getElementById(id).classList.remove('open')
  document.body.style.overflow = ''
}
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', function(e) { if (e.target === this) fecharModal(this.id) })
})
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => fecharModal(m.id))
})

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function formatBRL(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function formatarData(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}
function esc(str) {
  if (!str) return ''
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
function mostrarErro(msg)    { const e = document.getElementById('formError');   e.textContent = msg; e.style.display = 'block' }
function mostrarSucesso(msg) { const e = document.getElementById('formSuccess'); e.textContent = msg; e.style.display = 'block' }
function limparMensagens()   {
  document.getElementById('formError').style.display   = 'none'
  document.getElementById('formSuccess').style.display = 'none'
}

inicializar()