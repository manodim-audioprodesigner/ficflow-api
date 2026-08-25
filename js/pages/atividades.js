App.atividades = {};

App.atividades.render = async function (host) {
  if (!App.utils.canAdmin()) {
    host.innerHTML = '<div class="empty" style="text-align:center;padding:60px">Acesso restrito a administradores.</div>';
    return;
  }

  host.innerHTML = `
    <div class="page-header">
      <h2>Log de Atividades / Auditoria</h2>
      <div class="filters">
        <input type="date" id="filtro-inicio" class="input" />
        <input type="date" id="filtro-fim" class="input" />
        <select id="filtro-usuario" class="select"><option value="">Todos usuários</option></select>
        <select id="filtro-entidade" class="select"><option value="">Todas entidades</option>
          <option value="tarefas">Tarefas</option>
          <option value="usuarios">Usuários</option>
          <option value="categorias">Categorias</option>
          <option value="pipeline_etapas">Etapas</option>
        </select>
        <input type="number" id="filtro-entidade-id" class="input" placeholder="ID entidade" style="width:100px" />
        <button class btn-primary" id="btn-aplicar">Filtrar</button>
        <button class="btn-ghost" id="btn-limpar">Limpar</button>
      </div>
    </div>
    <div class="table-wrap" id="atividades-table"></div>
  `;

  const usuarios = await App.users.list();
  document.getElementById('filtro-usuario').innerHTML += usuarios
    .map(u => `<option value="${u.id}">${u.nome} (${u.cargo})</option>`).join('');

  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 30);
  document.getElementById('filtro-fim').value = fim.toISOString().split('T')[0];
  document.getElementById('filtro-inicio').value = inicio.toISOString().split('T')[0];

  async function load() {
    const filtros = {
      usuario_id: document.getElementById('filtro-usuario').value || null,
      entidade: document.getElementById('filtro-entidade').value || null,
      entidade_id: document.getElementById('filtro-entidade-id').value || null,
      inicio: document.getElementById('filtro-inicio').value || null,
      fim: document.getElementById('filtro-fim').value || null,
      limite: 500
    };

    const atividades = await App.atividades.list(filtros);
    renderTable(atividades);
  }

  function renderTable(atividades) {
    const acaoLabels = {
      'CRIAR_TAREFA': '➕ Criou tarefa',
      'ATUALIZAR_TAREFA': '✏️ Atualizou tarefa',
      'ALTERAR_STATUS': '🔄 Alterou status',
      'AVANCAR_ETAPA': '➡️ Avançou etapa',
      'EXCLUIR_TAREFA': '🗑️ Excluiu tarefa',
      'ARQUIVAR_TAREFA': '📦 Arquivou tarefa',
      'CRIAR_USUARIO': '👤 Criou usuário',
      'ATUALIZAR_USUARIO': '👤 Atualizou usuário',
      'CRIAR_CATEGORIA': '📁 Criou categoria',
      'ATUALIZAR_CATEGORIA': '📁 Atualizou categoria',
      'EXCLUIR_CATEGORIA': '📁 Excluiu categoria',
      'CRIAR_ETAPA': '📋 Criou etapa',
      'ATUALIZAR_ETAPA': '📋 Atualizou etapa',
      'EXCLUIR_ETAPA': '📋 Excluiu etapa'
    };

    const entidadeLabels = {
      'tarefas': '📝 Tarefa',
      'usuarios': '👤 Usuário',
      'categorias': '📁 Categoria',
      'pipeline_etapas': '📋 Etapa'
    };

    document.getElementById('atividades-table').innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Usuário</th>
            <th>Ação</th>
            <th>Entidade</th>
            <th>ID</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${atividades.map(a => `
            <tr>
              <td>${new Date(a.criado_em).toLocaleString('pt-BR')}</td>
              <td>${App.utils.escape(a.usuario_nome)}</td>
              <td><span class="acao-badge">${acaoLabels[a.acao] || a.acao}</span></td>
              <td>${entidadeLabels[a.entidade] || a.entidade}</td>
              <td class="num">${a.entidade_id || '-'}</td>
              <td>${App.utils.escape(a.detalhes || '')}</td>
            </tr>
          `).join('') || '<tr><td colspan="6" class="empty">Nenhuma atividade encontrada</td></tr>'}
        </tbody>
      </table>
    `;
  }

  document.getElementById('btn-aplicar').onclick = load;
  document.getElementById('btn-limpar').onclick = () => {
    document.getElementById('filtro-usuario').value = '';
    document.getElementById('filtro-entidade').value = '';
    document.getElementById('filtro-entidade-id').value = '';
    document.getElementById('filtro-inicio').value = inicio.toISOString().split('T')[0];
    document.getElementById('filtro-fim').value = fim.toISOString().split('T')[0];
    load();
  };

  await load();
};