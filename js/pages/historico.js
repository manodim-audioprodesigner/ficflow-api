// FIC FLOW - HISTORICO & AUDITORIA (por Gestor e por Funcionario)
window.App = window.App || {};

App.historicoPage = {
  _filtroUsuario: '',
  _filtroNivel: 'todos',

  render: async function (host) {
    let users = [];
    try { users = await App.users.list(); } catch (e) {}
    const gestores    = users.filter(u => u.level === 'manager');
    const funcionarios = users.filter(u => u.level === 'employee');

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin:0">◷ Histórico de Atividades da Equipe</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
            O que cada Gestor e cada Funcionário fez — criações, mudanças de status, conclusões e mais
          </div>
        </div>
        <button class="btn-ghost" id="hist-btn-refresh">↻ Atualizar Log</button>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <b>Filtrar por:</b>
          <select id="hist-filtro-nivel" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
            <option value="todos">Todos os membros</option>
            <option value="manager">Apenas Gestores</option>
            <option value="employee">Apenas Funcionários</option>
          </select>
          <select id="hist-filtro-usuario" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line);min-width:180px">
            <option value="">Todos os usuários</option>
            <optgroup label="👑 Gestores">
              ${gestores.map(u => `<option value="${u.id}">${App.utils.escape(u.nome)}</option>`).join('')}
            </optgroup>
            <optgroup label="👤 Funcionários">
              ${funcionarios.map(u => `<option value="${u.id}">${App.utils.escape(u.nome)}</option>`).join('')}
            </optgroup>
          </select>
          <input type="text" id="hist-busca" placeholder="Buscar por ação, programa..." style="min-width:200px;padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
        </div>
      </div>

      <div class="card">
        <div id="hist-events-container">
          <div class="empty">Carregando histórico...</div>
        </div>
      </div>
    `;

    document.getElementById('hist-btn-refresh').onclick = App.historicoPage.load;
    document.getElementById('hist-filtro-nivel').onchange = function() {
      App.historicoPage._filtroNivel = this.value;
      App.historicoPage.load();
    };
    document.getElementById('hist-filtro-usuario').onchange = function() {
      App.historicoPage._filtroUsuario = this.value;
      App.historicoPage.load();
    };
    let st;
    document.getElementById('hist-busca').oninput = function() {
      clearTimeout(st);
      st = setTimeout(App.historicoPage.load, 250);
    };

    App.historicoPage.load();
  },

  load: async function () {
    const host = document.getElementById('hist-events-container');
    if (!host) return;
    host.innerHTML = '<div class="empty">Carregando...</div>';

    const busca = document.getElementById('hist-busca')?.value?.toLowerCase() || '';
    const filtroUsuario = App.historicoPage._filtroUsuario;
    const filtroNivel   = App.historicoPage._filtroNivel;

    let events = [];
    try {
      events = await App.atividades.list({ limite: 400 });
    } catch(e) {
      host.innerHTML = '<div class="empty" style="color:var(--red)">Erro ao carregar histórico.</div>';
      return;
    }

    if (!events || !events.length) {
      host.innerHTML = '<div class="empty" style="padding:40px 10px">Nenhum evento registrado no histórico.</div>';
      return;
    }

    // Filtros
    let filtered = events;
    if (filtroUsuario) {
      filtered = filtered.filter(e => String(e.usuario_id) === String(filtroUsuario));
    }
    if (filtroNivel !== 'todos') {
      filtered = filtered.filter(e => e.usuario_level === filtroNivel || e.nivel === filtroNivel);
    }
    if (busca) {
      filtered = filtered.filter(e =>
        (e.usuario_nome || '').toLowerCase().includes(busca) ||
        (e.acao || '').toLowerCase().includes(busca) ||
        (e.detalhes || '').toLowerCase().includes(busca) ||
        (e.entidade || '').toLowerCase().includes(busca)
      );
    }

    if (!filtered.length) {
      host.innerHTML = '<div class="empty" style="padding:30px">Nenhum evento encontrado com os filtros aplicados.</div>';
      return;
    }

    // Agrupa por usuário para mostrar quem fez o que
    const byUser = {};
    for (const e of filtered) {
      const key = e.usuario_id || 'sistema';
      if (!byUser[key]) byUser[key] = { nome: e.usuario_nome || 'Sistema', nivel: e.usuario_level || 'employee', events: [] };
      byUser[key].events.push(e);
    }

    host.innerHTML = Object.entries(byUser).map(([uid, data]) => {
      const levelIcon = data.nivel === 'director' ? '👑' : (data.nivel === 'manager' ? '👥' : '👤');
      const levelLabel = data.nivel === 'director' ? 'Direção Geral' : (data.nivel === 'manager' ? 'Gestor' : 'Funcionário');
      const count = data.events.length;

      return `
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid var(--line)">
            ${App.utils.userAvatar(data.nome, data.genero || 'M')}
            <div>
              <b style="font-size:15px">${App.utils.escape(data.nome)}</b>
              <span style="font-size:11px;color:var(--muted);margin-left:6px">${levelIcon} ${levelLabel}</span>
            </div>
            <span class="status-pill pill-purple" style="margin-left:auto">${count} ação${count !== 1 ? 'ões' : ''}</span>
          </div>
          ${data.events.map(e => {
            const time = e.criado_em
              ? new Date(e.criado_em.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
              : '-';
            const actionBadge = e.acao && e.acao.includes('CONCLUIR') ? 'pill-green'
              : e.acao && e.acao.includes('EXCLUIR') ? 'pill-red'
              : e.acao && e.acao.includes('CRIAR')   ? 'pill-orange'
              : 'pill-purple';

            return `
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 12px;background:var(--panel-2);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--line)">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="status-pill ${actionBadge}" style="font-size:10px">${App.utils.escape(e.acao || '—')}</span>
                  <span style="font-size:13px">${App.utils.escape(e.detalhes || e.entidade || '—')}</span>
                </div>
                <span style="font-size:11px;color:var(--muted);white-space:nowrap">${time}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');
  }
};
