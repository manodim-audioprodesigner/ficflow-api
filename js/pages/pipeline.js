App.pipeline = {};

App.pipeline.render = async function (host) {
  const etapas = await App.etapas.list();
  const tarefas = await App.tarefas.list({ cargo: App.user.cargo });
  host.innerHTML =
    '<h3 style="margin-bottom:14px">Fluxo de producao</h3>' +
    '<p style="color:var(--txt-2);font-size:13px;margin-bottom:18px">Arraste uma tarefa para proxima etapa => ela volta para <b>Travado</b> automaticamente.</p>' +
    '<div class="pipeline-grid" id="pl-grid">' + etapas.map(e => {
      const ts = tarefas.filter(t => t.etapa_id === e.id);
      const pronto = ts.filter(t => t.status === 2).length;
      const total = ts.length;
      const pct = total ? Math.round(pronto / total * 100) : 0;
      return '<div class="pipe-step">' +
        '<div class="ps-order">#' + e.ordem + '</div>' +
        '<div class="ps-name"><span class="eb-dot" style="background:' + (e.cor || '#666') + '"></span>' + App.utils.escape(e.nome) + '</div>' +
        (e.cargo_nome ? '<div class="ps-cargo" style="background:' + (e.cargo_cor||'#444') + '22;color:' + (e.cargo_cor||'#fff') + '">' + App.utils.escape(e.cargo_nome) + '</div>' : '') +
        (e.categoria ? '<div style="font-size:11px;color:var(--muted);margin-top:6px">Categoria: ' + App.utils.escape(e.categoria) + '</div>' : '') +
        '<div style="margin-top:10px;font-size:12px;color:var(--txt-2)">' + pronto + '/' + total + ' prontas (' + pct + '%)</div>' +
        '<div class="eb-progress" style="margin-top:6px"><div class="seg green" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('') + '</div>' +
    '<h3 style="margin:24px 0 14px">Por setor</h3>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">' + App.pipeline.byCargo(etapas) + '</div>';
};

App.pipeline.byCargo = function (etapas) {
  const byCargo = {};
  etapas.forEach(e => { const c = e.cargo_nome || 'Geral'; (byCargo[c] = byCargo[c] || []).push(e); });
  return Object.entries(byCargo).map(([cargo, items]) => {
    const corCargo = items[0].cargo_cor || '#888';
    return '<div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span class="eb-dot" style="background:' + corCargo + '"></span><b>' + App.utils.escape(cargo) + '</b></div>' +
      items.map(e => '<div style="padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">' + App.utils.escape(e.nome) + ' <span style="color:var(--muted);float:right">#' + e.ordem + '</span></div>').join('') +
    '</div>';
  }).join('');
};
