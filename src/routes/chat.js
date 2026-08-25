import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();
router.use(authenticateToken);

// Listar mensagens privadas 1-a-1
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const destId = req.query.destinatario_id ? parseInt(req.query.destinatario_id) : null;
    const limit = parseInt(req.query.limite) || 60;
    const afterId = parseInt(req.query.desde_id) || 0;

    let sql = '';
    let params = [];

    if (destId) {
      sql = `
        SELECT * FROM chat_mensagens
        WHERE id > ? AND (
          (usuario_id = ? AND destinatario_id = ?) OR
          (usuario_id = ? AND destinatario_id = ?)
        )
        ORDER BY id ASC LIMIT ?
      `;
      params = [afterId, userId, destId, destId, userId, limit];
    } else {
      sql = `
        SELECT * FROM chat_mensagens
        WHERE id > ? AND (destinatario_id = ? OR usuario_id = ?)
        ORDER BY id ASC LIMIT ?
      `;
      params = [afterId, userId, userId, limit];
    }

    const messages = await query(sql, params);
    res.json({ ok: true, data: messages });
  } catch (err) {
    console.error('[CHAT] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar mensagens.' });
  }
});

// Enviar mensagem 1-a-1
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { texto, tarefa_id, destinatario_id } = req.body;

    if (!texto || !texto.trim()) return res.status(400).json({ ok: false, msg: 'Mensagem vazia.' });
    if (!destinatario_id) return res.status(400).json({ ok: false, msg: 'Selecione um contato.' });

    const u = await getOne(
      'SELECT u.id, u.nome, u.genero, u.level, c.nome AS cargo_nome, c.cor AS cargo_cor FROM usuarios u JOIN cargos c ON c.id=u.cargo_id WHERE u.id=?',
      [userId]
    );
    const dest = await getOne('SELECT u.id, u.nome, u.level FROM usuarios u WHERE u.id=?', [destinatario_id]);

    if (!u || !dest) return res.status(404).json({ ok: false, msg: 'Usuário ou destinatário não encontrado.' });

    const r = await execute(
      `INSERT INTO chat_mensagens (usuario_id, usuario_nome, usuario_genero, cargo_nome, cargo_cor, destinatario_id, destinatario_nome, tipo, texto, tarefa_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'chat', ?, ?)`,
      [userId, u.nome, u.genero || 'M', u.cargo_nome, u.cargo_cor, dest.id, dest.nome, texto.trim(), tarefa_id || null]
    );

    await execute("UPDATE usuarios SET ultimo_visto=CURRENT_TIMESTAMP WHERE id=?", [userId]);

    const msg = await getOne('SELECT * FROM chat_mensagens WHERE id=?', [r.insertId]);
    res.json({ ok: true, message: msg });
  } catch (err) {
    console.error('[CHAT] Send error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao enviar mensagem.' });
  }
});

// Listar contatos disponíveis
router.get('/contacts', async (req, res) => {
  try {
    const userId = req.user.id;
    const u = await getOne('SELECT * FROM usuarios WHERE id=?', [userId]);
    if (!u) return res.json({ ok: true, data: [] });

    let contacts = [];
    if (u.level === 'director') {
      contacts = await query(
        `SELECT u.id, u.nome, u.level, u.genero, c.nome AS cargo_nome, c.cor AS cargo_cor,
                CASE WHEN u.ultimo_visto >= NOW() - INTERVAL '5 MINUTE' THEN 1 ELSE 0 END AS is_online
         FROM usuarios u
         JOIN cargos c ON c.id = u.cargo_id
         WHERE u.ativo = 1 AND u.id != ? AND u.level != 'employee'
         ORDER BY u.level, u.nome`,
        [userId]
      );
    } else if (u.level === 'manager') {
      contacts = await query(
        `SELECT u.id, u.nome, u.level, u.genero, c.nome AS cargo_nome, c.cor AS cargo_cor,
                CASE WHEN u.ultimo_visto >= NOW() - INTERVAL '5 MINUTE' THEN 1 ELSE 0 END AS is_online
         FROM usuarios u
         JOIN cargos c ON c.id = u.cargo_id
         WHERE u.ativo = 1 AND u.id != ?
         ORDER BY u.level, u.nome`,
        [userId]
      );
    } else {
      contacts = await query(
        `SELECT u.id, u.nome, u.level, u.genero, c.nome AS cargo_nome, c.cor AS cargo_cor,
                CASE WHEN u.ultimo_visto >= NOW() - INTERVAL '5 MINUTE' THEN 1 ELSE 0 END AS is_online
         FROM usuarios u
         JOIN cargos c ON c.id = u.cargo_id
         WHERE u.ativo = 1 AND u.level = 'manager'
         ORDER BY u.nome`
      );
    }

    res.json({ ok: true, data: contacts });
  } catch (err) {
    console.error('[CHAT] Contacts error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar contatos.' });
  }
});

// Usuários online
router.get('/online', async (req, res) => {
  try {
    const list = await query(
      `SELECT u.id, u.nome, u.genero, u.level, c.nome AS cargo_nome, c.cor AS cargo_cor
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       WHERE u.ativo = 1 AND u.ultimo_visto >= NOW() - INTERVAL '5 MINUTE'`
    );
    res.json({ ok: true, data: list });
  } catch (err) {
    console.error('[CHAT] Online error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar online.' });
  }
});

export default router;
