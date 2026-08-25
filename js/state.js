// Modo Nuvem Render é o padrão, a menos que o usuário tenha configurado explicitamente 'local'
const isLocalMode = localStorage.getItem('fic_mode') === 'local';
const activeApi = (isLocalMode && window.ficflow) ? window.ficflow : (window.ficflowCloud || window.ficflow);

window.App = Object.assign({}, activeApi, {
  user: null,
  chatApi: (activeApi && (activeApi.chatApi || activeApi.chat)) ? (activeApi.chatApi || activeApi.chat) : null,
  state: { page: 'dashboard', filtros: { cargo: 'all', categoria: '', etapa: '', status: '', busca: '' }, cache: { etapas:[], categorias:[], cargos:[], usuarios:[] } },
  utils: {},
  theme: {
    current: localStorage.getItem('fic_theme') || 'dark',
    colorKey: localStorage.getItem('fic_colorkey') || 'purple',
    
    init: function () {
      App.theme.setTheme(App.theme.current);
      App.theme.setColorKey(App.theme.colorKey);
    },
    
    setTheme: function (t) {
      App.theme.current = t;
      document.documentElement.dataset.theme = t;
      localStorage.setItem('fic_theme', t);
      const icon = document.getElementById('theme-toggle-icon');
      if (icon) icon.textContent = t === 'light' ? '☀️' : '🌙';
    },

    toggleTheme: function () {
      const next = App.theme.current === 'dark' ? 'light' : 'dark';
      App.theme.setTheme(next);
      App.utils.toast(`Modo ${next === 'light' ? 'Claro' : 'Escuro'} ativado`);
    },

    setColorKey: function (c) {
      App.theme.colorKey = c;
      document.documentElement.dataset.colorKey = c;
      localStorage.setItem('fic_colorkey', c);
      document.querySelectorAll('.swatch-item').forEach(el => {
        el.classList.toggle('active', el.dataset.color === c);
      });
    }
  }
});

// Lista Oficial de Setores / Cargos
App.ROLES = [
  'Direção Geral',
  'Gestores',
  'Editor de Video',
  'Operador de Audio',
  'Gravação',
  'Sincronismo do Áudio',
  'UP Video Heygen',
  'Correção do SRT Português',
  'Correção do SRT Espanhol',
  'Correção do SRT Inglês',
  'Correção do SRT Arabe',
  'Correção do SRT Urdu',
  'Correção do SRT Indonésio',
  'Correção do SRT Russo',
  'Correção do SRT Frances',
  'Mixagem',
  'Tradutor',
  'Correção',
  'Correção Final'
];

const STATUS = { 0:'Travado', 1:'Fazendo', 2:'Pronto' };
const STATUS_CLASS = { 0:'red', 1:'orange', 2:'green' };
const STATUS_COLOR = { 0:'#ff4757', 1:'#ff9f43', 2:'#2ed573' };

App.utils.toast = function (msg, tipo) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (tipo || 'ok');
  clearTimeout(App._tt);
  App._tt = setTimeout(() => { t.className = 'toast'; }, 2600);
};

App.utils.escape = function (s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c])); };

App.utils.modal = function (html, onMount) {
  const overlay = document.getElementById('modal-overlay');
  const host = document.getElementById('modal-host');
  host.innerHTML = html;
  overlay.classList.add('active');
  host.querySelectorAll('[data-close]').forEach(b => b.onclick = App.utils.closeModal);
  if (onMount) onMount(host);
};

App.utils.closeModal = function () {
  const overlay = document.getElementById('modal-overlay');
  const host = document.getElementById('modal-host');
  if (overlay) overlay.classList.remove('active');
  if (host) host.innerHTML = '';
};

App.utils.statusPill = function (s) {
  const cls = STATUS_CLASS[s] || '';
  return '<span class="status-pill pill-' + cls + '">' + (STATUS[s] || 'Desconhecido') + '</span>';
};

App.utils.cargoBadge = function (nome, cor) {
  return '<span class="u-cargo" style="background:' + (cor || '#444') + '22;color:' + (cor || '#fff') + ';border:1px solid ' + (cor || '#444') + '44">' + App.utils.escape(nome) + '</span>';
};

/* User Badge com Destaque de Gênero: Mulher = Rosa Claro, Homem = Azul Claro */
App.utils.userBadge = function (nome, genero, extraText) {
  const gen = genero === 'F' ? 'F' : (genero === 'O' ? 'O' : 'M');
  const cls = gen === 'F' ? 'user-badge-fem' : (gen === 'O' ? 'user-badge-other' : 'user-badge-masc');
  const icon = gen === 'F' ? '♀' : (gen === 'O' ? '★' : '♂');
  return `<span class="user-badge ${cls}"><span class="gender-icon">${icon}</span> ${App.utils.escape(nome || '-')}${extraText ? ' ' + extraText : ''}</span>`;
};

App.utils.userAvatar = function (nome, genero) {
  const gen = genero === 'F' ? 'F' : (genero === 'O' ? 'O' : 'M');
  const cls = gen === 'F' ? 'avatar-fem' : (gen === 'O' ? 'avatar-other' : 'avatar-masc');
  const initials = String(nome || 'U').trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  return `<div class="avatar-circle ${cls}" title="${App.utils.escape(nome)}">${initials}</div>`;
};

// Permissões
App.utils.isDirector = () => App.user && (App.user.level === 'director' || App.user.cargo === 'Direção Geral' || App.user.cargo_id === 1);
App.utils.isManager = () => App.user && (App.user.level === 'manager' || App.user.cargo === 'Gestores');
App.utils.canManage = () => App.utils.isDirector() || App.utils.isManager();
App.utils.canAdmin = () => App.utils.isDirector();
App.utils.canEdit = () => App.user != null;

// Cálculo de SLA
App.utils.slaInfo = function (t) {
  if (!t.criado_em) return { state: 'ok', texto: 'Sem prazo', remainingMs: 9999999 };
  const slaMin = t.sla_minutos || 90;
  const slaMs = slaMin * 60000;
  const createdTime = new Date(t.criado_em.replace(' ', 'T')).getTime();
  const deadline = createdTime + slaMs;
  const rem = deadline - Date.now();
  const late = rem < 0;
  const abs = Math.abs(rem);
  const mins = Math.floor(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const txt = (h ? `${h}h ` : '') + `${m}min`;

  let state = 'ok';
  if (late) state = 'late';
  else if (rem <= slaMs * 0.25) state = 'warn';

  return {
    state,
    texto: late ? `Atrasado há ${txt}` : `Restam ${txt}`,
    remainingMs: rem,
    slaMin
  };
};

// Modal de Criação Dinâmica de Cargo/Setor
App.utils.modalNovoCargo = function (onSuccess) {
  App.utils.modal(
    '<h3>+ Cadastrar Novo Setor / Cargo</h3>' +
    '<div class="field"><span>Nome do Setor / Cargo</span><input id="nc-nome" placeholder="Ex: Efeitos Visuais (VFX)"></div>' +
    '<div class="field"><span>Cor de Identificação</span><input type="color" id="nc-cor" value="#7c5cff" style="height:40px;cursor:pointer;padding:2px"></div>' +
    '<div class="actions"><button data-close class="btn-ghost">Cancelar</button><button class="btn-primary" id="nc-save">Salvar Setor</button></div>',
    (host) => {
      host.querySelector('#nc-save').onclick = async () => {
        const nome = host.querySelector('#nc-nome').value.trim();
        const cor = host.querySelector('#nc-cor').value;
        if (!nome) return App.utils.toast('Informe o nome do setor/cargo', 'err');
        const res = await App.cargos.create({ nome, cor, criado_por: App.user.id });
        if (!res.ok) return App.utils.toast(res.msg, 'err');
        App.utils.toast('Setor cadastrado com sucesso!');
        App.utils.closeModal();
        if (onSuccess) onSuccess();
      };
    }
  );
};
