App.produtividade = {};

App.produtividade.render = async function (host) {
  if (!App.utils.canAdmin()) {
    host.innerHTML = '<div class="empty" style="text-align:center;padding:60px">Acesso restrito a administradores.</div>';
    return;
  }

  host.innerHTML = `
    <div class="page-header">
      <h2>Produtividade da Equipe</h2>
      <div class="filters">
        <input type="date" id="filtro-inicio" class="input" />
        <input type="date" id="filtro-fim" class="input" />
        <select id="filtro-cargo" class="select">
          <option value="">Todos os cargos</option>
        </select>
        <button class="btn-primary" id="btn-aplicar-filtros">Aplicar</button>
        <button class="btn-ghost" id="btn-limpar-filtros">Limpar</button>
      </div>
    </div>
    <div class="stats-grid" id="prod-stats"></div>
    <div class="table-wrap" id="prod-table"></div>
    <div class="graph-card" style="margin-top:18px">
      <h3>Backup</h3>
      <div class="gc-sub">Exporta todos os dados (usuarios, tarefas, etapas, historico) em JSON. Importar substitui os dados atuais.</div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn-primary" id="bk-export">💾 Exportar backup</button>
        <button class="btn-warn" id="bk-import">📥 Importar backup</button>
      </div>
      <div id="bk-msg" style="font-size:12px;margin-top:10px;color:var(--txt-2)"></div>
    </div>
  `;

  const cargos = await App.cargos.list();
  document.getElementById('filtro-cargo').innerHTML += cargos
    .filter(c => c.nome !== 'Admin')
    .map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');

  // Set default date range (last 30 days)
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 30);
  document.getElementById('filtro-fim').value = fim.toISOString().split('T')[0];
  document.getElementById('filtro-inicio').value = inicio.toISOString().split('T')[0];

  async function load() {
    const cargo = document.getElementById('filtro-cargo').value || null;
    const inicio = document.getElementById('filtro-inicio').value || null;
    const fim = document.getElementById('filtro-fim').value || null;

    const data = await App.stats.produtividade(cargo, inicio, fim);
    renderStats(data);
    renderTable(data);
  }

  function renderStats(data) {
    const totalCriadas = data.criadas.reduce((s, u) => s + u.total, 0);
    const totalConcluidas = data.concluidas.reduce((s, u) => s + u.total, 0);
    const totalFazendo = data.fazendo.reduce((s, u) => s + u.total, 0);
    const totalTravadas = data.travadas.reduce((s, u) => s + u.total, 0);

    document.getElementById('prod-stats').innerHTML = [
      App.dashboard.card('Criadas no período', totalCriadas, 'total'),
      App.dashboard.card('Concluídas', totalConcluidas, 'green'),
      App.dashboard.card('Em andamento', totalFazendo, 'orange'),
      App.dashboard.card('Travadas', totalTravadas, 'red')
    ].join('');
  }

  function renderTable(data) {
    // Merge all user data
    const usersMap = new Map();
    
    [...data.criadas, ...data.concluidas, ...data.fazendo, ...data.travadas].forEach(u => {
      if (!usersMap.has(u.id)) {
        usersMap.set(u.id, {
          id: u.id,
          nome: u.nome,
          genero: u.genero || 'M',
          cargo: u.cargo_nome,
          cargo_cor: u.cargo_cor,
          criadas: 0,
          concluidas: 0,
          fazendo: 0,
          travadas: 0
        });
      }
      const user = usersMap.get(u.id);
      if (data.criadas.find(x => x.id === u.id)) user.criadas = data.criadas.find(x => x.id === u.id).total;
      if (data.concluidas.find(x => x.id === u.id)) user.concluidas = data.concluidas.find(x => x.id === u.id).total;
      if (data.fazendo.find(x => x.id === u.id)) user.fazendo = data.fazendo.find(x => x.id === u.id).total;
      if (data.travadas.find(x => x.id === u.id)) user.travadas = data.travadas.find(x => x.id === u.id).total;
    });

    const users = Array.from(usersMap.values()).sort((a, b) => b.concluidas - a.concluidas);

    document.getElementById('prod-table').innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Membro da Equipe</th>
            <th>Setor</th>
            <th class="num">Criadas</th>
            <th class="num">Concluídas</th>
            <th class="num">Fazendo</th>
            <th class="num">Travadas</th>
            <th class="num">Taxa Conclusão</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, idx) => {
            const taxa = u.criadas > 0 ? ((u.concluidas / u.criadas) * 100).toFixed(1) : 0;
            const rankBadge = idx === 0 ? '🥇 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : ''));
            const userBadge = App.utils.userBadge(u.nome, u.genero);
            return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:700;color:var(--muted);width:20px">${rankBadge || '#' + (idx+1)}</span>
                    ${App.utils.userAvatar(u.nome, u.genero)}
                    ${userBadge}
                  </div>
                </td>
                <td><span class="u-cargo" style="background:${u.cargo_cor}22;color:${u.cargo_cor};border:1px solid ${u.cargo_cor}44">${App.utils.escape(u.cargo)}</span></td>
                <td class="num" style="font-weight:600">${u.criadas}</td>
                <td class="num" style="color:var(--green);font-weight:700">${u.concluidas}</td>
                <td class="num" style="color:var(--orange);font-weight:700">${u.fazendo}</td>
                <td class="num" style="color:var(--red);font-weight:700">${u.travadas}</td>
                <td class="num" style="font-weight:700">${taxa}%</td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="7" class="empty">Nenhum dado no período</td></tr>'}
        </tbody>
      </table>
    `;
  }

  document.getElementById('btn-aplicar-filtros').onclick = load;
  document.getElementById('btn-limpar-filtros').onclick = () => {
    document.getElementById('filtro-cargo').value = '';
    document.getElementById('filtro-inicio').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtro-fim').value = fim.toISOString().split('T')[0];
    load();
  };

  // Backup
  const bkMsg = document.getElementById('bk-msg');
  document.getElementById('bk-export').onclick = async () => {
    const r = await App.backup.exportar();
    if (r.ok) { bkMsg.style.color = 'var(--green)'; bkMsg.textContent = 'Backup salvo em: ' + r.path; }
    else { bkMsg.style.color = 'var(--red)'; bkMsg.textContent = 'Exportação cancelada.'; }
  };
  document.getElementById('bk-import').onclick = async () => {
    if (!confirm('Importar backup SUBSTITUI todos os dados atuais (tarefas, usuários, etapas). Continuar?')) return;
    const r = await App.backup.importar();
    if (r.ok) { bkMsg.style.color = 'var(--green)'; bkMsg.textContent = r.msg; }
    else { bkMsg.style.color = 'var(--red)'; bkMsg.textContent = r.msg || 'Importação cancelada.'; }
  };

  await load();
};