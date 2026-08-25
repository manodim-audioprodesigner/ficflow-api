// FIC FLOW - PAINEL DA DIRECAO GERAL
window.App = window.App || {};

App.direcaoPage = {
  render: async function (host) {
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">🏢 Painel da Direção Geral</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
            Gestão executiva de setores, cadastro direto de gestores, funcionários e acompanhamento consolidado
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn-ghost" id="dir-btn-trocar-senha" style="border:1px solid var(--line)">🔑 Trocar Senha</button>
          <button class="btn" id="dir-btn-novo-cargo" style="border-color:var(--pri)">+ Novo Setor / Cargo</button>
          <button class="btn" id="dir-btn-novo-func">+ Cadastrar Funcionário</button>
          <button class="btn" id="dir-btn-novo-gestor">+ Cadastrar Gestor</button>
          <button class="btn-primary" id="dir-btn-novo-dir">+ Cadastrar Diretor</button>
        </div>
      </div>

      <!-- KPIS DA DIRETORIA -->
      <div class="grid" id="dir-kpis" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
        <div class="card kpi"><b id="dk-ativos">...</b><span class="muted">Programas Ativos</span></div>
        <div class="card kpi"><b id="dk-concluidos" style="color:var(--green)">...</b><span class="muted">Concluídos</span></div>
        <div class="card kpi"><b id="dk-gestores" style="color:var(--pri-2)">...</b><span class="muted">Total de Gestores</span></div>
        <div class="card kpi"><b id="dk-funcs" style="color:var(--txt)">...</b><span class="muted">Total de Funcionários</span></div>
        <div class="card kpi"><b id="dk-sem-resp" style="color:var(--orange)">...</b><span class="muted">Tarefas Sem Responsável</span></div>
      </div>

      <!-- GESTORES CADASTRADOS -->
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:15px">👑 Gestores de Equipe Cadastrados</b>
            <div class="muted" style="font-size:12px">Lideranças responsáveis pelo monitoramento e remanejamento das equipes</div>
          </div>
          <button class="btn-primary" id="dir-btn-add-gestor-sec" style="font-size:12px">+ Cadastrar Novo Gestor</button>
        </div>
        <div id="dir-gestores-table">
          <div class="empty">Carregando gestores...</div>
        </div>
      </div>

      <!-- FUNCIONÁRIOS CADASTRADOS -->
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:15px">👥 Funcionários da Produção Cadastrados</b>
            <div class="muted" style="font-size:12px">Membros que executam as etapas do pipeline de dublagem e pós-produção</div>
          </div>
          <button class="btn-primary" id="dir-btn-add-func-sec" style="font-size:12px">+ Cadastrar Novo Funcionário</button>
        </div>
        <div id="dir-funcs-table">
          <div class="empty">Carregando funcionários...</div>
        </div>
      </div>

      <!-- QUADRO CONSOLIDADO DE SETORES & EQUIPES -->
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:15px">🏢 Visão por Setores e Especialidades</b>
            <div class="muted" style="font-size:12px">Distribuição de funcionários, cargas e gestores por setor</div>
          </div>
          <button class="btn" id="dir-btn-add-cargo-sec" style="font-size:12px">+ Novo Setor / Cargo</button>
        </div>
        <div id="dir-setores-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px">
          <div class="empty">Carregando setores...</div>
        </div>
      </div>
    `;

    // Handlers
    document.getElementById('dir-btn-trocar-senha').onclick = () => App.ui.modalTrocarSenha();
    document.getElementById('dir-btn-novo-cargo').onclick = () => App.utils.modalNovoCargo(() => App.direcaoPage.load());
    document.getElementById('dir-btn-add-cargo-sec').onclick = () => App.utils.modalNovoCargo(() => App.direcaoPage.load());
    
    document.getElementById('dir-btn-novo-gestor').onclick = () => App.gestoresPage.modalForm(null, false, () => App.direcaoPage.load());
    document.getElementById('dir-btn-add-gestor-sec').onclick = () => App.gestoresPage.modalForm(null, false, () => App.direcaoPage.load());
    document.getElementById('dir-btn-novo-dir').onclick = () => App.gestoresPage.modalForm(null, true, () => App.direcaoPage.load());

    document.getElementById('dir-btn-novo-func').onclick = async () => {
      const cargos = await App.cargos.list();
      App.usuariosPage.form(cargos, null, () => App.direcaoPage.load());
    };
    document.getElementById('dir-btn-add-func-sec').onclick = async () => {
      const cargos = await App.cargos.list();
      App.usuariosPage.form(cargos, null, () => App.direcaoPage.load());
    };

    App.direcaoPage.load();
  },

  load: async function () {
    try {
      const [data, users] = await Promise.all([
        App.stats.directorOverview(),
        App.users.list()
      ]);
      
      const gestores = users.filter(u => u.level === 'manager');
      const funcionarios = users.filter(u => u.level === 'employee');

      const dk1 = document.getElementById('dk-ativos');
      const dk2 = document.getElementById('dk-concluidos');
      const dk3 = document.getElementById('dk-gestores');
      const dk4 = document.getElementById('dk-funcs');
      const dk5 = document.getElementById('dk-sem-resp');

      if (dk1) dk1.textContent = data.ativosProg || 0;
      if (dk2) dk2.textContent = data.concluidosProg || 0;
      if (dk3) dk3.textContent = gestores.length;
      if (dk4) dk4.textContent = funcionarios.length;
      if (dk5) dk5.textContent = data.tarefasSemResp || 0;

      // Render Gestores Table
      const gestoresHost = document.getElementById('dir-gestores-table');
      if (gestoresHost) {
        if (!gestores.length) {
          gestoresHost.innerHTML = '<div class="empty" style="padding:24px 10px">Nenhum gestor cadastrado ainda. Clique em "+ Cadastrar Novo Gestor" acima.</div>';
        } else {
          gestoresHost.innerHTML = `
            <div class="table">
              <table>
                <thead>
                  <tr>
                    <th>Gestor</th>
                    <th>Login</th>
                    <th>Idioma</th>
                    <th>Identificação</th>
                    <th>Equipes sob Gestão</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${gestores.map(g => {
                    const avatar = App.utils.userAvatar(g.nome, g.genero);
                    const teamsStr = g.teams && g.teams.length ? g.teams.map(t => `<span class="status-pill pill-purple" style="margin:2px;font-size:10px">${App.utils.escape(t)}</span>`).join(' ') : '<span style="color:var(--muted)">Nenhuma equipe atribuída</span>';
                    const genBadge = g.genero === 'F' ? '<span class="user-badge user-badge-fem" style="font-size:10px">♀ Feminino (Rosa)</span>' : '<span class="user-badge user-badge-masc" style="font-size:10px">♂ Masculino (Azul)</span>';

                    return `
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px">
                            ${avatar}
                            <div><b>${App.utils.escape(g.nome)}</b> <span class="muted" style="font-size:11px">(${App.utils.escape(g.short || 'GEST')})</span></div>
                          </div>
                        </td>
                        <td><code>${App.utils.escape(g.usuario)}</code></td>
                        <td><span class="status-pill pill-gray" style="font-size:10px">${App.utils.escape(g.idioma || '—')}</span></td>
                        <td>${genBadge}</td>
                        <td><div style="display:flex;flex-wrap:wrap;gap:2px">${teamsStr}</div></td>
                        <td>${g.ativo ? '<span class="pill-green status-pill">Ativo</span>' : '<span class="pill-red status-pill">Inativo</span>'}</td>
                        <td>
                          <div style="display:flex;gap:4px;flex-wrap:wrap">
                            <button class="btn-ghost" data-edit-gestor="${g.id}">✏ Editar</button>
                            <button class="btn-ghost" data-senha-gestor="${g.id}">🔑 Senha</button>
                            <button class="btn-danger" data-del-gestor="${g.id}">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;

          gestoresHost.querySelectorAll('[data-edit-gestor]').forEach(b => {
            b.onclick = () => {
              const u = users.find(x => x.id === +b.dataset.editGestor);
              if (u) App.gestoresPage.modalForm(u);
            };
          });

          gestoresHost.querySelectorAll('[data-senha-gestor]').forEach(b => {
            b.onclick = () => {
              const u = users.find(x => x.id === +b.dataset.senhaGestor);
              if (u) App.gestoresPage.modalSenha(u);
            };
          });

          gestoresHost.querySelectorAll('[data-del-gestor]').forEach(b => {
            b.onclick = async () => {
              const u = users.find(x => x.id === +b.dataset.delGestor);
              if (!u) return;
              if (!confirm(`Tem certeza que deseja excluir o gestor "${u.nome}" permanentemente?`)) return;
              const r = await App.users.delete(u.id, App.user.id);
              if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir.', 'err');
              App.utils.toast('Gestor excluído com sucesso.');
              App.direcaoPage.load();
            };
          });
        }
      }

      // Render Funcionários Table
      const funcsHost = document.getElementById('dir-funcs-table');
      if (funcsHost) {
        if (!funcionarios.length) {
          funcsHost.innerHTML = '<div class="empty" style="padding:24px 10px">Nenhum funcionário cadastrado ainda. Clique em "+ Cadastrar Novo Funcionário" acima.</div>';
        } else {
          funcsHost.innerHTML = `
            <div class="table">
              <table>
                <thead>
                  <tr>
                    <th>Funcionário</th>
                    <th>Login</th>
                    <th>Identificação</th>
                    <th>Setor (Cargo)</th>
                    <th>Tarefas Abertas</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${funcionarios.map(f => {
                    const avatar = App.utils.userAvatar(f.nome, f.genero);
                    const genBadge = f.genero === 'F' ? '<span class="user-badge user-badge-fem" style="font-size:10px">♀ Feminino (Rosa)</span>' : '<span class="user-badge user-badge-masc" style="font-size:10px">♂ Masculino (Azul)</span>';

                    return `
                      <tr>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px">
                            ${avatar}
                            <div><b>${App.utils.escape(f.nome)}</b> <span class="muted" style="font-size:11px">(${App.utils.escape(f.short || 'FUNC')})</span></div>
                          </div>
                        </td>
                        <td><code>${App.utils.escape(f.usuario)}</code></td>
                        <td>${genBadge}</td>
                        <td>${App.utils.cargoBadge(f.cargo, f.cargo_cor)}</td>
                        <td><b style="color:${f.tarefas_abertas > 3 ? 'var(--orange)' : 'var(--txt)'}">${f.tarefas_abertas || 0}</b></td>
                        <td>${f.ativo ? '<span class="pill-green status-pill">Ativo</span>' : '<span class="pill-red status-pill">Inativo</span>'}</td>
                        <td>
                          <div style="display:flex;gap:4px">
                            <button class="btn-ghost" data-edit-func="${f.id}">Editar</button>
                            <button class="btn-danger" data-del-func="${f.id}">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;

          funcsHost.querySelectorAll('[data-edit-func]').forEach(b => {
            b.onclick = async () => {
              const cargos = await App.cargos.list();
              const u = users.find(x => x.id === +b.dataset.editFunc);
              App.usuariosPage.form(cargos, u, () => App.direcaoPage.load());
            };
          });

          funcsHost.querySelectorAll('[data-del-func]').forEach(b => {
            b.onclick = async () => {
              await App.usuariosPage.excluir(+b.dataset.delFunc);
              App.direcaoPage.load();
            };
          });
        }
      }

      // Render Setores Grid
      const setoresHost = document.getElementById('dir-setores-grid');
      if (setoresHost) {
        const setores = data.setores || [];
        if (!setores.length) {
          setoresHost.innerHTML = '<div class="empty">Nenhum setor cadastrado.</div>';
          return;
        }

        setoresHost.innerHTML = setores.map(s => {
          const managersStr = s.gestores && s.gestores.length ? s.gestores.join(', ') : '<span style="color:var(--muted)">Sem gestor direto</span>';
          
          return `
            <div class="card" style="background:var(--panel-2);border-left:4px solid ${s.cor || 'var(--pri)'}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <b style="font-size:14px;color:var(--txt)">${App.utils.escape(s.setor)}</b>
                <span class="status-pill pill-gray" style="font-size:10px">${s.funcionarios} membros</span>
              </div>
              <div style="font-size:12px;color:var(--txt-2);margin-top:6px">
                <b>Gestão:</b> ${managersStr}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.05);font-size:12px">
                <span class="muted">Tarefas Abertas:</span>
                <b style="color:${s.tarefasAbertas > 5 ? 'var(--orange)' : 'var(--green)'};font-size:14px">${s.tarefasAbertas}</b>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('[direcaoPage] load erro:', e);
    }
  }
};
