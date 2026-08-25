// FIC FLOW - MINHAS TAREFAS & CONTROLE DE SLA E CRIAÇÃO/EXCLUSÃO
window.App = window.App || {};

App.minhasTarefasPage = {
  render: async function (host) {
    const isMgr = App.utils.canManage();

    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:22px;font-weight:800;margin:0">Minhas Tarefas</h2>
          <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
            Monitore suas tarefas e etapas do fluxo. SLA: <b style="color:var(--pri-2)">Azul</b> = No prazo, <b style="color:var(--orange)">Amarelo</b> = Últimos 25%, <b style="color:var(--red)">Vermelho</b> = Atrasado.
          </div>
        </div>
        <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="mt-filtro" style="padding:6px 10px;border-radius:6px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
            <option value="mine">Minhas Tarefas</option>
            ${isMgr ? '<option value="all">Todas as Tarefas Abertas</option>' : ''}
          </select>
          <button class="btn-primary" id="mt-btn-nova-tarefa" style="font-weight:700">+ Criar Tarefa</button>
          <button class="btn-ghost" id="mt-btn-refresh">↻ Atualizar</button>
        </div>
      </div>

      <div id="mt-cards-container">
        <div class="empty">Carregando tarefas...</div>
      </div>
    `;

    document.getElementById('mt-filtro').onchange = App.minhasTarefasPage.load;
    document.getElementById('mt-btn-refresh').onclick = App.minhasTarefasPage.load;
    document.getElementById('mt-btn-nova-tarefa').onclick = () => App.app.newProgramaModal();

    App.minhasTarefasPage.load();
  },

  load: async function () {
    const filtro = document.getElementById('mt-filtro')?.value || 'mine';
    const host = document.getElementById('mt-cards-container');
    if (!host) return;

    const isMgr = App.utils.canManage();

    let tarefas = [];
    if (filtro === 'mine') {
      tarefas = await App.tarefas.minhas(App.user.id);
    } else {
      const all = await App.tarefas.list({});
      tarefas = all.filter(t => t.status != 2);
    }

    if (!tarefas || !tarefas.length) {
      host.innerHTML = `
        <div class="card" style="text-align:center;padding:50px 20px">
          <div style="font-size:40px;margin-bottom:10px">🎉</div>
          <h3 style="margin:0;font-size:18px">Nenhuma tarefa pendente!</h3>
          <p style="color:var(--txt-2);font-size:13px;margin-top:6px">Você está em dia com todas as etapas do fluxo de produção.</p>
          <button class="btn-primary" id="mt-btn-empty-create" style="margin-top:12px">+ Criar Nova Tarefa</button>
        </div>
      `;
      const eb = host.querySelector('#mt-btn-empty-create');
      if (eb) eb.onclick = () => App.app.newProgramaModal();
      return;
    }

    host.innerHTML = tarefas.map(t => {
      const sla = App.utils.slaInfo(t);
      const isMine = t.responsavel_id === App.user.id;
      const isCreator = t.criado_por === App.user.id;
      const isUnseen = isMine && !t.seen_at;

      const borderClass = sla.state === 'late' ? 'deadline-late' : (sla.state === 'warn' ? 'deadline-warn' : 'deadline-ok');
      const dotClass = sla.state === 'late' ? 'late' : (sla.state === 'warn' ? 'warn' : '');
      const deadlineText = sla.state === 'late' ? 'ATRASADO' : (sla.state === 'warn' ? 'NO LIMITE' : 'NO PRAZO');

      const userBadge = t.responsavel_nome ? App.utils.userBadge(t.responsavel_nome, t.responsavel_genero) : (t.responsavel_id ? `ID #${t.responsavel_id}` : '<span style="color:var(--muted)">Sem responsável</span>');
      const timeCriado = t.criado_em ? new Date(t.criado_em.replace(' ', 'T')).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-';
      const timeVisto = t.seen_at ? new Date(t.seen_at.replace(' ', 'T')).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Ainda não visto';

      // Permissão para excluir: Criador da tarefa OU Gestor/Diretor
      const canDelete = isCreator || isMgr;

      return `
        <div class="task card ${borderClass} ${isUnseen ? 'unseen' : ''}" style="margin-bottom:12px;background:var(--panel-2)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
            <div>
              <b style="font-size:15px;color:var(--txt)">${App.utils.escape(t.titulo)}</b>
              <div style="font-size:12px;color:var(--txt-2);margin-top:4px">
                ${userBadge} • <code>${App.utils.escape(t.folder || 'Pasta padrão')}</code>
                ${t.criado_por ? `<span style="margin-left:8px;font-size:11px;color:var(--muted)">Criada por: ${isCreator ? '<b>Você</b>' : 'Outro membro'}</span>` : ''}
              </div>
            </div>
            <div style="text-align:right">
              <span class="status-dot ${dotClass}"></span>
              <b style="font-size:12px;color:${sla.state === 'late' ? 'var(--red)' : (sla.state === 'warn' ? 'var(--orange)' : 'var(--pri-2)')}">${deadlineText}</b>
              <div style="font-size:11px;color:var(--muted)">${sla.texto} (Limite: ${sla.slaMin} min)</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);flex-wrap:wrap;gap:8px">
            <div style="font-size:11px;color:var(--muted)">
              Recebido: ${timeCriado} • Visto: <b style="color:${t.seen_at ? 'var(--green)' : 'var(--orange)'}">${timeVisto}</b>
            </div>

            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${isMine && !t.seen_at ? `
                <button class="btn-ghost" data-visto="${t.id}" style="font-size:12px">✓ Marcar Visto</button>
              ` : ''}

              ${isMine ? `
                <button class="btn-good" data-concluir="${t.id}">✓ Concluir Minha Tarefa</button>
              ` : ''}

              ${isMgr ? `
                <button class="btn-ghost" data-remanejar="${t.id}" style="font-size:12px">↔ Remanejar</button>
                <button class="btn-warn" data-simular="${t.id}" style="font-size:12px">▶ Simular Conclusão</button>
              ` : ''}

              ${canDelete ? `
                <button class="btn-danger" data-del-tarefa="${t.id}" style="font-size:12px">Excluir</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    host.querySelectorAll('[data-concluir]').forEach(b => {
      b.onclick = () => App.minhasTarefasPage.concluir(+b.dataset.concluir);
    });

    host.querySelectorAll('[data-visto]').forEach(b => {
      b.onclick = () => App.minhasTarefasPage.marcarVisto(+b.dataset.visto);
    });

    host.querySelectorAll('[data-simular]').forEach(b => {
      b.onclick = () => App.minhasTarefasPage.concluir(+b.dataset.simular);
    });

    host.querySelectorAll('[data-remanejar]').forEach(b => {
      b.onclick = () => App.minhasTarefasPage.remanejar(+b.dataset.remanejar);
    });

    host.querySelectorAll('[data-del-tarefa]').forEach(b => {
      b.onclick = async () => {
        const id = +b.dataset.delTarefa;
        if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
        const r = await App.tarefas.delete(id, App.user.id);
        if (!r.ok) return App.utils.toast(r.msg || 'Erro ao excluir tarefa.', 'err');
        App.utils.toast('Tarefa excluída com sucesso.');
        App.minhasTarefasPage.load();
      };
    });
  },

  modalNovaTarefa: async function () {
    const etapas = await App.etapas.list();
    const users = await App.users.list();
    const emps = users.filter(u => u.level === 'employee' && u.ativo);

    App.utils.modal(
      `<h3>+ Criar Nova Tarefa</h3>
      <div class="field">
        <span>Título da Tarefa *</span>
        <input id="nt-titulo" placeholder="Ex: SFI 2500 — Preparar edição para HeyGen">
      </div>
      <div class="row">
        <div class="field">
          <span>Etapa do Fluxo *</span>
          <select id="nt-etapa">
            ${etapas.map(e => `<option value="${e.id}">${App.utils.escape(e.codigo)} — ${App.utils.escape(e.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <span>Responsável</span>
          <select id="nt-resp">
            <option value="${App.user.id}">Atribuir a mim (${App.utils.escape(App.user.nome)})</option>
            <option value="">-- Sem responsável (Fila) --</option>
            ${emps.filter(u => u.id !== App.user.id).map(u => `<option value="${u.id}">${App.utils.escape(u.nome)} (${App.utils.escape(u.cargo || 'Func')})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <span>Prioridade</span>
          <select id="nt-prio">
            <option value="1">Normal</option>
            <option value="2">Alta</option>
            <option value="3">Urgente</option>
          </select>
        </div>
        <div class="field">
          <span>Cliente / Programa</span>
          <input id="nt-cliente" value="SFI" placeholder="Ex: SFI">
        </div>
      </div>
      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="nt-save">Criar Tarefa</button>
      </div>`,
      (host) => {
        host.querySelector('#nt-save').onclick = async () => {
          const titulo = host.querySelector('#nt-titulo').value.trim();
          const etapa_id = +host.querySelector('#nt-etapa').value;
          const respVal = host.querySelector('#nt-resp').value;
          const responsavel_id = respVal ? +respVal : null;
          const prioridade = +host.querySelector('#nt-prio').value;
          const cliente = host.querySelector('#nt-cliente').value.trim() || 'SFI';

          if (!titulo) return App.utils.toast('Informe o título da tarefa', 'err');
          if (!etapa_id) return App.utils.toast('Selecione uma etapa do fluxo', 'err');

          const r = await App.tarefas.create({
            titulo,
            etapa_id,
            responsavel_id,
            prioridade,
            cliente,
            criado_por: App.user.id
          });

          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao criar tarefa', 'err');

          App.utils.toast('Tarefa criada com sucesso!');
          App.utils.closeModal();
          App.minhasTarefasPage.load();
        };
      }
    );
  },

  marcarVisto: async function (id) {
    await App.tarefas.seen(id, App.user.id);
    App.utils.toast('Tarefa marcada como visualizada');
    App.minhasTarefasPage.load();
  },

  concluir: async function (id) {
    const res = await App.tarefas.complete(id, App.user.id);
    if (!res.ok) return App.utils.toast(res.msg, 'err');
    App.utils.toast('Tarefa concluída! Próxima etapa liberada no fluxo.');
    App.minhasTarefasPage.load();
  },

  remanejar: async function (id) {
    const users = await App.users.list();
    const emps = users.filter(u => u.level === 'employee' && u.ativo);

    App.utils.modal(
      `<h3>↔ Remanejar Tarefa</h3>
      <div class="field">
        <span>Selecione o novo responsável:</span>
        <select id="rem-user">
          ${emps.map(u => `<option value="${u.id}">${App.utils.escape(u.nome)} — ${App.utils.escape(u.cargo)}</option>`).join('')}
        </select>
      </div>
      <div class="actions">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="rem-ok">Confirmar Remanejamento</button>
      </div>`,
      (host) => {
        host.querySelector('#rem-ok').onclick = async () => {
          const newId = +host.querySelector('#rem-user').value;
          const r = await App.tarefas.update({ id, responsavel_id: newId, atualizado_por: App.user.id });
          if (!r.ok) return App.utils.toast(r.msg || 'Erro ao remanejar.', 'err');
          App.utils.toast('Tarefa remanejada com sucesso!');
          App.utils.closeModal();
          App.minhasTarefasPage.load();
        };
      }
    );
  }
};