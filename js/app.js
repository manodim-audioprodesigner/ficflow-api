(function () {
  const viewLogin = document.getElementById('view-login');
  const viewApp = document.getElementById('view-app');

  // === CHECK LICENCA no arranque ===
  (async function checkLicenca() {
    try {
      const lic = await App.licenca.status();
      if (lic.expirada) {
        document.getElementById('lic-plano').textContent = lic.plano || '--';
        document.getElementById('lic-data').textContent = lic.expira || '--';
        document.body.dataset.view = 'licenca';
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-licenca').classList.add('active');
        document.getElementById('view-licenca').style.display = 'flex';
        document.getElementById('view-login').style.display = 'none';
      }
    } catch (e) { console.error('check licenca falhou:', e); }
  })();

  // === INICIALIZAÇÃO DE TEMA E CORES ===
  if (App.theme && App.theme.init) {
    App.theme.init();
  }

  // === SETUP DE CONTROLES DO TOPBAR ===
  if (App.ui && App.ui.setupTopbarControls) {
    App.ui.setupTopbarControls();
  }

  // LOGIN
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('login-usuario').value.trim();
    const pin = document.getElementById('login-pin').value;
    const err = document.getElementById('login-error');
    err.textContent = '';
    let r;
    try {
      r = await App.auth.login(usuario, pin);
    } catch (ex) {
      console.error('[login] erro capturado:', ex);
      err.textContent = 'Erro interno: ' + (ex && ex.message ? ex.message : ex);
      return;
    }
    if (!r.ok) { err.textContent = r.msg; return; }
    App.user = r.user;
    document.body.dataset.view = 'app';
    viewLogin.classList.remove('active');
    viewApp.classList.add('active');
    App.ui.renderUserBox();

    // Página inicial correta para cada nível de acesso
    const isDirector = App.utils.isDirector();
    const isManager  = App.utils.isManager();
    if (isDirector) {
      App.ui.setPage('direcao');
    } else if (isManager) {
      App.ui.setPage('usuarios');
    } else {
      App.ui.setPage('minhasTarefas');
    }

    App.app.iniciarMonitor();
    if (App.chat && App.chat.init) {
      App.chat.init();
    }
  });

  // NAV
  document.querySelectorAll('.nav').forEach(n => n.onclick = () => App.ui.setPage(n.dataset.page));

  // NEW PROGRAMA / TAREFA
  document.getElementById('btn-new').onclick = () => App.app.newProgramaModal();

  // SEARCH
  let st;
  document.getElementById('search-global').addEventListener('input', () => {
    clearTimeout(st); st = setTimeout(() => {
      if (App.state.page === 'programas' && App.programasPage.load) App.programasPage.load();
    }, 250);
  });

  // MODAL overlay click outside
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') App.utils.closeModal();
  });

  // Keyboard shortcut: Esc fecha modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      App.utils.closeModal();
    }
  });

  App.app = {};

  // === MONITOR: notificacoes popup + menu piscando por SLA (estilo Fluxo IIGD) ===
  App.app.iniciarMonitor = function () {
    const navTarefas = document.querySelector('.nav[data-page="minhasTarefas"]');
    const notice = document.getElementById('notice');
    const noticeBody = document.getElementById('notice-body');
    const btnVisto = document.getElementById('notice-visto');
    const btnFechar = document.getElementById('notice-fechar');

    async function checar() {
      if (!App.user) return;
      try {
        const minhas = await App.tarefas.minhas(App.user.id);
        const abertas = (Array.isArray(minhas) ? minhas : []).filter(t => t.status !== 2);

        let temLate = false, temWarn = false;
        for (const t of abertas) {
          const sla = App.utils.slaInfo(t);
          if (sla.state === 'late') temLate = true;
          else if (sla.state === 'warn') temWarn = true;
        }

        // badge + menu piscando
        if (navTarefas) {
          navTarefas.classList.remove('attention-blue', 'attention-yellow', 'attention-red');
          navTarefas.querySelectorAll('.badge-count').forEach(b => b.remove());
          if (abertas.length) {
            const badge = document.createElement('span');
            badge.className = 'badge-count';
            badge.textContent = abertas.length;
            badge.style.marginLeft = '6px';
            navTarefas.appendChild(badge);
            if (temLate) navTarefas.classList.add('attention-red');
            else if (temWarn) navTarefas.classList.add('attention-yellow');
            else navTarefas.classList.add('attention-blue');
          }
        }

        // notificacao nao vista mais antiga
        const notifs = await App.notif.list(App.user.id, true);
        if (notifs && notifs.length) {
          const n = notifs[0];
          noticeBody.innerHTML = '<b>🔔 Nova Tarefa Recebida</b><div style="margin-top:5px">' +
            App.utils.escape(n.texto) + '</div>' +
            '<div style="color:var(--muted);font-size:11px;margin-top:5px">Recebido: ' +
            new Date(n.criado_em.replace(' ', 'T')).toLocaleString('pt-BR') + '</div>';
          btnVisto.style.display = '';
          notice.classList.add('show');
        } else {
          notice.classList.remove('show');
        }
      } catch (e) { console.error('[monitor]', e); }
    }

    btnVisto.onclick = async () => {
      try {
        const notifs = await App.notif.list(App.user.id, true);
        if (notifs && notifs.length) await App.notif.visto(notifs[0].id);
        notice.classList.remove('show');
        if (App.state.page === 'minhasTarefas' && App.minhasTarefasPage.load) App.minhasTarefasPage.load();
      } catch (e) {}
    };
    btnFechar.onclick = () => notice.classList.remove('show');

    checar();
    clearInterval(App._monitorTimer);
    App._monitorTimer = setInterval(checar, 10000); // a cada 10s
  };

  App.app.newProgramaModal = async function () {
    const [cargos, users] = await Promise.all([App.cargos.list(), App.users.list()]);
    const setores = cargos.filter(c => c.nome !== 'Direção Geral' && c.nome !== 'Gestores');
    const funcionarios = users.filter(u => u.level === 'employee' && u.ativo);

    // Etapas padrão para iniciar fluxo customizado sugerido
    let etapasCustom = [
      { cargo: 'Editor de Video', label: 'Fornecer vídeo na pasta do projeto', responsavel_id: (App.user.level === 'employee' ? App.user.id : '') },
      { cargo: 'Mixagem', label: 'Mixar áudio do programa', responsavel_id: '' },
      { cargo: 'Editor de Video', label: 'Finalizar e fechar o vídeo', responsavel_id: '' }
    ];

    let modoFluxo = 'custom'; // 'custom' | 'padrao'

    function renderStepsHtml() {
      if (modoFluxo === 'padrao') {
        return `
          <div style="padding:12px;background:rgba(0,0,0,.2);border-radius:8px;border:1px solid var(--line);font-size:12px;color:var(--txt-2)">
            <b>11 Etapas Oficiais de Dublagem HeyGen:</b><br>
            1. Preparar edição → 2. Subir no HeyGen → 3. Correção PT → 4. Traduzir ES → 5. Vozes HeyGen → 6. Correção ES → 7. Lipsync → 8. Pré-Mix → 9. Mixagem → 10. Vídeo Final → 11. QC Final ES.
          </div>
        `;
      }

      return `
        <div id="np-steps-list" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;padding:6px;background:rgba(0,0,0,.25);border-radius:8px;border:1px solid var(--line)">
          ${etapasCustom.map((st, idx) => `
            <div class="np-step-row" data-idx="${idx}" style="display:flex;gap:6px;align-items:center;background:var(--bg-2);padding:8px 10px;border-radius:6px;flex-wrap:wrap">
              <span class="status-pill pill-purple" style="font-weight:700;font-size:11px">${idx + 1}ª Etapa</span>
              <select class="np-step-cargo" style="padding:5px 8px;border-radius:4px;background:var(--panel);color:var(--txt);border:1px solid var(--line);font-size:12px;min-width:140px">
                ${setores.map(s => `<option value="${App.utils.escape(s.nome)}" ${st.cargo === s.nome ? 'selected' : ''}>${App.utils.escape(s.nome)}</option>`).join('')}
              </select>
              <input type="text" class="np-step-label" value="${App.utils.escape(st.label)}" placeholder="Ação da etapa..." style="flex:1;min-width:160px;padding:5px 8px;font-size:12px;border-radius:4px;background:var(--panel);color:var(--txt);border:1px solid var(--line)">
              <select class="np-step-resp" style="padding:5px 8px;border-radius:4px;background:var(--panel);color:var(--txt);border:1px solid var(--line);font-size:12px;min-width:130px">
                <option value="">-- Auto-atribuir --</option>
                ${funcionarios.map(f => `<option value="${f.id}" ${String(st.responsavel_id) === String(f.id) ? 'selected' : ''}>${App.utils.escape(f.nome)}</option>`).join('')}
              </select>
              <button class="btn-danger np-step-del" style="padding:4px 8px;font-size:11px" title="Remover etapa">✕</button>
            </div>
          `).join('')}
        </div>
        <button class="btn-ghost" id="np-btn-add-step" style="margin-top:6px;font-size:12px;width:100%;border:1px dashed var(--line)">
          + Adicionar Etapa ao Fluxo
        </button>
      `;
    }

    App.utils.modal(
      `<h3>+ Cadastrar Novo Programa & Fluxo de Produção</h3>
      <div class="row">
        <div class="field" style="flex:2">
          <span>Nome do Programa / Projeto *</span>
          <input id="np-nome" value="SHOW DA FÉ" placeholder="Ex: SHOW DA FÉ, SFI, NOITE COM ADORADORES...">
        </div>
        <div class="field" style="flex:1">
          <span>Número / Código</span>
          <input id="np-codigo" value="1589" placeholder="Ex: 1589, 2500...">
        </div>
      </div>

      <div class="row">
        <div class="field">
          <span>Prioridade</span>
          <select id="np-prio">
            <option value="Normal">Normal</option>
            <option value="Alta">Alta</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
        <div class="field">
          <span>Pasta de Rede (Opcional)</span>
          <input id="np-root" placeholder="\\\\SERVIDOR\\\\Dublagem\\\\SHOW_DA_FE\\\\1589">
        </div>
      </div>

      <div class="field" style="margin-top:6px">
        <span>Definição do Fluxo de Etapas:</span>
        <div style="display:flex;gap:16px;margin-bottom:8px">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="radio" name="np-tipo-fluxo" value="custom" checked style="width:auto;margin:0">
            <b>Fluxo Personalizado (Escolher etapas)</b>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
            <input type="radio" name="np-tipo-fluxo" value="padrao" style="width:auto;margin:0">
            <span>Fluxo Completo de Dublagem (11 Etapas)</span>
          </label>
        </div>
        <div id="np-steps-host">
          ${renderStepsHtml()}
        </div>
      </div>

      <div class="actions" style="margin-top:16px">
        <button data-close class="btn-ghost">Cancelar</button>
        <button class="btn-primary" id="np-ok" style="font-weight:700">Iniciar no Fluxo</button>
      </div>`,
      (host) => {
        function attachStepEvents() {
          const addBtn = host.querySelector('#np-btn-add-step');
          if (addBtn) {
            addBtn.onclick = () => {
              etapasCustom.push({ cargo: 'Editor de Video', label: 'Nova etapa de edição', responsavel_id: '' });
              host.querySelector('#np-steps-host').innerHTML = renderStepsHtml();
              attachStepEvents();
            };
          }

          host.querySelectorAll('.np-step-del').forEach(btn => {
            btn.onclick = () => {
              const row = btn.closest('.np-step-row');
              const idx = +row.dataset.idx;
              if (etapasCustom.length <= 1) return App.utils.toast('O fluxo deve ter pelo menos uma etapa', 'err');
              etapasCustom.splice(idx, 1);
              host.querySelector('#np-steps-host').innerHTML = renderStepsHtml();
              attachStepEvents();
            };
          });

          host.querySelectorAll('.np-step-cargo').forEach(sel => {
            sel.onchange = () => {
              const idx = +sel.closest('.np-step-row').dataset.idx;
              if (etapasCustom[idx]) etapasCustom[idx].cargo = sel.value;
            };
          });

          host.querySelectorAll('.np-step-label').forEach(inp => {
            inp.oninput = () => {
              const idx = +inp.closest('.np-step-row').dataset.idx;
              if (etapasCustom[idx]) etapasCustom[idx].label = inp.value;
            };
          });

          host.querySelectorAll('.np-step-resp').forEach(sel => {
            sel.onchange = () => {
              const idx = +sel.closest('.np-step-row').dataset.idx;
              if (etapasCustom[idx]) etapasCustom[idx].responsavel_id = sel.value ? +sel.value : '';
            };
          });
        }

        attachStepEvents();

        host.querySelectorAll('input[name="np-tipo-fluxo"]').forEach(r => {
          r.onchange = () => {
            modoFluxo = r.value;
            host.querySelector('#np-steps-host').innerHTML = renderStepsHtml();
            attachStepEvents();
          };
        });

        host.querySelector('#np-ok').onclick = async () => {
          const nome = host.querySelector('#np-nome').value.trim() || 'SHOW DA FÉ';
          const codigo = host.querySelector('#np-codigo').value.trim() || null;
          const prioridade = host.querySelector('#np-prio').value;
          const root = host.querySelector('#np-root').value.trim() || null;

          let stepsToSend = null;
          if (modoFluxo === 'custom') {
            // Coleta dados finais das etapas da tela
            const rows = host.querySelectorAll('.np-step-row');
            stepsToSend = [];
            rows.forEach((row, i) => {
              const cargo = row.querySelector('.np-step-cargo').value;
              const label = row.querySelector('.np-step-label').value.trim() || `Etapa ${i + 1}`;
              const respVal = row.querySelector('.np-step-resp').value;
              const responsavel_id = respVal ? +respVal : null;
              stepsToSend.push({ cargo, label, responsavel_id });
            });

            if (!stepsToSend.length) {
              return App.utils.toast('Defina pelo menos uma etapa para o fluxo', 'err');
            }
          }

          const res = await App.programs.create({
            nome,
            codigo,
            prioridade,
            root,
            steps: stepsToSend,
            criado_por: App.user.id
          });

          if (!res.ok) return App.utils.toast(res.msg, 'err');
          App.utils.toast(`Programa ${nome} ${res.code || ''} cadastrado no fluxo!`);
          App.utils.closeModal();

          if (App.state.page === 'dashboard' && App.dashboard.loadData) App.dashboard.loadData();
          if (App.state.page === 'programas' && App.programasPage.load) App.programasPage.load();
          if (App.state.page === 'minhasTarefas' && App.minhasTarefasPage.load) App.minhasTarefasPage.load();
        };
      }
    );
  };
})();
