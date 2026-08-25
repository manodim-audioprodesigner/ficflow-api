// FIC FLOW - GESTAO DE FUNCIONARIOS & MONTAGEM DA MINHA EQUIPE
window.App = window.App || {};

App.usuariosPage = {
  _filtroEquipe: 'todos', // 'todos' | 'minha_equipe'

  render: async function (host) {
    const isDirector = App.utils.isDirector();
    const isManager  = App.utils.isManager();
    const [lista, cargos] = await Promise.all([App.users.list(), App.cargos.list()]);
    App.state.cache.usuarios = lista;
    App.state.cache.cargos = cargos;

    // Obtém lista de membros da equipe do gestor
    let teamsManaged = Array.isArray(App.user?.teams) ? App.user.teams : [];

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">👥 Funcionários da Produção</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
            Cadastre novos funcionários, edite dados e <b>monte sua equipe</b> selecionando os membros abaixo
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${isManager ? `
            <button class="btn-primary" id="u-btn-montar-equipe" style="background:linear-gradient(135deg, #f59e0b, #d97706);border:none;font-weight:700">
              ⭐ Montar Minha Equipe
            </button>
            <button class="btn" id="u-btn-goto-equipe" style="border-color:var(--orange)">
              👥 Ver Carga da Equipe →
            </button>
          ` : ''}
          <button class="btn" id="u-btn-novo-cargo" style="border-color:var(--pri)">+ Novo Setor / Cargo</button>
          ${isDirector ? '<button class="btn" id="u-btn-dir">+ Cadastrar Direção Geral</button>' : ''}
          ${isDirector ? '<button class="btn" id="u-btn-gestor">+ Cadastrar Gestor</button>' : ''}
          <button class="btn-primary" id="u-new" style="font-weight:700">+ Cadastrar Funcionário</button>
        </div>
      </div>

      <div class="card">
        <!-- FILTROS DE EQUIPE -->
        <div class="toolbar" style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
          <b>Filtrar:</b>
          ${isManager ? `
            <select id="u-filtro-minha-equipe" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line);font-weight:600">
              <option value="todos" ${App.usuariosPage._filtroEquipe === 'todos' ? 'selected' : ''}>Todos os Funcionários</option>
              <option value="minha_equipe" ${App.usuariosPage._filtroEquipe === 'minha_equipe' ? 'selected' : ''}>⭐ Apenas Minha Equipe</option>
            </select>
          ` : ''}
          ${isDirector ? `
            <select id="u-filtro-tipo" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
              <option value="todos">Todos os membros</option>
              <option value="manager">Apenas Gestores</option>
              <option value="employee" selected>Apenas Funcionários</option>
            </select>
          ` : ''}
          <select id="u-filtro-cargo" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
            <option value="todos">Todos os setores</option>
            ${cargos.filter(c => c.nome !== 'Direção Geral' && c.nome !== 'Gestores').map(c => `<option value="${c.id}">${App.utils.escape(c.nome)}</option>`).join('')}
          </select>
          <input type="text" id="u-busca-nome" placeholder="Buscar por nome ou login..." style="min-width:220px;padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)" />
        </div>

        <div id="u-tabela-host"></div>
      </div>
    `;

    document.getElementById('u-new').onclick = () => App.usuariosPage.form(cargos, null, () => App.usuariosPage.render(host));
    document.getElementById('u-btn-novo-cargo').onclick = () => App.utils.modalNovoCargo(() => App.usuariosPage.render(host));

    const btnMontar = document.getElementById('u-btn-montar-equipe');
    if (btnMontar) {
      btnMontar.onclick = () => App.usuariosPage.modalMontarEquipe(lista, cargos, () => App.usuariosPage.render(host));
    }

    const btnGoEquipe = document.getElementById('u-btn-goto-equipe');
    if (btnGoEquipe) {
      btnGoEquipe.onclick = () => App.ui.setPage('minhaEquipe');
    }

    const btnGestor = document.getElementById('u-btn-gestor');
    if (btnGestor) btnGestor.onclick = () => App.usuariosPage.modalNovoGestor(() => App.usuariosPage.render(host));

    const btnDir = document.getElementById('u-btn-dir');
    if (btnDir) btnDir.onclick = () => App.usuariosPage.modalNovoGestor(() => App.usuariosPage.render(host), null, true);

    const applyFilters = () => {
      const filtroMinhaEquipe = document.getElementById('u-filtro-minha-equipe')?.value || 'todos';
      App.usuariosPage._filtroEquipe = filtroMinhaEquipe;

      const tipoEl = document.getElementById('u-filtro-tipo');
      const tipo = tipoEl ? tipoEl.value : 'employee';
      const cargoId = document.getElementById('u-filtro-cargo')?.value || 'todos';
      const busca = (document.getElementById('u-busca-nome')?.value || '').toLowerCase().trim();

      let filtrados = lista;
      if (!isDirector) {
        filtrados = filtrados.filter(u => u.level === 'employee');
      } else if (tipo !== 'todos') {
        filtrados = filtrados.filter(u => u.level === tipo);
      }

      if (isManager && filtroMinhaEquipe === 'minha_equipe') {
        const teams = Array.isArray(App.user?.teams) ? App.user.teams : [];
        filtrados = filtrados.filter(u => 
          teams.includes(String(u.id)) || 
          teams.includes(u.id) || 
          teams.includes(u.cargo) || 
          teams.includes(u.nome)
        );
      }

      if (cargoId !== 'todos') filtrados = filtrados.filter(u => u.cargo_id === +cargoId);
      if (busca) filtrados = filtrados.filter(u => u.nome.toLowerCase().includes(busca) || u.usuario.toLowerCase().includes(busca));

      const hostTab = document.getElementById('u-tabela-host');
      if (!hostTab) return;

      if (!filtrados.length) {
        hostTab.innerHTML = `
          <div class="empty" style="padding:40px 10px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">👤</div>
            <b>Nenhum funcionário encontrado.</b>
            <p class="muted" style="margin-top:4px">
              ${filtroMinhaEquipe === 'minha_equipe' 
                ? 'Nenhum funcionário na sua equipe ainda. Clique em "⭐ Montar Minha Equipe" acima para adicionar membros.' 
                : 'Clique no botão "+ Cadastrar Funcionário" acima para adicionar.'}
            </p>
          </div>
        `;
        return;
      }

      hostTab.innerHTML = `
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Funcionário</th>
                <th>Login</th>
                <th>Identificação Visual</th>
                <th>Setor (Cargo)</th>
                ${isManager ? '<th>Minha Equipe</th>' : ''}
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtrados.map(u => {
                const avatar = App.utils.userAvatar(u.nome, u.genero);
                const onlineDot = u.is_online ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-left:6px" title="Online agora"></span>' : '';
                const genLabel = u.genero === 'F' 
                  ? '<span class="user-badge user-badge-fem" style="font-size:11px">♀ Feminino (Rosa)</span>' 
                  : (u.genero === 'O' 
                      ? '<span class="user-badge user-badge-other" style="font-size:11px">★ Neutro (Roxo)</span>' 
                      : '<span class="user-badge user-badge-masc" style="font-size:11px">♂ Masculino (Azul)</span>');

                const curTeams = Array.isArray(App.user?.teams) ? App.user.teams : [];
                const isNaEquipe = curTeams.includes(String(u.id)) || curTeams.includes(u.id) || curTeams.includes(u.cargo) || curTeams.includes(u.nome);

                return `
                  <tr>
                    <td>#${u.id}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        ${avatar}
                        <div>
                          <b>${App.utils.escape(u.nome)}</b> <span class="muted" style="font-size:11px">(${App.utils.escape(u.short || 'FUNC')})</span>
                          ${onlineDot}
                        </div>
                      </div>
                    </td>
                    <td><code>${App.utils.escape(u.usuario)}</code></td>
                    <td>${genLabel}</td>
                    <td>${App.utils.cargoBadge(u.cargo, u.cargo_cor)}</td>
                    ${isManager ? `
                      <td>
                        <button class="btn-ghost" data-toggle-team="${u.id}" style="font-size:12px;padding:4px 10px;border-radius:12px;${isNaEquipe ? 'background:rgba(245,158,11,.15);color:var(--orange);border:1px solid var(--orange)' : 'color:var(--muted)'}">
                          ${isNaEquipe ? '⭐ Na Equipe' : '➕ Adicionar'}
                        </button>
                      </td>
                    ` : ''}
                    <td>
                      ${u.ativo ? '<span class="pill-green status-pill">Ativo</span>' : '<span class="pill-red status-pill">Inativo</span>'}
                    </td>
                    <td>
                      <div style="display:flex;gap:4px;align-items:center">
                        <button class="btn-ghost" data-edit="${u.id}">✏ Editar</button>
                        ${(isDirector || isManager) && u.id !== App.user.id ? `
                          <button class="btn-danger" data-del="${u.id}">Excluir</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Toggle individual na equipe
      hostTab.querySelectorAll('[data-toggle-team]').forEach(b => {
        b.onclick = async () => {
          const empId = +b.dataset.toggleTeam;
          let teams = Array.isArray(App.user?.teams) ? [...App.user.teams] : [];
          const strId = String(empId);
          if (teams.includes(strId) || teams.includes(empId)) {
            teams = teams.filter(x => String(x) !== strId && x !== empId);
            App.utils.toast('Funcionário removido da sua equipe.');
          } else {
            teams.push(strId);
            App.utils.toast('Funcionário adicionado à sua equipe com sucesso!');
          }
          App.user.teams = teams;
          await App.users.update({ id: App.user.id, teams, atualizado_por: App.user.id });
          applyFilters();
        };
      });

      hostTab.querySelectorAll('[data-edit]').forEach(b => {
        b.onclick = () => {
          const target = lista.find(u => u.id === +b.dataset.edit);
          if (target && target.level === 'manager' && isDirector) {
            App.usuariosPage.modalNovoGestor(() => App.usuariosPage.render(host), target);
          } else if (target) {
            App.usuariosPage.form(cargos, target, () => App.usuariosPage.render(host));
          }
        };
      });

      hostTab.querySelectorAll('[data-del]').forEach(b => {
        b.onclick = async () => {
          const targetId = +b.dataset.del;
          const target = lista.find(u => u.id === targetId);
          if (!target) return;
          if (!(await App.utils.confirm(`Tem certeza que deseja excluir o funcionário "${target.nome}" permanentemente?`))) return;
          const r = await App.users.delete(targetId, App.user.id);
          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir.', 'err');
          App.utils.toast('Funcionário excluído com sucesso.');
          App.usuariosPage.render(host);
        };
      });
    };

    const filtroMinhaEquipe = document.getElementById('u-filtro-minha-equipe');
    if (filtroMinhaEquipe) filtroMinhaEquipe.onchange = applyFilters;

    const filtroTipo = document.getElementById('u-filtro-tipo');
    if (filtroTipo) filtroTipo.onchange = applyFilters;

    document.getElementById('u-filtro-cargo').onchange = applyFilters;
    document.getElementById('u-busca-nome').oninput = applyFilters;

    applyFilters();
  },

  modalMontarEquipe: async function (lista, cargos, onSuccess) {
    const funcionarios = lista.filter(u => u.level === 'employee');
    let currentTeams = Array.isArray(App.user?.teams) ? [...App.user.teams] : [];

    App.utils.modal(
      `<h3>⭐ Montar Minha Equipe</h3>
      <div style="font-size:12px;color:var(--txt-2);margin-bottom:12px">
        Marque os funcionários que farão parte da sua equipe para acompanhar as tarefas e carga de trabalho em <b>Minha Equipe</b>:
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <input type="text" id="me-busca" placeholder="Filtrar por nome ou setor..." style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line);font-size:12px;width:60%">
        <div style="display:flex;gap:6px">
          <button class="btn-ghost" id="me-sel-all" style="font-size:11px;padding:4px 8px">Marcar Todos</button>
          <button class="btn-ghost" id="me-desel-all" style="font-size:11px;padding:4px 8px">Desmarcar Todos</button>
        </div>
      </div>

      <div id="me-list-container" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:8px;max-height:280px;overflow-y:auto;padding:10px;background:rgba(0,0,0,.25);border-radius:8px;border:1px solid var(--line)">
        ${funcionarios.map(u => {
          const isChecked = currentTeams.includes(String(u.id)) || currentTeams.includes(u.id) || currentTeams.includes(u.cargo) || currentTeams.includes(u.nome);
          return `
            <label class="me-item" data-search="${u.nome.toLowerCase()} ${u.cargo.toLowerCase()}" style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:6px 8px;border-radius:6px;background:var(--bg-2);border:1px solid ${isChecked ? 'var(--orange)' : 'transparent'}">
              <input type="checkbox" value="${u.id}" class="me-chk-emp" style="width:auto;margin:0" ${isChecked ? 'checked' : ''}>
              ${App.utils.userAvatar(u.nome, u.genero)}
              <div style="overflow:hidden">
                <b style="display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${App.utils.escape(u.nome)}</b>
                <span class="muted" style="font-size:10px">${App.utils.escape(u.cargo)}</span>
              </div>
            </label>
          `;
        }).join('')}
      </div>

      <div class="actions" style="margin-top:16px">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="me-save-equipe" style="background:linear-gradient(135deg, #f59e0b, #d97706);border:none;font-weight:700">
          Salvar Minha Equipe
        </button>
      </div>`,
      (host) => {
        // Busca instantânea
        host.querySelector('#me-busca').oninput = function () {
          const term = this.value.toLowerCase().trim();
          host.querySelectorAll('.me-item').forEach(item => {
            const txt = item.dataset.search || '';
            item.style.display = txt.includes(term) ? 'flex' : 'none';
          });
        };

        // Marcar / Desmarcar todos
        host.querySelector('#me-sel-all').onclick = () => {
          host.querySelectorAll('.me-chk-emp').forEach(c => {
            if (c.closest('.me-item').style.display !== 'none') c.checked = true;
          });
        };
        host.querySelector('#me-desel-all').onclick = () => {
          host.querySelectorAll('.me-chk-emp').forEach(c => {
            if (c.closest('.me-item').style.display !== 'none') c.checked = false;
          });
        };

        // Salvar Equipe
        host.querySelector('#me-save-equipe').onclick = async () => {
          const selecionados = [...host.querySelectorAll('.me-chk-emp:checked')].map(c => String(c.value));
          App.user.teams = selecionados;

          const r = await App.users.update({
            id: App.user.id,
            teams: selecionados,
            atualizado_por: App.user.id
          });

          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao salvar equipe.', 'err');

          App.utils.toast(`Equipe salva com sucesso! (${selecionados.length} membros)`);
          App.utils.closeModal();
          if (onSuccess) onSuccess();
        };
      }
    );
  },

  form: function (cargos, u, onSuccess) {
    if (u && u.level === 'manager' && App.utils.isDirector()) {
      return App.usuariosPage.modalNovoGestor(onSuccess, u);
    }

    let selectedGenero = u?.genero || 'M';
    const isEdit = !!u;
    const isManager = App.utils.isManager();
    const setoresDisponiveis = cargos.filter(c => c.nome !== 'Direção Geral' && c.nome !== 'Gestores');

    App.utils.modal(
      `<h3>${isEdit ? '✏ Editar Funcionário' : '+ Cadastrar Novo Funcionário'}</h3>` +
      '<div class="field"><span>Nome Completo do Funcionário *</span><input id="u-nome" placeholder="Ex: Maria Silva ou João Santos" value="' + App.utils.escape(u?.nome || '') + '"></div>' +
      '<div class="field">' +
        '<span>Gênero / Identificação Visual (Cor no Sistema)</span>' +
        '<div class="gender-selector">' +
          '<div class="gender-opt ' + (selectedGenero === 'M' ? 'sel-masc' : '') + '" data-gen="M">♂ Masculino (Azul Claro)</div>' +
          '<div class="gender-opt ' + (selectedGenero === 'F' ? 'sel-fem' : '') + '" data-gen="F">♀ Feminino (Rosa Claro)</div>' +
          '<div class="gender-opt ' + (selectedGenero === 'O' ? 'sel-other' : '') + '" data-gen="O">★ Neutro (Roxo)</div>' +
        '</div>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field"><span>Usuário (Login) *</span><input id="u-user" placeholder="Ex: maria.editora" value="' + App.utils.escape(u?.usuario || '') + '"></div>' +
        '<div class="field"><span>PIN / Senha ' + (isEdit ? '(deixe em branco para manter)' : '*') + '</span><input type="password" id="u-pin" placeholder="••••••••"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field"><span>Setor (Cargo) *</span>' +
          '<select id="u-cargo">' +
            setoresDisponiveis.map(c => `<option value="${c.id}" ${u && u.cargo_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('') +
          '</select>' +
        '</div>' +
        '<div class="field"><span>Sigla de Identificação</span><input id="u-short" placeholder="Ex: ED, MIX, SRT-PT" value="' + App.utils.escape(u?.short || '') + '"></div>' +
      '</div>' +
      (isManager && !isEdit ? `
        <div class="field" style="margin-top:6px">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 10px;background:rgba(245,158,11,.1);border-radius:6px;border:1px solid var(--orange)">
            <input type="checkbox" id="u-add-to-my-team" checked style="width:auto;margin:0">
            <span>⭐ Adicionar este novo funcionário diretamente na <b>Minha Equipe</b></span>
          </label>
        </div>
      ` : '') +
      '<div class="field"><span>Status no Sistema</span><select id="u-ativo"><option value="1" ' + (u?.ativo !== 0 ? 'selected' : '') + '>Ativo</option><option value="0" ' + (u && u.ativo === 0 ? 'selected' : '') + '>Inativo</option></select></div>' +
      '<div class="actions"><button data-close class="btn-ghost">Cancelar</button><button class="btn-primary" id="u-ok">Salvar Funcionário</button></div>',
      (host) => {
        host.querySelectorAll('.gender-opt').forEach(opt => {
          opt.onclick = () => {
            selectedGenero = opt.dataset.gen;
            host.querySelectorAll('.gender-opt').forEach(x => x.className = 'gender-opt');
            if (selectedGenero === 'F') opt.classList.add('sel-fem');
            else if (selectedGenero === 'M') opt.classList.add('sel-masc');
            else opt.classList.add('sel-other');
          };
        });

        host.querySelector('#u-ok').onclick = async () => {
          const nome = host.querySelector('#u-nome').value.trim();
          const usuario = host.querySelector('#u-user').value.trim();
          const pin = host.querySelector('#u-pin').value;
          const cargo_id = +host.querySelector('#u-cargo').value;
          const short = host.querySelector('#u-short').value.trim();
          const ativo = +host.querySelector('#u-ativo').value;
          const addToMyTeam = host.querySelector('#u-add-to-my-team')?.checked;

          if (!nome || !usuario) return App.utils.toast('Nome e usuário são obrigatórios', 'err');
          if (!u && !pin) return App.utils.toast('Defina um PIN/senha de acesso para o funcionário', 'err');

          const p = {
            nome,
            usuario,
            pin,
            cargo_id,
            genero: selectedGenero,
            level: 'employee',
            short: short || 'FUNC',
            teams: [],
            ativo
          };

          const r = u ? await App.users.update({ id: u.id, ...p, atualizado_por: App.user.id }) : await App.users.create({ ...p, criado_por: App.user.id });
          if (!r.ok) return App.utils.toast(r.msg, 'err');

          // Se for novo funcionário e estiver marcado para adicionar à minha equipe:
          if (!u && r.id && addToMyTeam && isManager) {
            let teams = Array.isArray(App.user?.teams) ? [...App.user.teams] : [];
            teams.push(String(r.id));
            App.user.teams = teams;
            await App.users.update({ id: App.user.id, teams, atualizado_por: App.user.id });
          }

          App.utils.toast(`Funcionário ${nome} salvo com sucesso!`);
          App.utils.closeModal();

          if (u && u.id === App.user.id) {
            App.user.nome = p.nome;
            App.user.genero = p.genero;
            App.ui.renderUserBox();
          }

          if (onSuccess) onSuccess();
          else if (App.state.page === 'usuarios') App.usuariosPage.render(document.getElementById('page-host'));
          else if (App.state.page === 'minhaEquipe') App.minhaEquipePage.load();
        };
      }
    );
  },

  modalNovoGestor: async function (onSuccess, gestorToEdit, isDirectorRole = false) {
    if (App.gestoresPage && App.gestoresPage.modalForm) {
      return App.gestoresPage.modalForm(gestorToEdit, isDirectorRole);
    }
  }
};
