// FIC FLOW - DASHBOARD & SIMULACAO
window.App = window.App || {};

App.dashboard = {
  render: async function (host) {
    const isDirector = App.utils.isDirector();

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">▦ Painel Geral</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">Simulador de produção e controle em escala com inteligência de fluxo</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn" id="dash-btn-novo-cargo" style="border-color:var(--pri)">+ Novo Setor / Cargo</button>
          ${isDirector ? '<button class="btn" id="dash-btn-novo-gestor">+ Cadastrar Gestor</button>' : ''}
          <button class="btn" id="dash-btn-novo-func">+ Cadastrar Funcionário</button>
          <button class="btn-primary" id="dash-btn-novo">+ Novo Programa</button>
        </div>
      </div>

      <!-- KPIS -->
      <div class="grid" id="dash-kpis" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
        <div class="card kpi"><b id="k-progs-ativos">...</b><span class="muted">Programas Ativos</span></div>
        <div class="card kpi"><b id="k-tarefas-abertas">...</b><span class="muted">Tarefas Abertas</span></div>
        <div class="card kpi"><b id="k-concluidas" style="color:var(--green)">...</b><span class="muted">Concluídas</span></div>
        <div class="card kpi"><b id="k-funcs-ativos">...</b><span class="muted">Funcionários Ativos</span></div>
        <div class="card kpi"><b id="k-minhas-tarefas" style="color:var(--pri-2)">...</b><span class="muted">Minhas Tarefas</span></div>
      </div>

      <!-- SIMULAÇÃO RÁPIDA -->
      <div class="card" style="margin-top:16px">
        <div class="toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="font-weight:700;font-size:13px">⚡ Simulação Rápida em Escala:</span>
          <button class="btn" id="btn-bulk-10">+10 Programas</button>
          <button class="btn" id="btn-bulk-25">+25 Programas</button>
          <button class="btn" id="btn-bulk-50">+50 Programas</button>
          <button class="btn warn" id="btn-adv-random">▶ Concluir 20 Tarefas Aleatórias</button>
        </div>
      </div>

      <!-- TABELA DE PROGRAMAS ATIVOS -->
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <b style="font-size:15px">Programas Recentes no Pipeline</b>
          <button class="btn-ghost" id="btn-ver-todos-progs" style="font-size:12px">Ver todos →</button>
        </div>
        <div id="dash-programas-table">
          <div class="empty">Carregando programas...</div>
        </div>
      </div>
    `;

    // Event handlers
    document.getElementById('dash-btn-novo').onclick = () => App.app.newProgramaModal();
    document.getElementById('btn-ver-todos-progs').onclick = () => App.ui.setPage('programas');

    document.getElementById('dash-btn-novo-cargo').onclick = () => App.utils.modalNovoCargo(() => App.dashboard.loadData());
    document.getElementById('dash-btn-novo-func').onclick = async () => {
      const cargos = await App.cargos.list();
      App.usuariosPage.form(cargos, null);
    };

    const btnGestor = document.getElementById('dash-btn-novo-gestor');
    if (btnGestor) {
      btnGestor.onclick = () => App.usuariosPage.modalNovoGestor(() => App.dashboard.loadData());
    }

    document.getElementById('btn-bulk-10').onclick = async () => {
      const res = await App.programs.bulkCreate({ count: 10, criado_por: App.user.id });
      if (res && res.ok) {
        App.utils.toast('10 programas adicionados com sucesso!');
        App.dashboard.loadData();
      }
    };

    document.getElementById('btn-bulk-25').onclick = async () => {
      const res = await App.programs.bulkCreate({ count: 25, criado_por: App.user.id });
      if (res && res.ok) {
        App.utils.toast('25 programas adicionados com sucesso!');
        App.dashboard.loadData();
      }
    };

    document.getElementById('btn-bulk-50').onclick = async () => {
      const res = await App.programs.bulkCreate({ count: 50, criado_por: App.user.id });
      if (res && res.ok) {
        App.utils.toast('50 programas adicionados com sucesso!');
        App.dashboard.loadData();
      }
    };

    document.getElementById('btn-adv-random').onclick = async () => {
      const res = await App.tarefas.advanceRandom(20, App.user.id);
      if (res && res.ok) {
        App.utils.toast(`${res.done || 20} tarefas concluídas e avançadas no fluxo!`);
        App.dashboard.loadData();
      }
    };

    App.dashboard.loadData();
  },

  loadData: async function () {
    try {
      const [programas, tarefasAbertas, users, minhas] = await Promise.all([
        App.programs.list(),
        App.tarefas.list({ status: '' }),
        App.users.list(),
        App.tarefas.minhas(App.user.id)
      ]);

      const ativos = programas.filter(p => p.status !== 'Concluído');
      const concluidos = programas.filter(p => p.status === 'Concluído');
      const openTasks = tarefasAbertas.filter(t => t.status != 2);
      const doneTasks = tarefasAbertas.filter(t => t.status == 2);
      const activeUsers = users.filter(u => u.ativo);

      const k1 = document.getElementById('k-progs-ativos');
      const k2 = document.getElementById('k-tarefas-abertas');
      const k3 = document.getElementById('k-concluidas');
      const k4 = document.getElementById('k-funcs-ativos');
      const k5 = document.getElementById('k-minhas-tarefas');

      if (k1) k1.textContent = ativos.length;
      if (k2) k2.textContent = openTasks.length;
      if (k3) k3.textContent = doneTasks.length;
      if (k4) k4.textContent = activeUsers.length;
      if (k5) k5.textContent = minhas.length;

      // Render programs table
      const host = document.getElementById('dash-programas-table');
      if (host) {
        if (!programas.length) {
          host.innerHTML = '<div class="empty">Nenhum programa cadastrado. Use a Simulação Rápida ou crie um novo programa.</div>';
          return;
        }

        const list = programas.slice(0, 15);
        host.innerHTML = `
          <div class="table">
            <table>
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Tarefa Atual</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(p => {
                  const prioCls = p.prioridade === 'Urgente' ? 'pill-red' : (p.prioridade === 'Alta' ? 'pill-orange' : 'pill-gray');
                  const resp = p.responsavel_atual ? App.utils.userBadge(p.responsavel_atual, p.responsavel_genero) : '<span style="color:var(--muted)">—</span>';
                  const stPill = p.status === 'Concluído' ? '<span class="status-pill pill-green">Concluído</span>' : '<span class="status-pill pill-orange">Em andamento</span>';

                  return `
                    <tr>
                      <td><b>${App.utils.escape(p.nome)} ${App.utils.escape(p.codigo)}</b></td>
                      <td><span class="status-pill ${prioCls}">${p.prioridade || 'Normal'}</span></td>
                      <td>${stPill}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px">
                          <div class="bar" style="height:7px;background:rgba(255,255,255,.1);border-radius:10px;overflow:hidden;width:110px">
                            <i style="display:block;height:100%;background:var(--green);width:${p.progresso}%;transition:width .3s"></i>
                          </div>
                          <span style="font-size:11px;font-weight:700">${p.progresso}%</span>
                        </div>
                      </td>
                      <td>${p.tarefa_atual ? App.utils.escape(p.tarefa_atual) : '<span style="color:var(--green);font-weight:700">✓ Finalizado</span>'}</td>
                      <td>${resp}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (e) {
      console.error('[dashboard] loadData erro:', e);
    }
  }
};
