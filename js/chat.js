// FIC FLOW - CHAT DA EQUIPE COM NOTIFICAÇÕES EM TEMPO REAL E CONTROLE HIERÁRQUICO
window.App = window.App || {};

App.chat = {
  messages: [],
  onlineUsers: [],
  contacts: [],
  selectedRecipientId: 0, // 0 = Canal Geral / Avisos
  isOpen: false,
  isMuted: localStorage.getItem('fic_chat_muted') === 'true',
  unreadCount: 0,
  lastMsgId: 0,
  pollTimer: null,
  heartbeatTimer: null,

  init: function () {
    const fab = document.getElementById('chat-fab');
    const panel = document.getElementById('chat-panel');
    const closeBtn = document.getElementById('chat-close-btn');
    const muteBtn = document.getElementById('chat-mute-btn');
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    const recipientSelect = document.getElementById('chat-recipient-select');
    const topbarChatBtn = document.getElementById('topbar-chat-btn');

    if (fab) fab.onclick = () => App.chat.toggle();
    if (topbarChatBtn) topbarChatBtn.onclick = () => App.chat.toggle();
    if (closeBtn) closeBtn.onclick = () => App.chat.close();
    
    if (muteBtn) {
      App.chat.updateMuteIcon();
      muteBtn.onclick = () => {
        App.chat.isMuted = !App.chat.isMuted;
        localStorage.setItem('fic_chat_muted', App.chat.isMuted ? 'true' : 'false');
        App.chat.updateMuteIcon();
      };
    }

    if (recipientSelect) {
      recipientSelect.onchange = () => {
        App.chat.selectedRecipientId = +recipientSelect.value || 0;
        App.chat.lastMsgId = 0;
        App.chat.fetchInitialMessages();
      };
    }

    if (sendBtn && input) {
      sendBtn.onclick = () => App.chat.submitMessage();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          App.chat.submitMessage();
        }
      });
    }

    // Heartbeat a cada 10 segundos
    App.chat.sendHeartbeat();
    clearInterval(App.chat.heartbeatTimer);
    App.chat.heartbeatTimer = setInterval(App.chat.sendHeartbeat, 10000);

    // Carregar contatos permitidos e mensagens
    App.chat.loadAll();
    clearInterval(App.chat.pollTimer);
    App.chat.pollTimer = setInterval(App.chat.poll, 3000);

    // Verificar mensagens não lidas ao logar
    setTimeout(() => App.chat.checkLoginUnread(), 1000);
  },

  updateMuteIcon: function () {
    const muteBtn = document.getElementById('chat-mute-btn');
    if (muteBtn) {
      muteBtn.textContent = App.chat.isMuted ? '🔇' : '🔔';
      muteBtn.title = App.chat.isMuted ? 'Som desativado' : 'Som ativado';
    }
  },

  toggle: function () {
    if (App.chat.isOpen) App.chat.close();
    else App.chat.open();
  },

  open: function (destinatarioId) {
    App.chat.isOpen = true;
    const panel = document.getElementById('chat-panel');
    if (panel) panel.classList.add('open');
    App.chat.unreadCount = 0;
    App.chat.updateBadge();

    if (destinatarioId !== undefined) {
      App.chat.selectedRecipientId = +destinatarioId;
      const sel = document.getElementById('chat-recipient-select');
      if (sel) sel.value = String(destinatarioId);
      App.chat.lastMsgId = 0;
      App.chat.fetchInitialMessages();
    }

    App.chat.scrollToBottom();
    const input = document.getElementById('chat-input');
    if (input) setTimeout(() => input.focus(), 150);
  },

  close: function () {
    App.chat.isOpen = false;
    const panel = document.getElementById('chat-panel');
    if (panel) panel.classList.remove('open');
  },

  sendHeartbeat: async function () {
    if (!App.user || !App.user.id) return;
    try {
      if (App.auth && App.auth.heartbeat) {
        await App.auth.heartbeat(App.user.id);
      }
    } catch (e) {
      console.warn('[chat] heartbeat erro:', e);
    }
  },

  loadAll: async function () {
    if (!App.user) return;
    try {
      await Promise.all([
        App.chat.fetchContacts(),
        App.chat.fetchOnline(),
        App.chat.fetchInitialMessages()
      ]);
    } catch (e) {
      console.error('[chat] loadAll erro:', e);
    }
  },

  poll: async function () {
    if (!App.user) return;
    try {
      await Promise.all([
        App.chat.fetchOnline(),
        App.chat.fetchNewMessages()
      ]);
    } catch (e) {
      console.warn('[chat] poll erro:', e);
    }
  },

  fetchContacts: async function () {
    if (!App.user || !App.chatApi || !App.chatApi.contacts) return;
    try {
      const list = await App.chatApi.contacts(App.user.id);
      App.chat.contacts = Array.isArray(list) ? list : [];
      App.chat.renderContactsDropdown();
    } catch (e) {
      console.warn('[chat] fetchContacts erro:', e);
    }
  },

  renderContactsDropdown: function () {
    const sel = document.getElementById('chat-recipient-select');
    if (!sel) return;

    let opts = '';

    if (App.chat.contacts && App.chat.contacts.length) {
      opts = App.chat.contacts.map(c => {
        const icon = c.level === 'director' ? '👑' : (c.level === 'manager' ? '👥' : '👤');
        const roleStr = c.desc || (c.cargo_nome ? `(${c.cargo_nome})` : '');
        const onlineStr = c.is_online ? ' • [Online]' : '';
        return `<option value="${c.id}" ${c.id === App.chat.selectedRecipientId ? 'selected' : ''}>${icon} ${App.utils.escape(c.nome)} ${roleStr}${onlineStr}</option>`;
      }).join('');

      // Se nenhum contato estava selecionado ou o selecionado não existe mais, seleciona o primeiro
      if (!App.chat.selectedRecipientId || !App.chat.contacts.some(c => c.id === App.chat.selectedRecipientId)) {
        App.chat.selectedRecipientId = App.chat.contacts[0].id;
      }
    } else {
      opts = '<option value="0">Nenhum contato disponível</option>';
      App.chat.selectedRecipientId = 0;
    }

    sel.innerHTML = opts;
    if (App.chat.selectedRecipientId) {
      sel.value = String(App.chat.selectedRecipientId);
    }
  },

  fetchOnline: async function () {
    try {
      if (!App.chatApi || !App.chatApi.online) return;
      const res = await App.chatApi.online(App.user?.id);
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      App.chat.onlineUsers = list;
      App.chat.renderOnline();
    } catch (e) {}
  },

  fetchInitialMessages: async function () {
    try {
      if (!App.chatApi || !App.chatApi.list) return;
      const res = await App.chatApi.list(60, 0, App.user?.id, App.chat.selectedRecipientId);
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      App.chat.messages = list;
      if (list.length > 0) {
        App.chat.lastMsgId = Math.max(...list.map(m => m.id));
      } else {
        App.chat.lastMsgId = 0;
      }
      App.chat.renderMessages();
      App.chat.scrollToBottom();
    } catch (e) {
      console.error('[chat] initial msg erro:', e);
    }
  },

  fetchNewMessages: async function () {
    try {
      if (!App.chatApi || !App.chatApi.list) return;
      const res = await App.chatApi.list(50, App.chat.lastMsgId, App.user?.id, App.chat.selectedRecipientId);
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      if (list && list.length > 0) {
        for (const m of list) {
          if (!App.chat.messages.some(x => x.id === m.id)) {
            App.chat.messages.push(m);
            if (m.id > App.chat.lastMsgId) App.chat.lastMsgId = m.id;

            // Se a mensagem for de outra pessoa
            if (m.usuario_id !== App.user.id) {
              App.chat.notifyIncomingMessage(m);
            }
          }
        }
        App.chat.renderMessages();
        App.chat.scrollToBottom();
      }
    } catch (e) {
      console.warn('[chat] fetchNew erro:', e);
    }
  },

  notifyIncomingMessage: function (m) {
    if (!App.chat.isMuted) {
      App.chat.playChime();
    }

    if (!App.chat.isOpen) {
      App.chat.unreadCount += 1;
      App.chat.updateBadge();
    }

    // Exibe pop-up flutuante elegante na tela
    App.chat.showFloatingPopup(m);
  },

  showFloatingPopup: function (m) {
    let container = document.getElementById('chat-popup-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'chat-popup-container';
      container.style.cssText = 'position:fixed;bottom:90px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      document.body.appendChild(container);
    }

    const popup = document.createElement('div');
    popup.className = 'chat-toast-popup';
    popup.style.cssText = `
      pointer-events:auto;
      background:var(--panel);
      border:1px solid var(--pri);
      border-left:5px solid var(--pri);
      border-radius:12px;
      padding:14px 16px;
      box-shadow:0 10px 30px rgba(0,0,0,.45);
      width:320px;
      animation:slideInRight .3s ease;
      color:var(--txt);
      font-family:inherit;
    `;

    const isTask = m.tipo === 'notificacao' || m.tarefa_id;
    const headerTitle = isTask ? '🔔 Nova Etapa no Fluxo' : '💬 Chamada no Chat';
    const avatar = App.utils.userAvatar(m.usuario_nome || 'Membro', m.usuario_genero || 'M');
    const previewTxt = (m.texto || '').length > 75 ? (m.texto || '').slice(0, 75) + '...' : m.texto;

    popup.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          ${avatar}
          <div>
            <b style="font-size:13px">${App.utils.escape(m.usuario_nome || 'Sistema')}</b>
            <div style="font-size:10px;color:var(--pri-2);font-weight:700">${headerTitle}</div>
          </div>
        </div>
        <button class="btn-popup-close" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px">✕</button>
      </div>
      <div style="font-size:12px;color:var(--txt);margin-bottom:10px;line-height:1.4;background:rgba(0,0,0,.15);padding:8px 10px;border-radius:6px">
        "${App.utils.escape(previewTxt)}"
      </div>
      <div style="display:flex;justify-content:flex-end;gap:6px">
        ${m.tarefa_id ? `
          <button class="btn-popup-task btn-primary" style="font-size:11px;padding:5px 12px;font-weight:700">📂 Ver Minha Tarefa</button>
        ` : `
          <button class="btn-popup-resp btn-primary" style="font-size:11px;padding:5px 12px;font-weight:700">💬 Responder Agora</button>
        `}
      </div>
    `;

    popup.querySelector('.btn-popup-close').onclick = () => popup.remove();
    
    const taskBtn = popup.querySelector('.btn-popup-task');
    if (taskBtn) {
      taskBtn.onclick = () => {
        popup.remove();
        App.ui.setPage('minhasTarefas');
      };
    }

    const respBtn = popup.querySelector('.btn-popup-resp');
    if (respBtn) {
      respBtn.onclick = () => {
        popup.remove();
        App.chat.open(m.usuario_id || 0);
      };
    }

    container.appendChild(popup);

    // Auto-remover após 12 segundos
    setTimeout(() => {
      if (popup.parentElement) {
        popup.style.opacity = '0';
        popup.style.transition = 'opacity .4s ease';
        setTimeout(() => popup.remove(), 400);
      }
    }, 12000);
  },

  checkLoginUnread: async function () {
    if (!App.user || !App.chatApi || !App.chatApi.list) return;
    try {
      const res = await App.chatApi.list(10, 0, App.user.id, null);
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      
      // Filtra mensagens recentes direcionadas a mim
      const directMsgs = list.filter(m => m.usuario_id !== App.user.id && m.destinatario_id === App.user.id);
      if (directMsgs.length > 0) {
        const lastMsg = directMsgs[directMsgs.length - 1];
        App.chat.notifyIncomingMessage(lastMsg);
      }
    } catch (e) {}
  },

  submitMessage: async function () {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const txt = input.value.trim();
    if (!txt || !App.user) return;

    const destId = App.chat.selectedRecipientId || null;

    try {
      const res = await App.chatApi.send(App.user.id, txt, null, destId);
      if (!res.ok) {
        App.utils.toast(res.msg || 'Erro ao enviar mensagem', 'err');
        return;
      }

      input.value = '';

      if (res && res.message) {
        if (!App.chat.messages.some(m => m.id === res.message.id)) {
          App.chat.messages.push(res.message);
          if (res.message.id > App.chat.lastMsgId) App.chat.lastMsgId = res.message.id;
          App.chat.renderMessages();
          App.chat.scrollToBottom();
        }
      }
      App.chat.poll();
    } catch (e) {
      App.utils.toast('Erro ao enviar mensagem', 'err');
    }
  },

  updateBadge: function () {
    const badge = document.getElementById('chat-fab-badge');
    const topbarBadge = document.getElementById('topbar-chat-badge');
    if (badge) {
      if (App.chat.unreadCount > 0) {
        badge.textContent = App.chat.unreadCount > 99 ? '99+' : App.chat.unreadCount;
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }
    if (topbarBadge) {
      if (App.chat.unreadCount > 0) {
        topbarBadge.textContent = App.chat.unreadCount > 99 ? '99+' : App.chat.unreadCount;
        topbarBadge.style.display = 'inline-block';
      } else {
        topbarBadge.style.display = 'none';
      }
    }
  },

  renderOnline: function () {
    const container = document.getElementById('chat-online-strip');
    const countEl = document.getElementById('chat-online-count');
    if (countEl) {
      const n = App.chat.onlineUsers.length || 1;
      countEl.textContent = `${n} online`;
    }
    if (!container) return;

    if (!App.chat.onlineUsers.length) {
      container.innerHTML = `<span style="font-size:11px;color:var(--muted)">Apenas você online</span>`;
      return;
    }

    container.innerHTML = App.chat.onlineUsers.map(u => {
      const genCls = (u.genero === 'F') ? 'user-badge-fem' : (u.genero === 'O' ? 'user-badge-other' : 'user-badge-masc');
      const genIcon = (u.genero === 'F') ? '♀' : (u.genero === 'O' ? '★' : '♂');
      return `
        <div class="chat-user-chip ${genCls}" title="${App.utils.escape(u.cargo_nome || u.cargo || 'Membro')}" onclick="App.chat.open(${u.id})" style="cursor:pointer">
          <span class="presence-dot"></span>
          <span>${genIcon} ${App.utils.escape(u.nome)}</span>
        </div>
      `;
    }).join('');
  },

  renderMessages: function () {
    const host = document.getElementById('chat-messages-host');
    if (!host) return;

    if (!App.chat.messages.length) {
      host.innerHTML = `
        <div class="empty" style="padding:40px 10px;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">💬</div>
          <b style="font-size:13px">Nenhuma mensagem nesta conversa.</b>
          <p style="font-size:11px;color:var(--muted);margin-top:4px">Digite uma mensagem abaixo para iniciar.</p>
        </div>
      `;
      return;
    }

    host.innerHTML = App.chat.messages.map(m => {
      const isMine = m.usuario_id === App.user.id;
      const timeStr = m.criado_em ? new Date(m.criado_em.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      if (m.tipo === 'notificacao' || m.tipo === 'sistema') {
        const btnTarefa = m.tarefa_id ? `<button class="btn-ver-tarefa" onclick="App.chat.abrirTarefa(${m.tarefa_id})" style="margin-top:6px;padding:4px 10px;border-radius:6px;background:var(--pri);color:#fff;border:none;cursor:pointer;font-size:11px;font-weight:700">📂 Ver Tarefa #${m.tarefa_id}</button>` : '';
        return `
          <div class="chat-msg system-notif">
            <div class="chat-bubble" style="background:var(--panel-2);border:1px dashed var(--pri);border-radius:10px;padding:10px 12px">
              <div class="sys-title" style="font-weight:700;color:var(--pri-2);font-size:11px">${App.utils.escape(m.usuario_nome || 'Sistema')}</div>
              <div style="font-size:12px;margin-top:2px">${App.utils.escape(m.texto)}</div>
              ${btnTarefa}
              <span class="chat-msg-time" style="font-size:10px;color:var(--muted);display:block;text-align:right;margin-top:4px">${timeStr}</span>
            </div>
          </div>
        `;
      }

      const gen = m.usuario_genero || 'M';
      const genCls = (gen === 'F') ? 'user-badge-fem' : (gen === 'O' ? 'user-badge-other' : 'user-badge-masc');
      const genIcon = (gen === 'F') ? '♀' : (gen === 'O' ? '★' : '♂');
      const avatar = App.utils.userAvatar(m.usuario_nome || 'Membro', gen);

      return `
        <div class="chat-msg ${isMine ? 'mine' : ''}" style="display:flex;flex-direction:column;max-width:82%;align-self:${isMine ? 'flex-end' : 'flex-start'};margin-bottom:6px">
          ${!isMine ? `
            <div class="chat-msg-sender" style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              ${avatar}
              <span class="user-badge ${genCls}" style="padding:1px 6px;font-size:10px;font-weight:700">${genIcon} ${App.utils.escape(m.usuario_nome)}</span>
              ${m.cargo_nome ? `<span style="font-size:10px;color:var(--muted)">${App.utils.escape(m.cargo_nome)}</span>` : ''}
            </div>
          ` : ''}
          <div class="chat-bubble" style="padding:10px 14px;border-radius:${isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};background:${isMine ? 'linear-gradient(135deg, var(--pri), var(--pri-2))' : 'var(--panel-2)'};color:${isMine ? '#fff' : 'var(--txt)'};border:${isMine ? 'none' : '1px solid var(--line)'};box-shadow:0 2px 8px rgba(0,0,0,.15);font-size:13px;line-height:1.45;word-break:break-word">
            ${App.utils.escape(m.texto)}
          </div>
          <span class="chat-msg-time" style="font-size:10px;color:var(--muted);align-self:${isMine ? 'flex-end' : 'flex-start'};margin-top:2px">
            ${timeStr} ${isMine ? '<span style="color:var(--pri-2);font-weight:700">✓✓</span>' : ''}
          </span>
        </div>
      `;
    }).join('');
  },

  scrollToBottom: function () {
    const host = document.getElementById('chat-messages-host');
    if (host) {
      host.scrollTop = host.scrollHeight;
    }
  },

  abrirTarefa: function (tarefaId) {
    App.ui.setPage('minhasTarefas');
  },

  playChime: function () {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }
};
