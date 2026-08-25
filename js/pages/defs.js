App.defs = {};

App.defs.render = async function (host) {
  const [cfg, lic] = await Promise.all([App.config.get(), App.licenca.status()]);
  const dias = lic.dias;
  const planoTxt = ({ trial: 'Trial (90 dias)', anual: 'Anual (1 ano)', quinquenal: 'Quinquenal (5 anos)', desenvolvimento: 'Desenvolvimento' })[lic.plano] || lic.plano;
  host.innerHTML =
    '<h3 style="margin-bottom:6px">Definicoes</h3>' +
    '<div style="color:var(--txt-2);font-size:13px;margin-bottom:24px">Configuracoes do FIC FLOW para esta maquina.</div>' +

    '<div class="graph-card" style="margin-bottom:18px">' +
      '<h3>Pasta do banco compartilhado (Rede / SMB / NAS)</h3>' +
      '<div class="gc-sub">Indique uma pasta de rede acessivel por todos os PCs. <b>Exemplos:</b></div>' +
      '<div style="font-size:12px;color:var(--txt-2);margin:8px 0;padding:10px;background:var(--bg-2);border-radius:8px;font-family:monospace">' +
        'Windows (SMB): <code>\\\\SERVIDOR\\ficflow</code> ou <code>Z:\\ficflow</code><br>' +
        'Linux/Mac (Samba/NFS): <code>/mnt/ficflow</code> ou <code>~/ficflow</code>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:14px;align-items:center">' +
        '<input id="cfg-dbDir" value="' + App.utils.escape(cfg.dbDir || '') + '" placeholder="\\\\SERVER\\ficflow  (ou vazio = local)" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg-2);color:var(--txt)">' +
        '<button class="btn-ghost" id="cfg-pick">Procurar...</button>' +
        '<button class="btn-primary" id="cfg-save">Salvar</button>' +
        '<button class="btn-ghost" id="cfg-discover" style="margin-left:auto">Descobrir Rede</button>' +
      '</div>' +
      '<div id="network-results" style="margin-top:10px;font-size:12px;color:var(--txt-2);display:none"></div>' +
      '<div id="cfg-msg" style="font-size:12px;color:var(--txt-2);margin-top:10px"></div>' +
      '<p style="font-size:11px;color:var(--muted);margin-top:14px">Apos salvar, <b>reinicie o app</b> para conectar ao banco compartilhado. O arquivo <code>ficflow.db</code> sera criado automaticamente na pasta.</p>' +
      '<details style="margin-top:18px;font-size:12px;color:var(--txt-2)">' +
        '<summary style="cursor:pointer">Como configurar rede (SMB/NAS)</summary>' +
        '<ul style="margin-top:10px;line-height:1.8;padding-left:20px">' +
          '<li>No servidor/NAS: crie uma pasta compartilhada (ex: <code>ficflow</code>) com permissao de leitura/escrita para todos os usuarios do app</li>' +
          '<li>No Windows: mapeie a unidade de rede (Botao direito em "Este PC" > "Mapear unidade de rede") ou use o caminho UNC direto (<code>\\\\IP\\pasta</code>)</li>' +
          '<li>No FIC FLOW: em Definicoes, clique "Procurar..." e selecione a pasta mapeada, ou digite o caminho UNC</li>' +
          '<li>Clique "Salvar" e reinicie o app em <b>todas as maquinas</b></li>' +
          '<li><b>Importante:</b> O SQLite em rede (SMB) funciona bem para poucos usuarios simultaneos (~5-10). Para mais usuarios, recomenda-se migrar para PostgreSQL/MySQL via API.</li>' +
        '</ul>' +
      '</details>' +
    '</div>' +

    '<div class="graph-card">' +
      '<h3>Licenca</h3>' +
      '<div class="gc-sub">Status da sua licenca FIC FLOW.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">' +
        '<div><span style="color:var(--txt-2);font-size:12px">Plano</span><div style="font-weight:600;font-size:16px;color:var(--pri-2)">' + App.utils.escape(planoTxt) + '</div></div>' +
        '<div><span style="color:var(--txt-2);font-size:12px">Expira em</span><div style="font-weight:600;font-size:16px">' + lic.expira + '</div></div>' +
        '<div><span style="color:var(--txt-2);font-size:12px">Dias restantes</span><div style="font-weight:600;font-size:16px;color:' + (dias < 0 ? 'var(--red)' : dias < 15 ? 'var(--orange)' : 'var(--green)') + '">' + dias + '</div></div>' +
        '<div><span style="color:var(--txt-2);font-size:12px">Status</span><div style="font-weight:600;font-size:16px;color:' + (lic.expirada ? 'var(--red)' : 'var(--green)') + '">' + (lic.expirada ? 'EXPIRADA' : 'ATIVA') + '</div></div>' +
      '</div>' +
      '<p style="font-size:12px;color:var(--muted);margin-top:18px">Desenvolvedor: <b style="color:var(--pri-2)">MD SISTEM</b> - Contate para renovacao.</p>' +
    '</div>';

  const input = document.getElementById('cfg-dbDir');
  document.getElementById('cfg-pick').onclick = async () => {
    const r = await App.config.pickDir();
    if (r.ok) input.value = r.dir;
  };
  document.getElementById('cfg-save').onclick = async () => {
    const r = await App.config.setDbDir(input.value.trim());
    const m = document.getElementById('cfg-msg');
    if (r.ok) { m.style.color = 'var(--green)'; m.textContent = 'Salvo. ' + r.msg; }
    else { m.style.color = 'var(--red)'; m.textContent = 'Erro ao salvar.'; }
  };
  document.getElementById('cfg-discover').onclick = async () => {
    const btn = document.getElementById('cfg-discover');
    const resultsDiv = document.getElementById('network-results');
    btn.disabled = true;
    btn.textContent = 'Procurando...';
    resultsDiv.style.display = 'block';
    resultsDiv.textContent = 'Escaneando rede local...';
    try {
      const res = await App.network.discover();
      if (!res.ok) {
        resultsDiv.innerHTML = '<span style="color:var(--red)">' + res.msg + '</span>';
        return;
      }
      if (!res.hosts || !res.hosts.length) {
        resultsDiv.innerHTML = 'Nenhum host ativo encontrado na rede ' + res.subnet + '.x';
        return;
      }
      resultsDiv.innerHTML = '<b>Hosts ativos (' + res.hosts.length + '):</b><br>' +
        res.hosts.map(h => '<code>' + h.ip + '</code> ' + (h.hostname !== h.ip ? '(' + h.hostname + ')' : '')).join('<br>');
    } catch (e) {
      resultsDiv.innerHTML = '<span style="color:var(--red)">Erro: ' + e.message + '</span>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Descobrir Rede';
    }
  };
};