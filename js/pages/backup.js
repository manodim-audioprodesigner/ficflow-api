// FIC FLOW - BACKUP, GESTÃO DE DADOS & REDE MULTI-MÁQUINAS
window.App = window.App || {};

App.backupPage = {
  render: async function (host) {
    const cfg = (App.config && App.config.get) ? await App.config.get() : {};
    const currentDbDir = cfg.dbDir || 'Padrão local (AppData)';

    host.innerHTML = `
      <div style="margin-bottom:18px">
        <h2 style="font-size:22px;font-weight:800;margin:0">🌐 Configurações de Rede & Gestão de Dados</h2>
        <div style="font-size:12px;color:var(--txt-2);margin-top:2px">
          Conecte múltiplas máquinas na mesma base de dados central e gerencie backups do sistema
        </div>
      </div>

      <!-- CONFIGURAÇÃO DE REDE MULTI-MÁQUINAS -->
      <div class="card" style="margin-bottom:16px;border-left:5px solid var(--pri)">
        <h3 style="margin-top:0;font-size:16px">🌐 Conexão de Banco em Rede (Multi-Máquinas)</h3>
        <p style="color:var(--txt-2);font-size:13px">
          Para que <b>10 ou mais computadores</b> trabalhem juntos no mesmo fluxo e chat em tempo real, todos devem apontar para a mesma pasta compartilhada na rede (ex: <code>\\\\192.168.1.50\\ficflow</code> ou <code>\\\\SERVIDOR\\ficflow</code>).
        </p>
        <div class="field" style="margin-top:12px">
          <span>Pasta do Banco de Dados Atual:</span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="text" id="cfg-db-dir" value="${App.utils.escape(cfg.dbDir || '')}" placeholder="Ex: \\\\192.168.1.50\\ficflow (ou deixe vazio para banco local)" style="flex:1;min-width:280px">
            <button class="btn" id="cfg-btn-pick-dir">📁 Procurar Pasta</button>
            <button class="btn-primary" id="cfg-btn-save-dir">💾 Salvar Conexão</button>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">
            Status: <b style="color:var(--pri-2)">${App.utils.escape(currentDbDir)}</b> (Reinicie o app após salvar para conectar à nova pasta).
          </div>
        </div>
      </div>

      <!-- BACKUP & EXPORTAÇÃO -->
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-top:0;font-size:16px">📦 Exportação / Importação de Backup</h3>
        <p style="color:var(--txt-2);font-size:13px">
          Gere uma cópia completa de segurança em formato JSON contendo todos os programas, usuários, etapas, configurações e logs de auditoria.
        </p>
        <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
          <button class="btn-primary" id="bk-btn-exportar">Exportar Backup (.json)</button>
          <button class="btn" id="bk-btn-importar">Importar Backup (.json)</button>
        </div>
      </div>

      <!-- RESET DE SIMULAÇÃO -->
      <div class="card" style="border:1px solid var(--red)">
        <h3 style="margin-top:0;font-size:16px;color:var(--red)">⚠️ Limpeza de Testes</h3>
        <p style="color:var(--txt-2);font-size:13px">
          Limpa todas as tarefas, programas e histórico de testes, mantendo a estrutura de usuários e setores intacta.
        </p>
        <div style="margin-top:14px">
          <button class="btn-danger" id="bk-btn-reset">⚠️ Limpar Testes</button>
        </div>
      </div>
    `;

    // Handlers de Rede
    document.getElementById('cfg-btn-pick-dir').onclick = async () => {
      if (App.config && App.config.pickDir) {
        const res = await App.config.pickDir();
        if (res && res.ok && res.dir) {
          document.getElementById('cfg-db-dir').value = res.dir;
        }
      }
    };

    document.getElementById('cfg-btn-save-dir').onclick = async () => {
      const dir = document.getElementById('cfg-db-dir').value.trim();
      if (App.config && App.config.setDbDir) {
        const res = await App.config.setDbDir(dir);
        if (res && res.ok) {
          App.utils.toast(res.msg || 'Caminho do banco salvo com sucesso! Reinicie o aplicativo.');
        } else {
          App.utils.toast(res?.msg || 'Erro ao salvar caminho.', 'err');
        }
      }
    };

    // Handlers de Backup
    document.getElementById('bk-btn-exportar').onclick = async () => {
      const res = await App.backup.exportar();
      if (res && res.ok) App.utils.toast('Backup exportado com sucesso!');
    };

    document.getElementById('bk-btn-importar').onclick = async () => {
      const res = await App.backup.importar();
      if (res && res.ok) {
        App.utils.toast('Backup importado com sucesso!');
        App.ui.render();
      } else if (res && res.msg) {
        App.utils.toast(res.msg, 'err');
      }
    };

    document.getElementById('bk-btn-reset').onclick = async () => {
      if (!confirm('Tem certeza de que deseja apagar todas as tarefas e programas de teste?')) return;
      const res = await App.backup.reset();
      if (res && res.ok) {
        App.utils.toast('Testes limpos com sucesso!');
        App.ui.setPage('dashboard');
      }
    };
  }
};
