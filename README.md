# 🚘 AutoGest — Sistema de Gestão de Veículos Usados

Sistema web estático para gerenciamento de uma loja de veículos usados.  
Stack: HTML + CSS + JavaScript puro + Supabase.  
Deploy: Cloudflare Pages (zero backend).

---

## 📁 Estrutura de Arquivos

```
autogest/
├── index.html            → Dashboard
├── carros.html           → Lista de carros
├── carro-detalhes.html   → Detalhes de um carro
├── despesas.html         → Despesas gerais
├── relatorios.html       → Relatórios mensais
├── css/
│   └── style.css         → Estilos completos + temas claro/escuro
├── js/
│   ├── supabase-config.js → Configuração do Supabase ← EDITAR AQUI
│   ├── app.js             → Utilitários compartilhados
│   ├── dashboard.js       → Lógica do dashboard
│   ├── carros.js          → CRUD de carros
│   ├── carro-detalhes.js  → Detalhes + despesas do carro
│   ├── despesas.js        → Despesas gerais
│   └── relatorios.js      → Relatórios
└── sql/
    └── schema.sql         → Schema do banco de dados
```

---

## ⚙️ Configuração Inicial

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. No **SQL Editor**, execute o conteúdo de `sql/schema.sql`.
3. Copie a **URL** e a **Anon Key** do seu projeto  
   *(Settings → API → Project URL / anon public key)*.

### 2. Configurar credenciais

Edite o arquivo `js/supabase-config.js`:

```js
const SUPABASE_URL      = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_PUBLICA';
```

### 3. Deploy no Cloudflare Pages

1. Suba os arquivos para um repositório GitHub.
2. No painel do Cloudflare Pages, conecte o repositório.
3. **Build command:** *(deixe em branco — site estático)*
4. **Output directory:** `/` *(raiz do repositório)*
5. Publique — pronto!

---

## 💡 Funcionalidades

| Módulo | Funcionalidades |
|---|---|
| **Dashboard** | Cards de faturamento, investido, despesas, lucros e vendidos. Gráficos dos últimos 6 meses. Filtro por mês/ano. |
| **Carros** | CRUD completo. Busca por modelo/placa. Filtro por status. Ordenação. Mudar status. |
| **Detalhes** | Todas as informações do carro. CRUD de despesas do carro. Cálculo de lucro em tempo real. |
| **Despesas** | CRUD de despesas gerais. Busca. Ordenação por data. |
| **Relatórios** | Resumo mensal com gráfico anual. Tabelas de carros vendidos e despesas. |

---

## 📐 Regras de Negócio

- **Lucro** só é calculado para carros com status `vendido` ou `repasse`
- **Lucro por carro** = `valor_venda − valor_compra − despesas_do_carro`
- **Lucro bruto** = soma dos lucros dos carros vendidos/repasse
- **Lucro líquido** = `lucro bruto − despesas gerais`
- **Total investido** = soma de `valor_compra` de carros ainda não vendidos
- **Faturamento mensal** = soma de `valor_venda` dos carros vendidos no mês

---

## 🎨 Visual

- Sidebar escura com toggle claro/escuro
- Tema persistido via `localStorage`
- Cards com sombras leves e bordas suaves
- Tabelas simples e responsivas
- Toasts de confirmação/erro
- Modal de confirmação antes de qualquer exclusão
