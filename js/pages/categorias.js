App.categoriasPage = {};
App.categoriasPage._api = App.categorias;

App.categoriasPage.render = async function (host) {
  const lista = await App.categorias.list();
  host.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3>Categorias</h3><button class="btn-primary" id="cat-new">+ Nova</button></div>' +
    '<table class="table"><thead><tr><th>ID</th><th>Nome</th><th>Cor</th><th></th></tr></thead><tbody>' +
      lista.map(c => '<tr><td>#' + c.id + '</td><td>' + App.utils.escape(c.nome) + '</td><td><span class="eb-dot" style="background:' + c.cor + '"></span> ' + c.cor + '</td><td><button class="btn-ghost" data-edit="' + c.id + '" data-nome="' + encodeURIComponent(c.nome) + '" data-cor="' + c.cor + '">Editar</button> <button class="btn-danger" data-del="' + c.id + '">Excluir</button></td></tr>').join('') +
    '</tbody></table>';
  document.getElementById('cat-new').onclick = () => App.categoriasPage.form();
  host.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => App.categoriasPage.form(+b.dataset.edit, decodeURIComponent(b.dataset.nome), b.dataset.cor));
  host.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const r = await App.categorias.delete({ id: +b.dataset.del, deletado_por: App.user.id });
    if (!r.ok) return App.utils.toast(r.msg, 'err');
    App.utils.toast('Excluida'); await App.ui.render();
  });
};

App.categoriasPage.form = function (id, nome, cor) {
  App.utils.modal(
    '<h3>' + (id ? 'Editar categoria' : 'Nova categoria') + '</h3>' +
    '<div class="field"><span>Nome</span><input id="c-nome" value="' + App.utils.escape(nome||'') + '"></div>' +
    '<div class="field"><span>Cor</span><div class="swatches" id="c-sw"></div><input id="c-cor" value="' + (cor||'#7c5cff') + '" style="margin-top:8px"></div>' +
    '<div class="actions"><button data-close class="btn-ghost">Cancelar</button><button class="btn-primary" id="c-ok">Salvar</button></div>',
    (host) => {
      const cores = ['#7c5cff','#2ec4f1','#ff5c8a','#ffd460','#3ddc84','#ffb020','#ff4d6d','#8b5cf6','#ff7a59','#00c2a8'];
      host.querySelector('#c-sw').innerHTML = cores.map(c => '<div class="sw ' + (c===cor?'sel':'') + '" data-c="' + c + '" style="background:' + c + '"></div>').join('');
      host.querySelectorAll('.sw').forEach(s => s.onclick = () => {
        host.querySelectorAll('.sw').forEach(x => x.classList.remove('sel'));
        s.classList.add('sel'); host.querySelector('#c-cor').value = s.dataset.c;
      });
      host.querySelector('#c-ok').onclick = async () => {
        const n = host.querySelector('#c-nome').value.trim(), c = host.querySelector('#c-cor').value;
        if (!n) return App.utils.toast('Informe o nome', 'err');
        if (id) await App.categorias.update({ id, nome: n, cor: c, atualizado_por: App.user.id });
        else await App.categorias.create({ nome: n, cor: c, criado_por: App.user.id });
        App.utils.toast('Salvo'); App.utils.closeModal(); await App.ui.render();
      };
    }
  );
};

