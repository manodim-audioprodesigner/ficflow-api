App.tarefasPage = {};

App.tarefasPage.render = async function (host) {
  host.innerHTML = '<div class="filters" id="t-filters"></div><table class="table" id="t-table"><thead><tr><th>Responsavel</th><th>Programa</th><th>Idioma</th><th>Status</th><th>Prazo (SLA)</th><th></th></tr></thead><tbody id="t-body"></tbody></table>';
  const [etapas] = await Promise.all([App.etapas.list()]);
  App.state.cache.etapas = etapas;
  const f = document.getElementById('t-filters');
  f.innerHTML =
    '<select id="ts-etapa"><option value="">Todas etapas</option>' + etapas.map(e => '<option value="' + e.id + '">' + e.nome + '</option>').join('') + '</select>' +
    '<select id="ts-status"><option value="">Todos</option><option value="0">Travado</option><option value="1">Fazendo</option><option value="2">Pronto</option></select>' +
    '<button class="btn-primary btn-sm" id="ts-distribuir">⚡ Distribuir automaticamente</button>';
  ['ts-etapa','ts-status'].forEach(id => { const el = document.getElementById(id); if (el) el.onchange = App.tarefasPage.load; });
  document.getElementById('ts-distribuir').onclick = async () => {
    const r = await App.tarefas.distribuir();
    if (!r.ok) return App.utils.toast(r.msg, 'err');
    App.utils.toast(r.msg || 'Distribuição concluída');
    await App.tarefasPage.load();
  };
  await App.tarefasPage.load();
};

// Calcula estado do SLA: ok / warn / late
App.tarefasPage.slaInfo = function (t) {
  let deadlineMs = null;
  // prioridade: prazo explicito; senao SLA da etapa desde a ultima mudanca de status
  if (t.prazo) {
    const p = new Date(t.prazo + 'T23:59:59').getTime();
    deadlineMs = p - Date.now();
  } else if (t.status_atualizado_em) {
    const inicio = new Date(t.status_atualizado_em.replace(' ', 'T')).getTime();
    if (!isNaN(inicio)) {
      const slaMs = (t.sla_minutos || 90) * 60000;
      deadlineMs = (inicio + slaMs) - Date.now();
    }
  }
  if (deadlineMs === null) return { state: 'none', texto: '-' };
  if (deadlineMs < 0) return { state: 'late', texto: 'ATRASADO • ' + fmtDur(-deadlineMs) };
  if (deadlineMs <= ((t.sla_minutos || 90) * 60000) * 0.25 && t.prazo === undefined) return { state: 'warn', texto: 'NO LIMITE • ' + fmtDur(deadlineMs) };
  return { state: 'ok', texto: fmtDur(deadlineMs) };
};

function fmtDur(ms) {
  const mins = Math.floor(ms / 60000), h = Math.floor(mins / 60), m = mins % 60;
  return (h ? h + 'h ' : '') + m + 'min';
}

App.tarefasPage.load = async function () {
  const busca = document.getElementById('search-global')?.value || '';
  const r = await App.tarefas.list({
    etapa_id: document.getElementById('ts-etapa')?.value,
    status: document.getElementById('ts-status')?.value,
    busca
  });
  const body = document.getElementById('t-body');
  body.innerHTML = r.length
    ? r.map(t => {
        const sla = App.tarefasPage.slaInfo(t);
        const dotCls = sla.state === 'late' ? 'late' : sla.state === 'warn' ? 'warn' : '';
        const userBadge = t.criado_por_nome ? App.utils.userBadge(t.criado_por_nome, t.criado_por_genero) : '<span style="color:var(--muted)">-</span>';
        const respBadge = t.responsavel_nome ? App.utils.userBadge(t.responsavel_nome, t.responsavel_genero) : '';

        return '<tr data-id="' + t.id + '" style="cursor:pointer">' +
          '<td>' + userBadge + '</td>' +
          '<td><b>' + App.utils.escape(t.titulo) + '</b>' + (t.cliente ? '<div style="font-size:11px;color:var(--muted)">' + App.utils.escape(t.cliente) + '</div>' : '') + '</td>' +
          '<td>' + App.utils.escape(t.idioma || '-') + '</td>' +
          '<td>' + App.tarefasPage.statusSelect(t) + '</td>' +
          '<td><span class="status-dot ' + dotCls + '"></span>' + sla.texto + '</td>' +
          '<td>' +
          (App.utils.canAdmin() || t.criado_por === App.user.id ? '<button class="btn-ghost" data-open="' + t.id + '">Abrir</button> <button class="btn-ghost" data-rem="' + t.id + '">Remanejar</button> <button class="btn-danger" data-del="' + t.id + '">Excluir</button>' : '<button class="btn-ghost" data-open="' + t.id + '">Abrir</button>') +
          '</td></tr>';
      }).join('')
    : '<tr><td class="empty" colspan="6">Nenhuma tarefa encontrada.</td></tr>';
  body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => App.tarefasPage.open(+b.dataset.open));
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => App.tarefasPage.excluir(+b.dataset.del));
  body.querySelectorAll('[data-rem]').forEach(b => b.onclick = () => App.tarefasPage.remanejar(+b.dataset.rem));
  body.querySelectorAll('[data-status]').forEach(sel => sel.onchange = (e) => App.tarefasPage.mudarStatus(+e.target.dataset.id, +e.target.value));
  body.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = (e) => { if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') App.tarefasPage.open(+tr.dataset.id); });
};

App.tarefasPage.statusSelect = function (t) {
  const labels = { 0: 'Travado', 1: 'Fazendo', 2: 'Pronto' };
  return '<select class="status-select" data-status data-id="' + t.id + '">' +
    [0,1,2].map(s => '<option value="' + s + '" ' + (t.status===s?'selected':'') + '>' + labels[s] + '</option>').join('') +
    '</select>';
};

App.tarefasPage.mudarStatus = async function (id, novoStatus) {
  const r = await App.tarefas.setStatus(id, novoStatus, App.user.id, 'Lista de tarefas');
  if (!r.ok) return App.utils.toast(r.msg, 'err');
  App.utils.toast('Status atualizado');
  await App.tarefasPage.load();
};

App.tarefasPage.open = async function (id) {
  const [t, hist] = await Promise.all([App.tarefas.get(id), App.tarefas.historico(id)]);
  const etapas = App.state.cache.etapas, categorias = App.state.cache.categorias, usuarios = App.state.cache.usuarios;
  const podeExcluir = App.utils.canAdmin() || t.criado_por === App.user.id;
  const statusLabels = { 0: 'Travado', 1: 'Fazendo', 2: 'Pronto' };
  const respBadge = t.responsavel_nome ? App.utils.userBadge(t.responsavel_nome, t.responsavel_genero) : '<span style="color:var(--muted)">Não atribuído</span>';
  const criadorBadge = t.criado_por_nome ? App.utils.userBadge(t.criado_por_nome, t.criado_por_genero) : '';

  App.utils.modal(
    '<h3>' + App.utils.escape(t.titulo) + '</h3>' +
    (t.nota ? '<div class="nota-box"><b>Nota:</b> ' + App.utils.escape(t.nota) + '</div>' : '') +
    '<div class="field"><span>Título</span><input id="k-titulo" value="' + App.utils.escape(t.titulo) + '"></div>' +
    '<div class="row"><div class="field"><span>Cliente</span><input id="k-cliente" value="' + App.utils.escape(t.cliente||'') + '"></div>' +
    '<div class="field"><span>Idioma</span><input id="k-idioma" value="' + App.utils.escape(t.idioma||'') + '"></div></div>' +
    '<div class="row"><div class="field"><span>Etapa</span><select id="k-etapa">' + etapas.map(e => '<option value="' + e.id + '" ' + (e.id===t.etapa_id?'selected':'') + '>' + e.nome + '</option>').join('') + '</select></div>' +
    '<div class="field"><span>Categoria</span><select id="k-cat"><option value="">--</option>' + categorias.map(c => '<option value="' + c.id + '" ' + (c.id===t.categoria_id?'selected':'') + '>' + c.nome + '</option>').join('') + '</select></div></div>' +
    '<div class="row"><div class="field"><span>Prioridade</span><select id="k-prio"><option value="0" '+(t.prioridade===0?'selected':'')+'>Baixa</option><option value="1" '+(t.prioridade===1?'selected':'')+'>Média</option><option value="2" '+(t.prioridade===2?'selected':'')+'>Alta</option></select></div>' +
    '<div class="field"><span>Prazo</span><input type="date" id="k-prazo" value="' + (t.prazo||'') + '"></div></div>' +
    '<div class="field"><span>Nota</span><textarea id="k-nota">' + App.utils.escape(t.nota||'') + '</textarea></div>' +
    '<div class="row">' +
      '<div class="field"><span>Status atual</span>' + App.utils.statusPill(t.status) + '</div>' +
      '<div class="field"><span>Responsável</span><div style="margin-top:4px">' + respBadge + '</div></div>' +
    '</div>' +
    '<h4 style="margin:18px 0 10px;font-size:14px;font-weight:700">Histórico de Alterações</h4>' +
    '<table class="table"><thead><tr><th>Quando</th><th>Etapa</th><th>Status</th><th>Usuário</th></tr></thead><tbody>' +
      hist.map(h => '<tr><td>' + h.criado_em + '</td><td>' + App.utils.escape(h.etapa_nome) + '</td><td>' + (statusLabels[h.status_de]||'-') + ' → ' + statusLabels[h.status_para] + '</td><td>' + (h.usuario_nome ? App.utils.userBadge(h.usuario_nome, h.usuario_genero) : '-') + '</td></tr>').join('') +
    '</tbody></table>' +
    '<div class="actions">' +
      (podeExcluir ? '<button class="btn-danger" id="k-del">Excluir</button>' : '') +
      '<button data-close class="btn-ghost">Fechar</button><button class="btn-primary" id="k-save">Salvar Alterações</button></div>',
    (host) => {
      host.querySelector('#k-save').onclick = async () => {
        await App.tarefas.update({
          id: t.id, titulo: host.querySelector('#k-titulo').value,
          cliente: host.querySelector('#k-cliente').value, idioma: host.querySelector('#k-idioma').value,
          nota: host.querySelector('#k-nota').value, categoria_id: host.querySelector('#k-cat').value,
          etapa_id: host.querySelector('#k-etapa').value, prioridade: host.querySelector('#k-prio').value,
          prazo: host.querySelector('#k-prazo').value, atualizado_por: App.user.id
        });
        App.utils.toast('Tarefa salva'); await App.tarefasPage.load(); App.utils.closeModal();
      };
      const del = host.querySelector('#k-del');
      if (del) del.onclick = async () => {
        await App.tarefasPage.excluir(t.id); App.utils.closeModal();
      };
    }
  );
};

App.tarefasPage.excluir = async function (id) {
  if (!confirm('Excluir esta tarefa permanentemente?')) return;
  const r = await App.tarefas.delete(id, App.user.id);
  if (!r.ok) { App.utils.toast(r.msg, 'err'); return; }
  App.utils.toast('Tarefa excluida'); await App.tarefasPage.load();
};

App.tarefasPage.remanejar = async function (id) {
  const usuarios = await App.users.list();
  const ativos = usuarios.filter(u => u.ativo && u.cargo !== 'Admin');
  if (!ativos.length) return App.utils.toast('Nenhum funcionário ativo.', 'err');
  App.utils.modal(
    '<h3>Remanejar tarefa #' + id + '</h3>' +
    '<div class="field"><span>Novo responsável</span><select id="r-resp">' +
      ativos.map(u => '<option value="' + u.id + '">' + u.nome + ' (' + u.cargo + ')</option>').join('') +
    '</select></div>' +
    '<div class="actions"><button data-close class="btn-ghost">Cancelar</button>' +
    '<button class="btn-primary" id="r-ok">Remanejar</button></div>',
    (host) => {
      host.querySelector('#r-ok').onclick = async () => {
        const novoId = +host.querySelector('#r-resp').value;
        let r = await App.tarefas.remanejar(id, novoId, false);
        if (r.precisaConfirmar) {
          r = await App.tarefas.remanejar(id, novoId, true);
        }
        if (!r.ok) return App.utils.toast(r.msg || 'Erro ao remanejar', 'err');
        App.utils.toast(r.msg); App.utils.closeModal();
        await App.tarefasPage.load();
      };
    }
  );
};
