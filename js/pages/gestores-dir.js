// FIC FLOW - GESTORES (VISÃO DA DIREÇÃO GERAL)
window.App = window.App || {};

App.gestoresDirPage = {

  render: async function (host) {
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;flex-wrap:wrap;gap:12px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">👥 Gestores de Equipe</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:3px">Cadastre e gerencie os gestores responsáveis por cada setor</div>
        </div>
        <button class="btn-primary" id="gd-btn-novo" style="font-size:14px;padding:10px 24px;font-weight:700">
          + Adicionar Gestor
        </button>
      </div>
      <div class="card">
        <div id="gd-tabela"><div class="empty">Carregando...</div></div>
      </div>
    `;

    document.getElementById('gd-btn-novo').onclick = () => App.gestoresPage.modalForm(null, false, () => App.gestoresDirPage.carregarTabela());
    App.gestoresDirPage.carregarTabela();
  },

  carregarTabela: async function () {
    const host = document.getElementById('gd-tabela');
    if (!host) return;

    let todos = [];
    try { todos = await App.users.list(); } catch (e) { host.innerHTML = '<div class="empty">Erro ao carregar.</div>'; return; }

    const gestores = todos.filter(u => u.level === 'manager');

    if (!gestores.length) {
      host.innerHTML = `
        <div class="empty" style="padding:60px 20px;text-align:center">
          <div style="font-size:40px;margin-bottom:12px">👥</div>
          <b style="font-size:16px">Nenhum gestor cadastrado.</b>
          <p style="color:var(--txt-2);margin-top:6px">Clique em "+ Adicionar Gestor" para começar.</p>
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div class="table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Login</th>
              <th>Idioma</th>
              <th>Gênero</th>
              <th>Equipes</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${gestores.map(g => `
              <tr>
                <td>#${g.id}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:9px">
                    ${App.utils.userAvatar(g.nome, g.genero)}
                    <b>${App.utils.escape(g.nome)}</b>
                  </div>
                </td>
                <td><code>${App.utils.escape(g.usuario)}</code></td>
                <td><span class="status-pill pill-gray" style="font-size:11px">${App.utils.escape(g.idioma || '—')}</span></td>
                <td>
                  ${g.genero === 'F'
                    ? '<span class="user-badge user-badge-fem" style="font-size:11px">♀ Feminino</span>'
                    : '<span class="user-badge user-badge-masc" style="font-size:11px">♂ Masculino</span>'}
                </td>
                <td>
                  <div style="display:flex;flex-wrap:wrap;gap:3px">
                    ${g.teams && g.teams.length
                      ? g.teams.map(t => `<span class="status-pill pill-purple" style="font-size:11px">${App.utils.escape(t)}</span>`).join('')
                      : '<span style="color:var(--muted);font-size:11px">Nenhuma</span>'}
                  </div>
                </td>
                <td>${g.ativo ? '<span class="status-pill pill-green">Ativo</span>' : '<span class="status-pill pill-red">Inativo</span>'}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn-ghost" style="font-size:12px" data-editar="${g.id}">✏ Editar</button>
                    <button class="btn-ghost" style="font-size:12px" data-senha="${g.id}">🔑 Senha</button>
                    <button class="btn-danger" style="font-size:12px" data-excluir="${g.id}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Botão Editar
    host.querySelectorAll('[data-editar]').forEach(btn => {
      btn.onclick = () => {
        const g = gestores.find(x => x.id === +btn.dataset.editar);
        if (g) App.gestoresPage.modalForm(g, false, () => App.gestoresDirPage.carregarTabela());
      };
    });

    // Botão Senha
    host.querySelectorAll('[data-senha]').forEach(btn => {
      btn.onclick = () => {
        const g = gestores.find(x => x.id === +btn.dataset.senha);
        if (g) App.gestoresDirPage.abrirTrocaSenha(g);
      };
    });

    // Botão Excluir
    host.querySelectorAll('[data-excluir]').forEach(btn => {
      btn.onclick = async () => {
        const g = gestores.find(x => x.id === +btn.dataset.excluir);
        if (!g) return;
        if (!confirm(`Excluir o gestor "${g.nome}" permanentemente?`)) return;
        const r = await App.users.delete(g.id, App.user.id);
        if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir.', 'err');
        App.utils.toast('Gestor excluído com sucesso.');
        App.gestoresDirPage.carregarTabela();
      };
    });
  },

  abrirFormulario: async function (gestor) {
    const isEdicao = !!gestor;
    let cargos = [];
    try { cargos = await App.cargos.list(); } catch (e) {}

    const setores = cargos.filter(c => c.nome !== 'Direção Geral' && c.nome !== 'Gestores');
    const equipesSelecionadas = gestor?.teams || [];
    let generoSelecionado = gestor?.genero || 'M';

    const idiomas = ['Português','Espanhol','Inglês','Árabe','Urdu','Indonésio','Russo','Francês'];

    App.utils.modal(
      `<h3>${isEdicao ? '✏ Editar Gestor' : '+ Adicionar Novo Gestor'}</h3>

      <div class="field">
        <span>Nome Completo *</span>
        <input id="gf-nome" placeholder="Ex: Roberto Mendes" value="${App.utils.escape(gestor?.nome || '')}">
      </div>

      <div class="row">
        <div class="field">
          <span>Login de Acesso *</span>
          <input id="gf-login" placeholder="Ex: gestor.pos" value="${App.utils.escape(gestor?.usuario || '')}">
        </div>
        <div class="field">
          <span>PIN / Senha ${isEdicao ? '(em branco = manter)' : '*'}</span>
          <input type="password" id="gf-senha" placeholder="••••••••">
        </div>
      </div>

      <div class="field">
        <span>Idioma Principal</span>
        <select id="gf-idioma" style="padding:8px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
          <option value="">— Selecione —</option>
          ${idiomas.map(i => `<option value="${i}" ${gestor?.idioma === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <span>Gênero / Identificação Visual</span>
        <div class="gender-selector">
          <div class="gender-opt ${generoSelecionado === 'M' ? 'sel-masc' : ''}" data-g="M">♂ Masculino (Azul)</div>
          <div class="gender-opt ${generoSelecionado === 'F' ? 'sel-fem' : ''}" data-g="F">♀ Feminino (Rosa)</div>
          <div class="gender-opt ${generoSelecionado === 'O' ? 'sel-other' : ''}" data-g="O">★ Neutro (Roxo)</div>
        </div>
      </div>

      <div class="field">
        <span>Equipes / Setores sob Comando:</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-top:6px;max-height:180px;overflow-y:auto;padding:10px;background:rgba(0,0,0,.2);border-radius:8px;border:1px solid var(--line)">
          ${setores.map(s => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:4px 6px;border-radius:4px;background:var(--bg-2)">
              <input type="checkbox" class="gf-equipe" value="${App.utils.escape(s.nome)}" style="width:auto;margin:0" ${equipesSelecionadas.includes(s.nome) ? 'checked' : ''}>
              <span>${App.utils.escape(s.nome)}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="gf-salvar">Salvar Gestor</button>
      </div>`,

      (mhost) => {
        // Seletor de gênero
        mhost.querySelectorAll('.gender-opt').forEach(opt => {
          opt.onclick = () => {
            generoSelecionado = opt.dataset.g;
            mhost.querySelectorAll('.gender-opt').forEach(x => x.className = 'gender-opt');
            opt.classList.add(generoSelecionado === 'F' ? 'sel-fem' : generoSelecionado === 'O' ? 'sel-other' : 'sel-masc');
          };
        });

        // Salvar
        mhost.querySelector('#gf-salvar').onclick = async () => {
          const nome   = mhost.querySelector('#gf-nome').value.trim();
          const login  = mhost.querySelector('#gf-login').value.trim();
          const senha  = mhost.querySelector('#gf-senha').value;
          const idioma = mhost.querySelector('#gf-idioma').value;
          const equipes = [...mhost.querySelectorAll('.gf-equipe:checked')].map(c => c.value);

          if (!nome)  return App.utils.toast('Informe o nome do gestor.', 'err');
          if (!login) return App.utils.toast('Informe o login do gestor.', 'err');
          if (!isEdicao && !senha) return App.utils.toast('Informe a senha do gestor.', 'err');

          const gestCargo = cargos.find(c => c.nome === 'Gestores') || cargos[0];

          const payload = {
            nome, usuario: login, pin: senha,
            cargo_id: gestCargo?.id,
            genero: generoSelecionado,
            level: 'manager',
            short: 'GEST',
            teams: equipes,
            idioma,
            ativo: 1
          };

          const r = isEdicao
            ? await App.users.update({ id: gestor.id, ...payload, atualizado_por: App.user.id })
            : await App.users.create({ ...payload, criado_por: App.user.id });

          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao salvar.', 'err');

          App.utils.toast(`Gestor ${nome} ${isEdicao ? 'atualizado' : 'cadastrado'} com sucesso!`);
          App.utils.closeModal();
          App.gestoresDirPage.carregarTabela();
        };
      }
    );
  },

  abrirTrocaSenha: function (gestor) {
    App.utils.modal(
      `<h3>🔑 Trocar Senha — ${App.utils.escape(gestor.nome)}</h3>
      <div class="field">
        <span>Nova Senha / PIN *</span>
        <input type="password" id="ts-nova" placeholder="Nova senha...">
      </div>
      <div class="field">
        <span>Confirmar Nova Senha *</span>
        <input type="password" id="ts-conf" placeholder="Confirme a senha...">
      </div>
      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="ts-salvar">Salvar Nova Senha</button>
      </div>`,
      (mhost) => {
        mhost.querySelector('#ts-salvar').onclick = async () => {
          const nova = mhost.querySelector('#ts-nova').value;
          const conf = mhost.querySelector('#ts-conf').value;
          if (!nova) return App.utils.toast('Informe a nova senha.', 'err');
          if (nova !== conf) return App.utils.toast('As senhas não coincidem.', 'err');

          const r = await App.users.update({ id: gestor.id, pin: nova, atualizado_por: App.user.id });
          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao alterar senha.', 'err');

          App.utils.toast('Senha alterada com sucesso!');
          App.utils.closeModal();
        };
      }
    );
  }

};
