App.etapasPage = {};

App.etapasPage.render = async function (host) {
  const [lista, cargos] = await Promise.all([App.etapas.list(), App.cargos.list()]);
  host.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3>Etapas do pipeline</h3><button class="btn-primary" id="et-new">+ Nova etapa</button></div>' +
    '<table class="table"><thead><tr><th>Ordem</th><th>Codigo</th><th>Nome</th><th>Setor</th><th>Categoria</th><th>Cor</th><th></th></tr></thead><tbody>' +
      lista.sort((a,b)=>a.ordem-b.ordem).map(e => '<tr><td>#' + e.ordem + '</td><td>' + App.utils.escape(e.codigo) + '</td><td>' + App.utils.escape(e.nome) + '</td><td>' + App.utils.escape(e.cargo_nome||'-') + '</td><td>' + App.utils.escape(e.categoria||'-') + '</td><td><span class="eb-dot" style="background:' + e.cor + '"></span> ' + e.cor + '</td><td><button class="btn-ghost" data-edit="' + e.id + '">Editar</button> <button class="btn-danger" data-del="' + e.id + '">Excluir</button></td></tr>').join('') +
    '</tbody></table>';
  document.getElementById('et-new').onclick = () => App.etapasPage.form(cargos);
  host.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => App.etapasPage.form(cargos, +b.dataset.edit, lista.find(e => e.id === +b.dataset.edit)));
host.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const r = await App.etapas.delete({ id: +b.dataset.del, deletado_por: App.user.id });
    if (!r.ok) return App.utils.toast(r.msg, 'err');
    App.utils.toast('Excluida'); await App.ui.render();
  });
};

App.etapasPage.form = function (cargos, id, e) {
  App.utils.modal(
    '<h3>' + (id ? 'Editar etapa' : 'Nova etapa') + '</h3>' +
    '<div class="row"><div class="field"><span>Codigo</span><input id="e-cod" value="' + App.utils.escape(e?.codigo||'') + '"></div>' +
    '<div class="field"><span>Ordem</span><input type="number" id="e-ord" value="' + (e?.ordem||'') + '"></div></div>' +
    '<div class="field"><span>Nome</span><input id="e-nome" value="' + App.utils.escape(e?.nome||'') + '"></div>' +
    '<div class="row"><div class="field"><span>Setor (cargo)</span><select id="e-cargo"><option value="">-- Geral --</option>' + cargos.map(c => '<option value="' + c.id + '" ' + (e && e.cargo_id===c.id?'selected':'') + '>' + c.nome + '</option>').join('') + '</select></div>' +
    '<div class="field"><span>Categoria</span><input id="e-cat" value="' + App.utils.escape(e?.categoria||'') + '"></div></div>' +
    '<div class="field"><span>Cor</span><div class="swatches" id="e-sw"></div><input id="e-cor" value="' + (e?.cor||'#7c5cff') + '" style="margin-top:8px"></div>' +
    '<div class="actions"><button data-close class="btn-ghost">Cancelar</button><button class="btn-primary" id="e-ok">Salvar</button></div>',
    (host) => {
      const cores = ['#7c5cff','#2ec4f1','#ff5c8a','#ffd460','#3ddc84','#ffb020','#ff4d6d','#8b5cf6','#ff7a59','#00c2a8','#6a8dff'];
      host.querySelector('#e-sw').innerHTML = cores.map(c => '<div class="sw ' + (c===(e?.cor)?'sel':'') + '" data-c="' + c + '" style="background:' + c + '"></div>').join('');
      host.querySelectorAll('.sw').forEach(s => s.onclick = () => { host.querySelectorAll('.sw').forEach(x => x.classList.remove('sel')); s.classList.add('sel'); host.querySelector('#e-cor').value = s.dataset.c; });
host.querySelector('#e-ok').onclick = async () => {
        const p = { codigo: host.querySelector('#e-cod').value, nome: host.querySelector('#e-nome').value, ordem: +host.querySelector('#e-ord').value, cargo_id: host.querySelector('#e-cargo').value || null, categoria: host.querySelector('#e-cat').value, cor: host.querySelector('#e-cor').value };
        if (!p.codigo || !p.nome || !p.ordem) return App.utils.toast('Codigo, nome e ordem obrigatorios', 'err');
        if (id) { await App.etapas.update({ id, ...p, atualizado_por: App.user.id }); } else { await App.etapas.create({ ...p, criado_por: App.user.id }); }
        App.utils.toast('Salvo'); App.utils.closeModal(); await App.ui.render();
      };
    }
  );
};

