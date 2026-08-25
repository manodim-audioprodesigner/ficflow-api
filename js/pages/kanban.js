App.kanban = {};

App.kanban.render = async function (host) {
  host.innerHTML = '<div class="filters" id="kanban-filters"></div><div class="kanban" id="kanban"></div>';
  await App.kanban.rerenderFilters();
  await App.kanban.rerenderBoard();
};

App.kanban.rerenderFilters = async function () {
  const [etapas, categorias, cargos] = await Promise.all([App.etapas.list(), App.categorias.list(), App.cargos.list()]);
  App.state.cache.etapas = etapas; App.state.cache.categorias = categorias; App.state.cache.cargos = cargos;
  const f = document.getElementById('kanban-filters');
  const cargoSel = App.utils.canAdmin()
    ? '<select id="f-cargo"><option value="">Todos setores</option>' + cargos.map(c => '<option value="' + c.nome + '">' + c.nome + '</option>').join('') + '</select>'
    : '';
  f.innerHTML =
    '<select id="f-etapa"><option value="">Todas etapas</option>' + etapas.map(e => '<option value="' + e.id + '">' + e.nome + '</option>').join('') + '</select>' +
    '<select id="f-cat"><option value="">Todas categorias</option>' + categorias.map(c => '<option value="' + c.id + '">' + c.nome + '</option>').join('') + '</select>' +
    cargoSel;
  ['f-etapa','f-cat','f-cargo'].forEach(id => { const el = document.getElementById(id); if (el) el.onchange = App.kanban.rerenderBoard; });
};

App.kanban.rerenderBoard = async function () {
  const etapa = document.getElementById('f-etapa')?.value;
  const catId = document.getElementById('f-cat')?.value;
  let cargo = App.utils.canAdmin() ? (document.getElementById('f-cargo')?.value || '') : App.user.cargo;
  const busca = document.getElementById('search-global').value;
  const tarefas = await App.tarefas.list({ etapa_id: etapa, categoria_id: catId, cargo: cargo || 'Admin', busca });
  const cols = [
    { s:0, nome:'Travado',  cls:'red'    },
    { s:1, nome:'Fazendo',  cls:'orange' },
    { s:2, nome:'Pronto',   cls:'green'  }
  ];
  document.getElementById('kanban').innerHTML = cols.map(col => {
    const items = tarefas.filter(t => t.status === col.s);
    return '<div class="kcol ' + col.cls + '">' +
      '<div class="kcol-header"><div class="k-title"><span class="k-dot"></span>' + col.nome + '</div><div class="k-count">' + items.length + '</div></div>' +
      '<div class="kcol-body" data-status="' + col.s + '">' + items.map(App.kanban.card).join('') + '</div></div>';
  }).join('');
  App.kanban.bind();
};

App.kanban.card = function (t) {
  const cls = STATUS_CLASS[t.status];
  const podeExcluir = App.utils.canAdmin() || t.criado_por === App.user.id;
  return '<div class="card ' + cls + '" draggable="true" data-id="' + t.id + '">' +
    '<div class="c-title" data-open="' + t.id + '">' + App.utils.escape(t.titulo) + '</div>' +
    (t.nota ? '<div class="c-nota" data-open="' + t.id + '" title="' + App.utils.escape(t.nota) + '">' + App.utils.escape(t.nota) + '</div>' : '') +
    '<div class="c-meta">' +
      (t.cliente ? '<span class="tag">' + App.utils.escape(t.cliente) + '</span>' : '') +
      (t.idioma ? '<span class="tag">' + App.utils.escape(t.idioma) + '</span>' : '') +
      (t.categoria_nome ? '<span class="tag" style="background:' + (t.categoria_cor||'#444') + '33">' + App.utils.escape(t.categoria_nome) + '</span>' : '') +
      '<span class="tag">' + App.utils.escape(t.etapa_nome) + '</span>' +
      (t.responsavel_nome ? '<span class="tag tag-user" title="Quem esta fazendo">👤 ' + App.utils.escape(t.responsavel_nome) + '</span>' : '') +
    '</div>' +
    '<div class="c-actions">' +
      '<button data-set="' + t.id + '" data-st="0">Travado</button>' +
      '<button data-set="' + t.id + '" data-st="1">Fazendo</button>' +
      '<button data-set="' + t.id + '" data-st="2">Pronto</button>' +
      '<button data-adv="' + t.id + '">➡</button>' +
      (podeExcluir ? '<button class="btn-danger" data-del="' + t.id + '">✕</button>' : '') +
    '</div></div>';
};

App.kanban.bind = function () {
  document.querySelectorAll('.card').forEach(c => {
    c.addEventListener('dragstart', () => { c.classList.add('dragging'); App.kanban._drag = c.dataset.id; });
    c.addEventListener('dragend', () => { c.classList.remove('dragging'); App.kanban._drag = null; });
    c.querySelectorAll('[data-open]').forEach(el => el.onclick = () => App.kanban.open(+c.dataset.id));
    c.querySelectorAll('[data-set]').forEach(b => b.onclick = () => App.kanban.setStatus(+b.dataset.st, +b.dataset.set));
    c.querySelector('[data-adv]').onclick = () => App.kanban.advance(+c.dataset.id);
    const del = c.querySelector('[data-del]');
    if (del) del.onclick = () => App.kanban.excluir(+c.dataset.id);
  });
  document.querySelectorAll('.kcol-body').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault(); col.classList.remove('drag-over');
      if (App.kanban._drag) await App.kanban.setStatus(+col.dataset.status, +App.kanban._drag);
    });
  });
};

App.kanban.setStatus = async function (status, id) {
  await App.tarefas.setStatus(id, status, App.user.id, 'Kanban');
  App.utils.toast('Status atualizado'); await App.kanban.rerenderBoard();
};

App.kanban.advance = async function (id) {
  const r = await App.tarefas.avancarEtapa(id, App.user.id);
  if (!r.ok) { App.utils.toast(r.msg, 'err'); return; }
  App.utils.toast('Etapa avancada'); await App.kanban.rerenderBoard();
};

App.kanban.excluir = async function (id) {
  if (!confirm('Excluir esta tarefa permanentemente?')) return;
  const r = await App.tarefas.delete(id, App.user.id);
  if (!r.ok) { App.utils.toast(r.msg, 'err'); return; }
  App.utils.toast('Tarefa excluida'); await App.kanban.rerenderBoard();
};

App.kanban.open = async function (id) {
  const [t, hist] = await Promise.all([App.tarefas.get(id), App.tarefas.historico(id)]);
  const etapas = App.state.cache.etapas, categorias = App.state.cache.categorias;
  const podeExcluir = App.utils.canAdmin() || t.criado_por === App.user.id;
  const card_row = (id_) => '<button data-set="' + t.id + '" data-st="' + id_ + '">' + STATUS[id_] + '</button>';
  App.utils.modal(
    '<h3>' + App.utils.escape(t.titulo) + '</h3>' +
    (t.nota ? '<div class="nota-box"><b>Nota:</b> ' + App.utils.escape(t.nota) + '</div>' : '') +
    '<div class="field"><span>Titulo</span><input id="k-titulo" value="' + App.utils.escape(t.titulo) + '"></div>' +
    '<div class="row"><div class="field"><span>Cliente</span><input id="k-cliente" value="' + App.utils.escape(t.cliente||'') + '"></div>' +
    '<div class="field"><span>Idioma</span><input id="k-idioma" value="' + App.utils.escape(t.idioma||'') + '"></div></div>' +
    '<div class="row"><div class="field"><span>Etapa</span><select id="k-etapa">' + etapas.map(e => '<option value="' + e.id + '" ' + (e.id===t.etapa_id?'selected':'') + '>' + e.nome + '</option>').join('') + '</select></div>' +
    '<div class="field"><span>Categoria</span><select id="k-cat"><option value="">--</option>' + categorias.map(c => '<option value="' + c.id + '" ' + (c.id===t.categoria_id?'selected':'') + '>' + c.nome + '</option>').join('') + '</select></div></div>' +
    '<div class="row"><div class="field"><span>Prioridade</span><select id="k-prio"><option value="0" '+(t.prioridade===0?'selected':'')+'>Baixa</option><option value="1" '+(t.prioridade===1?'selected':'')+'>Media</option><option value="2" '+(t.prioridade===2?'selected':'')+'>Alta</option></select></div>' +
    '<div class="field"><span>Prazo</span><input type="date" id="k-prazo" value="' + (t.prazo||'') + '"></div></div>' +
    '<div class="field"><span>Nota</span><textarea id="k-nota">' + App.utils.escape(t.nota||'') + '</textarea></div>' +
    '<div class="field"><span>Status atual</span>' + App.utils.statusPill(t.status) + ' ' + card_row(0) + card_row(1) + card_row(2) + '</div>' +
    (t.responsavel_nome ? '<div class="field"><span>Quem esta fazendo</span><div>' + App.utils.escape(t.responsavel_nome) + '</div></div>' : '') +
    '<h4 style="margin:16px 0 10px">Historico</h4><table class="table"><thead><tr><th>Quando</th><th>Etapa</th><th>Status</th><th>Usuario</th></tr></thead><tbody>' +
      hist.map(h => '<tr><td>' + h.criado_em + '</td><td>' + App.utils.escape(h.etapa_nome) + '</td><td>' + (STATUS[h.status_de]||'-') + ' -> ' + STATUS[h.status_para] + '</td><td>' + App.utils.escape(h.usuario_nome||'-') + '</td></tr>').join('') +
    '</tbody></table>' +
    '<div class="actions">' +
      (podeExcluir ? '<button class="btn-danger" id="k-del">Excluir</button>' : '<button class="btn-ghost" id="k-arc">Arquivar</button>') +
      '<button data-close class="btn-ghost">Fechar</button><button class="btn-primary" id="k-save">Salvar</button></div>',
    (host) => {
      host.querySelectorAll('[data-set]').forEach(b => b.onclick = async () => {
        await App.tarefas.setStatus(t.id, +b.dataset.st, App.user.id, 'Modal');
        App.utils.toast('Status atualizado'); await App.kanban.rerenderBoard(); App.utils.closeModal();
      });
      host.querySelector('#k-save').onclick = async () => {
        await App.tarefas.update({
          id: t.id, titulo: host.querySelector('#k-titulo').value,
          cliente: host.querySelector('#k-cliente').value, idioma: host.querySelector('#k-idioma').value,
          nota: host.querySelector('#k-nota').value, categoria_id: host.querySelector('#k-cat').value,
          etapa_id: host.querySelector('#k-etapa').value, prioridade: host.querySelector('#k-prio').value,
          prazo: host.querySelector('#k-prazo').value, atualizado_por: App.user.id
        });
        App.utils.toast('Tarefa salva'); await App.kanban.rerenderBoard(); App.utils.closeModal();
      };
      const del = host.querySelector('#k-del');
      if (del) del.onclick = async () => {
        await App.kanban.excluir(t.id); App.utils.closeModal();
      };
      const arc = host.querySelector('#k-arc');
      if (arc) arc.onclick = async () => {
        await App.tarefas.archive(t.id, App.user.id); App.utils.toast('Arquivada'); await App.kanban.rerenderBoard(); App.utils.closeModal();
      };
    }
  );
};
