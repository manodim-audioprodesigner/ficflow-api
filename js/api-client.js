// FIC FLOW - Cliente da API Remota na Nuvem (Render.com)
window.FIC_API_URL = localStorage.getItem('fic_api_url') || 'https://ficflow-api.onrender.com';
const API_URL = window.FIC_API_URL;
let authToken = localStorage.getItem('fic_token') || null;

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

  try {
    const res = await fetch(API_URL + path, {
      ...options,
      headers
    });

    if (res.status === 401 && !path.includes('/auth/login')) {
      localStorage.removeItem('fic_token');
      location.reload();
      return { ok: false, msg: 'Sessão expirada.' };
    }

    const data = await res.json().catch(() => ({ ok: false, msg: 'Resposta inválida do servidor.' }));
    return data;
  } catch (err) {
    console.error('[API Cloud Error]:', err);
    return { ok: false, msg: 'Erro de conexão com o servidor na nuvem: ' + err.message };
  }
}

function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('fic_token', token);
  else localStorage.removeItem('fic_token');
}

// Objeto de compatibilidade Nuvem
window.ficflowCloud = {
  auth: {
    login: async (usuario, pin) => {
      const r = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario, pin })
      });
      if (r.ok && r.token) setToken(r.token);
      return r;
    },
    me: () => api('/api/auth/me'),
    heartbeat: (usuario_id) => api('/api/auth/heartbeat', { method: 'POST', body: JSON.stringify({ usuario_id }) }).catch(() => ({ ok: true }))
  },
  chat: {
    send: (usuario_id, texto, tarefa_id, destinatario_id) => api('/api/chat', { method: 'POST', body: JSON.stringify({ usuario_id, texto, tarefa_id, destinatario_id }) }),
    list: (limit, after_id, usuario_id, destinatario_id) => api(`/api/chat?limite=${limit || 50}&desde_id=${after_id || 0}&usuario_id=${usuario_id || 0}&destinatario_id=${destinatario_id || 0}`).then(r => r.data || []),
    online: (usuario_id) => api(`/api/chat/online?usuario_id=${usuario_id || 0}`).then(r => r.data || []),
    contacts: (usuario_id) => api(`/api/chat/contacts?usuario_id=${usuario_id || 0}`).then(r => r.data || [])
  },
  chatApi: {
    send: (usuario_id, texto, tarefa_id, destinatario_id) => api('/api/chat', { method: 'POST', body: JSON.stringify({ usuario_id, texto, tarefa_id, destinatario_id }) }),
    list: (limit, after_id, usuario_id, destinatario_id) => api(`/api/chat?limite=${limit || 50}&desde_id=${after_id || 0}&usuario_id=${usuario_id || 0}&destinatario_id=${destinatario_id || 0}`).then(r => r.data || []),
    online: (usuario_id) => api(`/api/chat/online?usuario_id=${usuario_id || 0}`).then(r => r.data || []),
    contacts: (usuario_id) => api(`/api/chat/contacts?usuario_id=${usuario_id || 0}`).then(r => r.data || [])
  },
  programs: {
    list: (f = {}) => {
      const q = new URLSearchParams();
      if (f.busca) q.set('busca', f.busca);
      if (f.status) q.set('status', f.status);
      return api('/api/programs?' + q.toString()).then(r => r.data || []);
    },
    create: (p) => api('/api/programs', { method: 'POST', body: JSON.stringify(p) }),
    update: (idOrObj, maybeObj) => {
      const id = (typeof idOrObj === 'object' && idOrObj !== null) ? idOrObj.id : idOrObj;
      const p = (typeof idOrObj === 'object' && idOrObj !== null) ? idOrObj : (maybeObj || {});
      return api('/api/programs/' + id, { method: 'PUT', body: JSON.stringify(p) });
    },
    delete: (id) => api('/api/programs/' + id, { method: 'DELETE' })
  },
  users: {
    list: () => api('/api/users').then(r => r.data || []),
    create: (p) => api('/api/users', { method: 'POST', body: JSON.stringify(p) }),
    update: (p) => api('/api/users/' + p.id, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (id) => api('/api/users/' + id, { method: 'DELETE' })
  },
  cargos: {
    list: () => api('/api/cargos').then(r => r.data || []),
    create: (p) => api('/api/cargos', { method: 'POST', body: JSON.stringify(p) })
  },
  categorias: {
    list: () => api('/api/categorias').then(r => r.data || []),
    create: (p) => api('/api/categorias', { method: 'POST', body: JSON.stringify(p) }),
    update: (p) => api('/api/categorias/' + p.id, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (id) => api('/api/categorias/' + id, { method: 'DELETE' })
  },
  etapas: {
    list: () => api('/api/etapas').then(r => r.data || []),
    create: (p) => api('/api/etapas', { method: 'POST', body: JSON.stringify(p) }),
    update: (p) => api('/api/etapas/' + p.id, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (id) => api('/api/etapas/' + id, { method: 'DELETE' })
  },
  tarefas: {
    list: (f = {}) => {
      const q = new URLSearchParams();
      if (f.etapa_id) q.set('etapa_id', f.etapa_id);
      if (f.categoria_id) q.set('categoria_id', f.categoria_id);
      if (f.status !== undefined && f.status !== '') q.set('status', f.status);
      if (f.busca) q.set('busca', f.busca);
      return api('/api/tarefas?' + q.toString()).then(r => r.data || []);
    },
    minhas: (usuario_id) => api('/api/tarefas/minhas?usuario_id=' + (usuario_id || '')).then(r => r.data || []),
    get: (id) => api('/api/tarefas/' + id).then(r => r.data),
    create: (p) => api('/api/tarefas', { method: 'POST', body: JSON.stringify(p) }),
    update: (p) => api('/api/tarefas/' + p.id, { method: 'PUT', body: JSON.stringify(p) }),
    setStatus: (id, status, usuario_id, observacao) =>
      api(`/api/tarefas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, observacao, usuario_id }) }),
    avancarEtapa: (id, usuario_id, observacao) =>
      api(`/api/tarefas/${id}/avancar`, { method: 'POST', body: JSON.stringify({ observacao, usuario_id }) }),
    seen: (id, usuario_id) => api(`/api/tarefas/${id}/seen`, { method: 'POST', body: JSON.stringify({ usuario_id }) }),
    complete: (id, usuario_id) => api(`/api/tarefas/${id}/complete`, { method: 'POST', body: JSON.stringify({ usuario_id }) }),
    remanejar: (id, usuario_id, forcar) => api(`/api/tarefas/${id}/remanejar`, { method: 'POST', body: JSON.stringify({ usuario_id, forcar }) }),
    distribuir: () => api('/api/tarefas/distribuir', { method: 'POST' }),
    rebalanceOpen: (usuario_id, teams) => api('/api/tarefas/rebalance', { method: 'POST', body: JSON.stringify({ usuario_id, teams }) }),
    historico: (id) => api(`/api/tarefas/${id}/historico`).then(r => r.data || []),
    archive: (id) => api(`/api/tarefas/${id}/archive`, { method: 'PATCH' }),
    delete: (id) => api('/api/tarefas/' + id, { method: 'DELETE' })
  },
  stats: {
    dashboard: (cargo) => api('/api/stats/dashboard?cargo=' + encodeURIComponent(cargo || '')).then(r => r.data),
    timeline: (cargo, periodo) => api(`/api/stats/timeline?cargo=${encodeURIComponent(cargo || '')}&periodo=${periodo}`).then(r => r.data),
    porSetor: (cargo) => api('/api/stats/por-setor?cargo=' + encodeURIComponent(cargo || '')).then(r => r.data || []),
    atividade: (cargo, limite) => api(`/api/stats/atividade?cargo=${encodeURIComponent(cargo || '')}&limite=${limite || 20}`).then(r => r.data || []),
    produtividade: (cargo, inicio, fim) => api(`/api/stats/produtividade?inicio=${inicio || ''}&fim=${fim || ''}`).then(r => r.data),
    directorOverview: () => api('/api/stats/director-overview').then(r => r.data || {}),
    teamLoad: (usuario_id) => api('/api/stats/team-load').then(r => r.data || {})
  },
  atividades: {
    list: (f) => api('/api/atividades').then(r => r.data || [])
  },
  licenca: {
    status: () => Promise.resolve({ ok: true, expirada: false, plano: 'nuvem-ilimitado', expira: 'Ilimitado' })
  }
};