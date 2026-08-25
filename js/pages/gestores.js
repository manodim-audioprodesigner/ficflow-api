// FIC FLOW - GESTAO DEDICADA DE GESTORES (DIREÇÃO GERAL)
window.App = window.App || {};

const LISTA_IDIOMAS_GESTOR = [
  'Português',
  'Espanhol',
  'Inglês',
  'Árabe',
  'Urdu',
  'Indonésio',
  'Russo',
  'Francês'
];

App.gestoresPage = {
  render: async function (host) {
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="font-size:24px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px">
            <span>👥</span> Gestão de Gestores de Equipe
          </h2>
          <div style="font-size:13px;color:var(--txt-2);margin-top:3px">
            Cadastre, edite, altere senhas e gerencie as lideranças de cada setor
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn-primary" id="g-btn-cadastrar-gestor" style="font-size:14px;padding:10px 22px;font-weight:700">
            + Adicionar Gestor
          </button>
        </div>
      </div>

      <!-- KPIS -->
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:18px">
        <div class="card kpi"><b id="gk-total" style="color:var(--pri-2)">...</b><span class="muted">Total de Gestores</span></div>
        <div class="card kpi"><b id="gk-ativos" style="color:var(--green)">...</b><span class="muted">Gestores Ativos</span></div>
        <div class="card kpi"><b id="gk-idiomas">...</b><span class="muted">Idiomas Cobertos</span></div>
        <div class="card kpi"><b id="gk-funcs">...</b><span class="muted">Funcionários Liderados</span></div>
      </div>

      <!-- TABELA DE GESTORES -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:16px">Gestores Cadastrados no Sistema</b>
            <div class="muted" style="font-size:12px">Adicione novos gestores, edite informações, troque senhas ou exclua cadastros</div>
          </div>
          <button class="btn-primary" id="g-btn-cadastrar-gestor-sec" style="font-size:12px">
            + Adicionar Gestor
          </button>
        </div>
        <div id="g-tabela-host">
          <div class="empty">Carregando gestores...</div>
        </div>
      </div>
    `;

    document.getElementById('g-btn-cadastrar-gestor').onclick = () => App.gestoresPage.modalForm(null);
    document.getElementById('g-btn-cadastrar-gestor-sec').onclick = () => App.gestoresPage.modalForm(null);

    App.gestoresPage.load();
  },

  load: async function () {
    try {
      const [users, cargos] = await Promise.all([App.users.list(), App.cargos.list()]);
      const gestores = users.filter(u => u.level === 'manager');
      const funcionarios = users.filter(u => u.level === 'employee');

      // KPIs
      const elTotal = document.getElementById('gk-total');
      const elAtivos = document.getElementById('gk-ativos');
      const elIdiomas = document.getElementById('gk-idiomas');
      const elFuncs = document.getElementById('gk-funcs');

      const idiomasSet = new Set();
      gestores.forEach(g => { if (g.idioma) idiomasSet.add(g.idioma); });

      if (elTotal) elTotal.textContent = gestores.length;
      if (elAtivos) elAtivos.textContent = gestores.filter(g => g.ativo).length;
      if (elIdiomas) elIdiomas.textContent = idiomasSet.size || '—';
      if (elFuncs) elFuncs.textContent = funcionarios.length;

      const host = document.getElementById('g-tabela-host');
      if (!host) return;

      if (!gestores.length) {
        host.innerHTML = `
          <div class="empty" style="padding:50px 10px;text-align:center">
            <div style="font-size:36px;margin-bottom:8px">👥</div>
            <b style="font-size:16px">Nenhum gestor cadastrado ainda.</b>
            <p class="muted" style="margin-top:4px">Clique no botão abaixo para adicionar o primeiro gestor.</p>
            <button class="btn-primary" id="g-empty-add-btn" style="margin-top:12px">+ Adicionar Gestor</button>
          </div>
        `;
        const eb = host.querySelector('#g-empty-add-btn');
        if (eb) eb.onclick = () => App.gestoresPage.modalForm(null);
        return;
      }

      host.innerHTML = `
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nome do Gestor</th>
                <th>Login</th>
                <th>Idioma</th>
                <th>Gênero / Cor</th>
                <th>Equipes sob Comando</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${gestores.map(g => {
                const avatar = App.utils.userAvatar(g.nome, g.genero);
                const teamsStr = g.teams && g.teams.length
                  ? g.teams.map(t => `<span class="status-pill pill-purple" style="margin:2px;font-size:11px">${App.utils.escape(t)}</span>`).join('')
                  : '<span style="color:var(--muted)">Nenhuma equipe</span>';
                const genBadge = g.genero === 'F'
                  ? '<span class="user-badge user-badge-fem" style="font-size:11px">♀ Feminino (Rosa)</span>'
                  : '<span class="user-badge user-badge-masc" style="font-size:11px">♂ Masculino (Azul)</span>';

                return `
                  <tr>
                    <td>#${g.id}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        ${avatar}
                        <div>
                          <b>${App.utils.escape(g.nome)}</b>
                        </div>
                      </div>
                    </td>
                    <td><code>${App.utils.escape(g.usuario)}</code></td>
                    <td><span class="status-pill pill-gray" style="font-size:11px">${App.utils.escape(g.idioma || '—')}</span></td>
                    <td>${genBadge}</td>
                    <td><div style="display:flex;flex-wrap:wrap;gap:4px;max-width:320px">${teamsStr}</div></td>
                    <td>${g.ativo ? '<span class="status-pill pill-green">Ativo</span>' : '<span class="status-pill pill-red">Inativo</span>'}</td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
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

      // ✏ Editar
      host.querySelectorAll('[data-edit-gestor]').forEach(b => {
        b.onclick = () => {
          const u = gestores.find(x => x.id === +b.dataset.editGestor);
          if (u) App.gestoresPage.modalForm(u);
        };
      });

      // 🔑 Senha
      host.querySelectorAll('[data-senha-gestor]').forEach(b => {
        b.onclick = () => {
          const u = gestores.find(x => x.id === +b.dataset.senhaGestor);
          if (u) App.gestoresPage.modalSenha(u);
        };
      });

      // Excluir
      host.querySelectorAll('[data-del-gestor]').forEach(b => {
        b.onclick = async () => {
          const u = gestores.find(x => x.id === +b.dataset.delGestor);
          if (!u) return;
          if (!(await App.utils.confirm(`Tem certeza que deseja excluir o gestor "${u.nome}" permanentemente?`))) return;
          const r = await App.users.delete(u.id, App.user.id);
          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir.', 'err');
          App.utils.toast('Gestor excluído com sucesso.');
          App.gestoresPage.load();
        };
      });
    } catch (e) {
      console.error('[gestoresPage] erro ao carregar:', e);
    }
  },

  modalForm: async function (gestorToEdit, isDirectorRole = false, onSuccess = null) {
    const isEdit = !!gestorToEdit;
    if (isEdit && gestorToEdit.level === 'director') isDirectorRole = true;
    
    const roleName = isDirectorRole ? 'Diretor Geral' : 'Gestor';
    
    const cargos = await App.cargos.list();
    const setores = cargos.filter(c => c.nome !== 'Direção Geral' && c.nome !== 'Gestores');
    let selectedGenero = gestorToEdit?.genero || 'M';
    const currentTeams = gestorToEdit?.teams || [];
    const currentIdioma = gestorToEdit?.idioma || '';

    App.utils.modal(
      `<h3>${isEdit ? '✏ Editar ' + roleName : '+ Adicionar Novo ' + roleName}</h3>

      <div class="field">
        <span>Nome Completo do ${roleName} *</span>
        <input id="mg-nome" placeholder="Ex: Roberto Mendes" value="${App.utils.escape(gestorToEdit?.nome || '')}">
      </div>

      <div class="row">
        <div class="field">
          <span>Usuário (Login) *</span>
          <input id="mg-user" placeholder="Ex: gestor.pos" value="${App.utils.escape(gestorToEdit?.usuario || '')}">
        </div>
        <div class="field">
          <span>PIN / Senha ${isEdit ? '(deixe em branco para manter)' : '*'}</span>
          <input type="password" id="mg-pin" placeholder="••••••••">
        </div>
      </div>

      <div class="field">
        <span>Idioma</span>
        <select id="mg-idioma" style="padding:8px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
          <option value="">-- Selecione o idioma --</option>
          ${LISTA_IDIOMAS_GESTOR.map(i => `<option value="${i}" ${i === currentIdioma ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <span>Gênero / Identificação Visual</span>
        <div class="gender-selector">
          <div class="gender-opt ${selectedGenero === 'M' ? 'sel-masc' : ''}" data-gen="M">♂ Masculino (Azul Claro)</div>
          <div class="gender-opt ${selectedGenero === 'F' ? 'sel-fem' : ''}" data-gen="F">♀ Feminino (Rosa Claro)</div>
          <div class="gender-opt ${selectedGenero === 'O' ? 'sel-other' : ''}" data-gen="O">★ Neutro (Roxo)</div>
        </div>
      </div>

      <div class="field" style="${isDirectorRole ? 'display:none' : ''}">
        <span>Selecione as Equipes / Setores sob Comando deste Gestor:</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;margin-top:6px;max-height:180px;overflow-y:auto;padding:10px;background:rgba(0,0,0,.25);border-radius:8px;border:1px solid var(--line)">
          ${setores.map(s => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:4px 6px;border-radius:4px;background:var(--bg-2)">
              <input type="checkbox" value="${App.utils.escape(s.nome)}" class="chk-team" style="width:auto;margin:0" ${currentTeams.includes(s.nome) ? 'checked' : ''}>
              <span>${App.utils.escape(s.nome)}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="mg-save">Salvar ${roleName}</button>
      </div>`,

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

        host.querySelector('#mg-save').onclick = async () => {
          const nome = host.querySelector('#mg-nome').value.trim();
          const usuario = host.querySelector('#mg-user').value.trim();
          const pin = host.querySelector('#mg-pin').value;
          const idioma = host.querySelector('#mg-idioma').value;
          const teams = [...host.querySelectorAll('.chk-team:checked')].map(c => c.value);

          if (!nome) return App.utils.toast('Informe o nome', 'err');
          if (!usuario) return App.utils.toast('Informe o login', 'err');
          if (!isEdit && !pin) return App.utils.toast('Defina um PIN/senha', 'err');

          const gestCargo = cargos.find(c => c.nome === (isDirectorRole ? 'Direção Geral' : 'Gestores')) || cargos[0];

          const p = {
            nome,
            usuario,
            pin,
            cargo_id: gestCargo ? gestCargo.id : 1,
            genero: selectedGenero,
            level: isDirectorRole ? 'director' : 'manager',
            short: isDirectorRole ? 'DIR' : 'GEST',
            teams: isDirectorRole ? [] : teams,
            idioma,
            ativo: 1
          };

          const r = isEdit
            ? await App.users.update({ id: gestorToEdit.id, ...p, atualizado_por: App.user.id })
            : await App.users.create({ ...p, criado_por: App.user.id });

          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao salvar gestor.', 'err');

          App.utils.toast(`Gestor ${nome} ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!`);
          App.utils.closeModal();
          if (onSuccess) onSuccess();
          else if (App.gestoresPage && typeof App.gestoresPage.load === 'function') App.gestoresPage.load();
        };
      }
    );
  },

  modalSenha: function (u) {
    App.utils.modal(
      `<h3>🔑 Trocar Senha — ${App.utils.escape(u.nome)}</h3>
      <div class="field">
        <span>Nova Senha / PIN *</span>
        <input type="password" id="gs-nova" placeholder="Nova senha...">
      </div>
      <div class="field">
        <span>Confirmar Nova Senha *</span>
        <input type="password" id="gs-conf" placeholder="Confirmar nova senha...">
      </div>
      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="gs-save">Salvar Nova Senha</button>
      </div>`,
      (mhost) => {
        mhost.querySelector('#gs-save').onclick = async () => {
          const nova = mhost.querySelector('#gs-nova').value;
          const conf = mhost.querySelector('#gs-conf').value;
          if (!nova) return App.utils.toast('Informe a nova senha', 'err');
          if (nova !== conf) return App.utils.toast('As senhas não coincidem', 'err');
          const r = await App.users.update({ id: u.id, pin: nova, atualizado_por: App.user.id });
          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao alterar senha', 'err');
          App.utils.toast('Senha alterada com sucesso!');
          App.utils.closeModal();
        };
      }
    );
  }
};
