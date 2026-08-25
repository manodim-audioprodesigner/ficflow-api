// FIC FLOW - MINHA EQUIPE & GESTÃO DE FUNCIONÁRIOS
window.App = window.App || {};

App.minhaEquipePage = {
  render: async function (host) {
    const isDirector = App.utils.isDirector();
    const teamsManaged = Array.isArray(App.user.teams) ? App.user.teams : [];

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0" id="team-page-title">
            👥 ${isDirector ? 'Todas as Equipes e Funcionários' : 'Minha Equipe (Funcionários)'}
          </h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
            ${isDirector 
              ? 'Gestão de todos os funcionários e cargas de trabalho de produção' 
              : (teamsManaged.length 
                  ? `Setores sob seu comando: <b>${teamsManaged.map(t => App.utils.escape(t)).join(', ')}</b>` 
                  : 'Cadastre, edite e gerencie os funcionários da produção')}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn-primary" id="team-btn-montar" style="background:linear-gradient(135deg, #f59e0b, #d97706);border:none;font-weight:700">
            ⭐ Montar Minha Equipe
          </button>
          <button class="btn" id="team-btn-novo-cargo" style="border-color:var(--pri)">+ Novo Setor / Cargo</button>
          <button class="btn-primary" id="team-btn-novo-func" style="font-size:14px;padding:9px 20px;font-weight:700">
            + Cadastrar Funcionário
          </button>
          <button class="btn" id="team-btn-redistribuir" style="font-size:12px">
            ⚖ Redistribuir Tarefas
          </button>
        </div>
      </div>

      <!-- CARDS DE RESUMO DE CARGA -->
      <div class="grid" id="team-kpis" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
        <div class="card kpi"><b id="tk-funcs">...</b><span class="muted">Funcionários</span></div>
        <div class="card kpi"><b id="tk-abertas">...</b><span class="muted">Tarefas Abertas</span></div>
        <div class="card kpi"><b id="tk-limite" style="color:var(--orange)">...</b><span class="muted">No Limite</span></div>
        <div class="card kpi"><b id="tk-atrasadas" style="color:var(--red)">...</b><span class="muted">Atrasadas</span></div>
      </div>

      <!-- TABELA DE MEMBROS DA EQUIPE -->
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:15px">Funcionários da Produção</b>
            <div class="muted" style="font-size:12px">Cadastre novos membros, acompanhe a carga de trabalho em tempo real ou remova funcionários</div>
          </div>
          <button class="btn-primary" id="team-btn-add-func-sec" style="font-size:12px">+ Cadastrar Funcionário</button>
        </div>
        <div id="team-table-host">
          <div class="empty">Carregando dados da equipe...</div>
        </div>
      </div>
    `;

    const btnMontar = document.getElementById('team-btn-montar');
    if (btnMontar) {
      btnMontar.onclick = async () => {
        const [lista, cargos] = await Promise.all([App.users.list(), App.cargos.list()]);
        App.usuariosPage.modalMontarEquipe(lista, cargos, () => App.minhaEquipePage.load());
      };
    }

    const btnNovoCargo = document.getElementById('team-btn-novo-cargo');
    if (btnNovoCargo) {
      btnNovoCargo.onclick = () => App.utils.modalNovoCargo(() => App.minhaEquipePage.load());
    }

    document.getElementById('team-btn-novo-func').onclick = async () => {
      const cargos = await App.cargos.list();
      App.usuariosPage.form(cargos, null, () => App.minhaEquipePage.load());
    };

    document.getElementById('team-btn-add-func-sec').onclick = async () => {
      const cargos = await App.cargos.list();
      App.usuariosPage.form(cargos, null, () => App.minhaEquipePage.load());
    };

    document.getElementById('team-btn-redistribuir').onclick = async () => {
      if (!confirm('Deseja redistribuir todas as tarefas abertas para equilibrar a carga dos funcionários?')) return;
      const res = await App.tarefas.rebalanceOpen(App.user.id, App.user.teams);
      if (res && res.ok) {
        App.utils.toast(`${res.reassigned || 0} tarefas redistribuídas com sucesso!`);
        App.minhaEquipePage.load();
      }
    };

    App.minhaEquipePage.load();
  },

  load: async function () {
    try {
      const data = await App.stats.teamLoad(App.user.id);
      
      const tk1 = document.getElementById('tk-funcs');
      const tk2 = document.getElementById('tk-abertas');
      const tk3 = document.getElementById('tk-limite');
      const tk4 = document.getElementById('tk-atrasadas');

      if (tk1) tk1.textContent = data.funcionariosCount || 0;
      if (tk2) tk2.textContent = data.tarefasAbertasCount || 0;
      if (tk3) tk3.textContent = data.noLimiteCount || 0;
      if (tk4) tk4.textContent = data.atrasadasCount || 0;

      const host = document.getElementById('team-table-host');
      if (!host) return;

      const emps = data.funcionarios || [];
      if (!emps.length) {
        host.innerHTML = `
          <div class="empty" style="padding:40px 10px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">👥</div>
            <b style="font-size:15px">Nenhum funcionário encontrado.</b>
            <p class="muted" style="margin-top:4px">Clique em "+ Cadastrar Funcionário" para adicionar membros à equipe.</p>
            <button class="btn-primary" id="team-empty-btn" style="margin-top:12px">+ Cadastrar Funcionário</button>
          </div>
        `;
        const eb = host.querySelector('#team-empty-btn');
        if (eb) {
          eb.onclick = async () => {
            const cargos = await App.cargos.list();
            App.usuariosPage.form(cargos, null, () => App.minhaEquipePage.load());
          };
        }
        return;
      }

      // Sort by open tasks descending
      emps.sort((a, b) => (b.tarefas_abertas || 0) - (a.tarefas_abertas || 0));

      host.innerHTML = `
        <div class="table">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Login</th>
                <th>Identificação</th>
                <th>Setor (Cargo)</th>
                <th>Tarefas Abertas</th>
                <th>Atividade Atual</th>
                <th>Prazo / SLA</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${emps.map(u => {
                const avatar = App.utils.userAvatar(u.nome, u.genero);
                const genBadge = u.genero === 'F' 
                  ? '<span class="user-badge user-badge-fem" style="font-size:10px">♀ Feminino (Rosa)</span>' 
                  : '<span class="user-badge user-badge-masc" style="font-size:10px">♂ Masculino (Azul)</span>';
                
                let slaHtml = '<span style="color:var(--green)">Livre</span>';

                if (u.tarefa_atual) {
                  const fakeTask = {
                    criado_em: u.tarefa_criada_em,
                    sla_minutos: u.tarefa_sla || 90
                  };
                  const sla = App.utils.slaInfo(fakeTask);
                  const dotCls = sla.state === 'late' ? 'late' : (sla.state === 'warn' ? 'warn' : '');
                  slaHtml = `<span class="status-dot ${dotCls}"></span>${sla.texto}`;
                }

                return `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        ${avatar}
                        <div><b>${App.utils.escape(u.nome)}</b> <span class="muted" style="font-size:11px">(${App.utils.escape(u.short || 'FUNC')})</span></div>
                      </div>
                    </td>
                    <td><code>${App.utils.escape(u.usuario)}</code></td>
                    <td>${genBadge}</td>
                    <td>${App.utils.cargoBadge(u.cargo_nome, u.cargo_cor)}</td>
                    <td><b style="font-size:14px;color:${u.tarefas_abertas > 3 ? 'var(--orange)' : 'var(--txt)'}">${u.tarefas_abertas || 0}</b></td>
                    <td>${u.tarefa_atual ? `<b>${App.utils.escape(u.tarefa_atual)}</b>` : '<span style="color:var(--muted)">Disponível</span>'}</td>
                    <td>${slaHtml}</td>
                    <td>${u.ativo ? '<span class="status-pill pill-green">Ativo</span>' : '<span class="status-pill pill-red">Inativo</span>'}</td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap">
                        <button class="btn-ghost" data-edit-emp="${u.id}">✏ Editar</button>
                        <button class="btn-danger" data-del-emp="${u.id}">Excluir</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      host.querySelectorAll('[data-edit-emp]').forEach(b => {
        b.onclick = async () => {
          const cargos = await App.cargos.list();
          const users = await App.users.list();
          const target = users.find(x => x.id === +b.dataset.editEmp);
          App.usuariosPage.form(cargos, target, () => App.minhaEquipePage.load());
        };
      });

      host.querySelectorAll('[data-del-emp]').forEach(b => {
        b.onclick = async () => {
          const targetId = +b.dataset.delEmp;
          const users = await App.users.list();
          const target = users.find(x => x.id === targetId);
          if (!target) return;
          if (!(await App.utils.confirm(`Tem certeza que deseja excluir o funcionário "${target.nome}" permanentemente?`))) return;
          const r = await App.users.delete(targetId, App.user.id);
          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir.', 'err');
          App.utils.toast('Funcionário excluído com sucesso.');
          App.minhaEquipePage.load();
        };
      });
    } catch (e) {
      console.error('[minhaEquipe] load erro:', e);
    }
  }
};
