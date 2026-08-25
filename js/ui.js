App.ui = {};

App.ui.renderUserBox = function () {
  const box = document.getElementById('user-box');
  if (!box || !App.user) return;
  
  const avatarHtml = App.utils.userAvatar(App.user.nome, App.user.genero);
  const genIcon = App.user.genero === 'F' ? '♀' : (App.user.genero === 'O' ? '★' : '♂');
  const genLabel = App.user.genero === 'F' ? 'Feminino' : (App.user.genero === 'O' ? 'Neutro' : 'Masculino');
  const genCls = App.user.genero === 'F' ? 'user-badge-fem' : (App.user.genero === 'O' ? 'user-badge-other' : 'user-badge-masc');

  box.innerHTML = `
    <div class="user-box-header">
      ${avatarHtml}
      <div style="overflow:hidden;flex:1">
        <div class="u-name" title="${App.utils.escape(App.user.nome)}">${App.utils.escape(App.user.nome)}</div>
        <div style="display:flex;gap:4px;align-items:center;margin-top:2px;flex-wrap:wrap">
          ${App.utils.cargoBadge(App.user.cargo, App.user.cargo_cor)}
          <span class="user-badge ${genCls}" style="padding:1px 6px;font-size:10px" title="Gênero: ${genLabel}">${genIcon}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px">
      <button id="btn-trocar-senha" style="flex:1;padding:6px;font-size:11px;background:var(--panel-2);color:var(--txt);border:1px solid var(--line);border-radius:6px;cursor:pointer">🔑 Trocar Senha</button>
      <button id="btn-logout" style="flex:1;padding:6px;font-size:11px">Sair</button>
    </div>
  `;
  document.getElementById('btn-logout').onclick = () => { App.user = null; location.href = ''; };
  document.getElementById('btn-trocar-senha').onclick = () => App.ui.modalTrocarSenha();

  // Visibilidade dos menus conforme nível do usuário
  const isDirector = App.utils.isDirector();
  const isManager  = App.utils.isManager();
  const isEmployee = !isDirector && !isManager;

  // director-only: só Direção
  document.querySelectorAll('.nav.director-only').forEach(n => {
    n.style.display = isDirector ? '' : 'none';
  });

  // manager-only: só Gestores
  document.querySelectorAll('.nav.manager-only').forEach(n => {
    n.style.display = isManager ? '' : 'none';
  });

  // director-manager-only: Direção e Gestores
  document.querySelectorAll('.nav.director-manager-only').forEach(n => {
    n.style.display = (isDirector || isManager) ? '' : 'none';
  });

  // employee-only: só Funcionários
  document.querySelectorAll('.nav.employee-only').forEach(n => {
    n.style.display = isEmployee ? '' : 'none';
  });

  // admin-only: sinônimo de director-only (compatibilidade)
  document.querySelectorAll('.nav.admin-only').forEach(n => {
    n.style.display = isDirector ? '' : 'none';
  });
};

App.ui.setupTopbarControls = function () {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.onclick = () => App.theme.toggleTheme();
  }

  const colorKeyBtn = document.getElementById('colorkey-picker-btn');
  const popover = document.getElementById('color-picker-popover');
  if (colorKeyBtn && popover) {
    colorKeyBtn.onclick = (e) => {
      e.stopPropagation();
      popover.classList.toggle('show');
    };
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== colorKeyBtn) {
        popover.classList.remove('show');
      }
    });
    popover.querySelectorAll('.swatch-item').forEach(sw => {
      sw.onclick = () => {
        const color = sw.dataset.color;
        App.theme.setColorKey(color);
        App.utils.toast(`Chave de cor alterada: ${sw.dataset.name}`);
        popover.classList.remove('show');
      };
    });
  }

  const chatBtn = document.getElementById('topbar-chat-btn');
  if (chatBtn && App.chat) {
    chatBtn.onclick = () => App.chat.toggle();
  }
};

App.ui.setPage = function (page) {
  App.state.page = page;
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const titles = {
    dashboard: 'Painel Geral & Produção',
    programas: 'Lista dos Programas',
    minhasTarefas: 'Minhas Tarefas do Fluxo',
    'gestores-dir': 'Gestores de Equipe',
    gestores: 'Gestor — Meu Painel',
    usuarios: 'Funcionários — Tarefas e Produção',
    minhaEquipe: 'Minha Equipe (Carga e Tarefas)',
    direcao: 'Direção Geral',
    graficos: 'Gráficos & Métricas',
    historico: 'Histórico de Atividades',
    backup: 'Backup & Dados',
    categorias: 'Categorias',
    etapas: 'Etapas do Pipeline',
    tarefas: 'Controle de Programas'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  const btnNew = document.getElementById('btn-new');
  if (btnNew) {
    btnNew.textContent = '+ Novo Programa';
    btnNew.style.display = (page === 'dashboard' || page === 'programas' || page === 'tarefas') ? '' : 'none';
  }

  App.ui.render();
};

App.ui.render = function () {
  const host = document.getElementById('page-host');
  if (!host) return;
  host.innerHTML = '';
  const map = {
    dashboard:      () => App.dashboard?.render(host),
    programas:      () => App.programasPage?.render(host),
    minhasTarefas:  () => App.minhasTarefasPage?.render(host),
    'gestores-dir': () => App.gestoresDirPage?.render(host),
    gestores:       () => App.gestoresPage?.render(host),
    usuarios:       () => App.usuariosPage?.render(host),
    minhaEquipe:    () => App.minhaEquipePage?.render(host),
    direcao:        () => App.direcaoPage?.render(host),
    graficos:       () => App.graficos?.render(host),
    historico:      () => App.historicoPage?.render(host),
    backup:         () => App.backupPage?.render(host),
    categorias:     () => App.categoriasPage?.render(host),
    etapas:         () => App.etapasPage?.render(host),
    tarefas:        () => App.programasPage?.render(host)
  };
  if (map[App.state.page]) map[App.state.page]();
};

App.ui.modalTrocarSenha = function () {
  if (!App.user) return;
  App.utils.modal(
    `<h3>🔑 Alterar Senha — ${App.utils.escape(App.user.nome)}</h3>
    <div class="field">
      <span>Nova Senha / PIN *</span>
      <input type="password" id="ts-nova-senha" placeholder="Digite a nova senha">
    </div>
    <div class="field">
      <span>Confirmar Nova Senha *</span>
      <input type="password" id="ts-conf-senha" placeholder="Confirme a nova senha">
    </div>
    <div class="actions" style="margin-top:14px">
      <button data-close class="btn-ghost">Cancelar</button>
      <button class="btn-primary" id="ts-save">Salvar Nova Senha</button>
    </div>`,
    (host) => {
      host.querySelector('#ts-save').onclick = async () => {
        const nova = host.querySelector('#ts-nova-senha').value.trim();
        const conf = host.querySelector('#ts-conf-senha').value.trim();

        if (!nova) return App.utils.toast('Informe a nova senha', 'err');
        if (nova !== conf) return App.utils.toast('As senhas não coincidem', 'err');

        const res = await App.users.update({
          id: App.user.id,
          pin: nova,
          atualizado_por: App.user.id
        });

        if (!res.ok) return App.utils.toast(res.msg || 'Erro ao alterar senha', 'err');

        App.utils.toast('Senha alterada com sucesso!');
        App.utils.closeModal();
      };
    }
  );
};
