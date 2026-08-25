// FIC FLOW - PROGRAMAS
window.App = window.App || {};

App.programasPage = {
  render: async function (host) {
    const canManage = App.utils.canManage(); // Diretor ou Gestor

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">Controle de Programas</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
            Acompanhe todos os programas em produção, crie novos fluxos, altere status e visualize as etapas
          </div>
        </div>
        <button class="btn-primary" id="prog-btn-novo" style="font-weight:700">+ Novo Programa</button>
      </div>

      <div class="card">
        <div class="toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <b>Filtros:</b>
          <input type="text" id="prog-busca" placeholder="Buscar por programa ou número (Ex: SFI 2500)..." style="min-width:240px;padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)" />
          <select id="prog-status" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
            <option value="Todos">Todos os status</option>
            <option value="Parado">🔴 Parados</option>
            <option value="Em andamento">🟠 Em andamento</option>
            <option value="Concluído">🟢 Finalizados</option>
          </select>
        </div>

        <div id="prog-lista-container">
          <div class="empty">Carregando programas...</div>
        </div>
      </div>
    `;

    const btnNovo = document.getElementById('prog-btn-novo');
    if (btnNovo) btnNovo.onclick = () => App.app.newProgramaModal();
    
    let st;
    document.getElementById('prog-busca').oninput = () => {
      clearTimeout(st);
      st = setTimeout(App.programasPage.load, 250);
    };

    document.getElementById('prog-status').onchange = App.programasPage.load;

    App.programasPage.load();
  },

  load: async function () {
    const busca = document.getElementById('prog-busca')?.value || '';
    const status = document.getElementById('prog-status')?.value || 'Todos';
    const canManage = App.utils.canManage();

    const progs = await App.programs.list({ busca, status });
    const host = document.getElementById('prog-lista-container');
    if (!host) return;

    if (!progs || !progs.length) {
      host.innerHTML = `
        <div class="empty" style="padding:40px 10px;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">▤</div>
          <b>Nenhum programa encontrado.</b>
          <p class="muted" style="margin-top:4px">
            Clique no botão "+ Novo Programa" acima para iniciar o primeiro programa no fluxo.
          </p>
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div class="prog-cards-grid">
        ${progs.map(p => {
          const isParado   = p.status === 'Parado';
          const isFinalizado = p.status === 'Concluído' || p.status === 'Finalizado';

          const cardBorderColor = isParado ? '#ff4757' : (isFinalizado ? '#2ed573' : '#ff9f43');

          const stPill = isParado
            ? '<span class="status-pill pill-red">🔴 Parado</span>'
            : isFinalizado
              ? '<span class="status-pill pill-green">🟢 Finalizado</span>'
              : '<span class="status-pill pill-orange">🟠 Em andamento</span>';

          const prioCls = p.prioridade === 'Urgente' ? 'pill-red' : (p.prioridade === 'Alta' ? 'pill-orange' : 'pill-gray');
          const resp = p.responsavel_atual ? App.utils.userBadge(p.responsavel_atual, p.responsavel_genero) : '<span style="color:var(--muted)">—</span>';
          
          const isCreator = p.criado_por && p.criado_por === App.user.id;
          const canEditOrDelete = canManage || isCreator;

          return `
            <div class="prog-card" style="border-left:5px solid ${cardBorderColor};background:var(--panel);border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:transform .15s">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div style="font-size:17px;font-weight:800;color:var(--txt)">
                    ${App.utils.escape(p.nome)} <span style="color:var(--muted);font-size:13px;font-weight:500">${App.utils.escape(p.codigo || '')}</span>
                  </div>
                  ${isCreator ? '<span style="font-size:11px;color:var(--pri-2);font-weight:600">★ Criado por você</span>' : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  ${stPill}
                  <span class="status-pill ${prioCls}" style="font-size:10px">${p.prioridade || 'Normal'}</span>
                </div>
              </div>

              <!-- BARRA DE PROGRESSO -->
              <div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
                  <span>Progresso do Fluxo</span>
                  <b style="color:${cardBorderColor}">${p.progresso}%</b>
                </div>
                <div style="height:6px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden">
                  <div style="height:100%;background:${cardBorderColor};width:${p.progresso}%;transition:width .4s;border-radius:10px"></div>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-top:4px">
                <div style="font-size:12px;color:var(--txt-2)">
                  <b>Etapa atual:</b> ${p.tarefa_atual ? App.utils.escape(p.tarefa_atual) : '<span style="color:#2ed573;font-weight:700">✓ Concluído</span>'}
                </div>
                <div style="font-size:12px">${resp}</div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.07);flex-wrap:wrap;gap:6px">
                <button class="btn-ghost" data-detalhes="${p.id}" style="font-size:12px">📋 Ver Etapas</button>
                
                ${canEditOrDelete ? `
                  <div style="display:flex;gap:4px">
                    <button class="btn-ghost" data-edit-prog="${p.id}" style="font-size:12px">✏ Editar Status</button>
                    <button class="btn-danger" data-del-prog="${p.id}" style="font-size:12px">Excluir</button>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Adiciona CSS dinâmico para o grid de cards
    if (!document.getElementById('prog-cards-css')) {
      const style = document.createElement('style');
      style.id = 'prog-cards-css';
      style.textContent = `.prog-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }`;
      document.head.appendChild(style);
    }

    host.querySelectorAll('[data-detalhes]').forEach(btn => {
      btn.onclick = () => App.programasPage.abrirDetalhes(+btn.dataset.detalhes);
    });

    host.querySelectorAll('[data-edit-prog]').forEach(btn => {
      btn.onclick = () => {
        const prog = progs.find(x => x.id === +btn.dataset.editProg);
        if (prog) App.programasPage.modalEditar(prog);
      };
    });

    host.querySelectorAll('[data-del-prog]').forEach(btn => {
      btn.onclick = async () => {
        const prog = progs.find(x => x.id === +btn.dataset.delProg);
        if (!prog) return;
        if (!confirm(`Tem certeza que deseja excluir o programa "${prog.nome} ${prog.codigo}" e todas as suas etapas?`)) return;
        const r = await App.programs.delete(prog.id, App.user.id);
        if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir.', 'err');
        App.utils.toast('Programa excluído com sucesso.');
        App.programasPage.load();
      };
    });
  },

  modalEditar: function (prog) {
    App.utils.modal(
      `<h3>✏ Editar Programa — ${App.utils.escape(prog.nome)} ${App.utils.escape(prog.codigo || '')}</h3>
      <div class="field">
        <span>Nome do Programa</span>
        <input id="ep-nome" value="${App.utils.escape(prog.nome || '')}">
      </div>
      <div class="row">
        <div class="field">
          <span>Número / Código</span>
          <input id="ep-codigo" value="${App.utils.escape(prog.codigo || '')}">
        </div>
        <div class="field">
          <span>Prioridade</span>
          <select id="ep-prio">
            <option value="Normal" ${prog.prioridade === 'Normal' ? 'selected' : ''}>Normal</option>
            <option value="Alta" ${prog.prioridade === 'Alta' ? 'selected' : ''}>Alta</option>
            <option value="Urgente" ${prog.prioridade === 'Urgente' ? 'selected' : ''}>Urgente</option>
          </select>
        </div>
      </div>
      <div class="field">
        <span>Status do Programa</span>
        <select id="ep-status">
          <option value="Em andamento" ${prog.status === 'Em andamento' ? 'selected' : ''}>🟠 Em andamento</option>
          <option value="Parado" ${prog.status === 'Parado' ? 'selected' : ''}>🔴 Parado</option>
          <option value="Concluído" ${prog.status === 'Concluído' ? 'selected' : ''}>🟢 Concluído / Finalizado</option>
        </select>
      </div>
      <div class="field">
        <span>Pasta Raiz de Rede</span>
        <input id="ep-root" value="${App.utils.escape(prog.root || '')}">
      </div>
      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="ep-save">Salvar Alterações</button>
      </div>`,
      (host) => {
        host.querySelector('#ep-save').onclick = async () => {
          const nome = host.querySelector('#ep-nome').value.trim();
          const codigo = host.querySelector('#ep-codigo').value.trim();
          const prioridade = host.querySelector('#ep-prio').value;
          const status = host.querySelector('#ep-status').value;
          const root = host.querySelector('#ep-root').value.trim();

          if (!nome) return App.utils.toast('Informe o nome do programa', 'err');

          const r = await App.programs.update({
            id: prog.id,
            nome,
            codigo,
            prioridade,
            status,
            root,
            atualizado_por: App.user.id
          });

          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao salvar programa', 'err');

          App.utils.toast('Programa atualizado com sucesso!');
          App.utils.closeModal();
          App.programasPage.load();
        };
      }
    );
  },

  abrirDetalhes: async function (programaId) {
    const [progs, tarefas, etapas, cargos] = await Promise.all([
      App.programs.list({}),
      App.tarefas.list({}),
      App.etapas.list(),
      App.cargos.list()
    ]);
    const prog = progs.find(p => p.id === programaId);
    const tarefasDoProg = tarefas.filter(t => t.programa_id === programaId);

    const progNome = prog?.nome || tarefasDoProg[0]?.programa_nome || 'Programa';
    const progCodigo = prog?.codigo || tarefasDoProg[0]?.programa_codigo || programaId;

    let customSteps = null;
    if (prog?.custom_flow) {
      try { customSteps = JSON.parse(prog.custom_flow); } catch (e) {}
    }

    let rowsHtml = '';

    if (customSteps && Array.isArray(customSteps) && customSteps.length > 0) {
      rowsHtml = customSteps.map((st, i) => {
        const t = tarefasDoProg[i];
        const cargoObj = cargos.find(c => c.nome === st.cargo) || { cor: '#7c5cff' };
        const stPill = t ? App.utils.statusPill(t.status) : '<span class="status-pill pill-gray">Aguardando</span>';
        const resp = t && t.responsavel_nome ? App.utils.userBadge(t.responsavel_nome, t.responsavel_genero) : (st.responsavel_id ? `ID #${st.responsavel_id}` : '<span style="color:var(--muted)">Auto-atribuir</span>');
        const sla = t ? App.utils.slaInfo(t) : { texto: '90 min', state: 'ok' };
        const dot = sla.state === 'late' ? 'late' : (sla.state === 'warn' ? 'warn' : '');

        return `
          <tr>
            <td>
              <span class="status-pill pill-purple" style="font-size:10px;font-weight:700">${i + 1}ª Etapa</span><br>
              <b style="font-size:13px">${App.utils.escape(st.label || `Etapa ${i + 1}`)}</b>
            </td>
            <td>${App.utils.cargoBadge(st.cargo, cargoObj.cor)}</td>
            <td>${stPill}</td>
            <td>${resp}</td>
            <td><span class="status-dot ${dot}"></span>${sla.texto}</td>
          </tr>
        `;
      }).join('');
    } else {
      rowsHtml = etapas.map(e => {
        const t = tarefasDoProg.find(x => x.etapa_id === e.id);
        const st = t ? App.utils.statusPill(t.status) : '<span class="status-pill pill-gray">Aguardando</span>';
        const resp = t && t.responsavel_nome ? App.utils.userBadge(t.responsavel_nome, t.responsavel_genero) : '<span style="color:var(--muted)">—</span>';
        const sla = t ? App.utils.slaInfo(t) : { texto: `${e.sla_minutos || 90} min`, state: 'ok' };
        const dot = sla.state === 'late' ? 'late' : (sla.state === 'warn' ? 'warn' : '');

        return `
          <tr>
            <td><b>${App.utils.escape(e.codigo)}</b><br><span style="font-size:12px;color:var(--txt-2)">${App.utils.escape(e.nome)}</span></td>
            <td>${App.utils.cargoBadge(e.cargo_nome, e.cargo_cor)}</td>
            <td>${st}</td>
            <td>${resp}</td>
            <td><span class="status-dot ${dot}"></span>${sla.texto}</td>
          </tr>
        `;
      }).join('');
    }

    App.utils.modal(
      `<h3>Fluxo de Produção: ${App.utils.escape(progNome)} ${App.utils.escape(progCodigo)}</h3>
      <div class="muted" style="margin-bottom:14px">
        ${customSteps ? `Fluxo Personalizado (${customSteps.length} etapas)` : 'Fluxo Completo de Dublagem (11 etapas)'}
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Setor (Cargo)</th>
            <th>Status</th>
            <th>Responsável</th>
            <th>Prazo / SLA</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="actions" style="margin-top:14px">
        <button data-close class="btn-primary">Fechar</button>
      </div>`
    );
  }
};
