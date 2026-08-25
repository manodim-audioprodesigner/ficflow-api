import { Router } from 'express';
import { query, getOne, execute, hashPin } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.nome, u.usuario, u.cargo_id, u.genero, u.level, u.short, u.teams, u.idioma, u.ativo, u.ultimo_visto,
              c.nome AS cargo, c.cor AS cargo_cor
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       ORDER BY u.nome`
    );

    // Formata o campo teams se for JSON string
    const formatted = users.map(u => {
      let teamsArr = [];
      try {
        teamsArr = typeof u.teams === 'string' ? JSON.parse(u.teams) : (Array.isArray(u.teams) ? u.teams : []);
      } catch (e) {
        teamsArr = [];
      }
      return { ...u, teams: teamsArr };
    });

    res.json({ ok: true, data: formatted });
  } catch (err) {
    console.error('[USERS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar usuários.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome, usuario, pin, cargo_id, genero, level, short, teams, idioma } = req.body;
    if (!nome || !usuario || !pin) {
      return res.status(400).json({ ok: false, msg: 'Nome, login e senha são obrigatórios.' });
    }

    const cId = cargo_id || 1;
    const cargo = await getOne('SELECT nome FROM cargos WHERE id = ?', [cId]);
    const cargoNome = cargo ? cargo.nome : '';

    const userLevel = level || (cargoNome === 'Direção Geral' ? 'director' : (cargoNome === 'Gestores' ? 'manager' : 'employee'));
    const userShort = short || (cargoNome === 'Direção Geral' ? 'DIR' : (cargoNome === 'Gestores' ? 'GEST' : 'FUNC'));
    const userGen = genero || 'M';
    const teamsJson = JSON.stringify(Array.isArray(teams) ? teams : (teams ? [teams] : []));

    const result = await execute(
      `INSERT INTO usuarios (nome, usuario, pin_hash, cargo_id, genero, level, short, teams, idioma, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [nome.trim(), usuario.trim(), hashPin(pin), cId, userGen, userLevel, userShort, teamsJson, idioma || null]
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'CRIAR_USUARIO', 'usuarios', ?, ?)`,
      [req.user.id, req.user.nome || req.user.usuario, result.insertId, `Criou usuário: ${nome} (${usuario})`]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[USERS] Create error:', err);
    if (err.message && err.message.includes('unique constraint "usuarios_usuario_key"')) {
      return res.status(400).json({ ok: false, msg: 'Este login de usuário já está em uso. Escolha outro.' });
    }
    if (err.message && err.message.includes('ER_DUP_ENTRY')) {
      return res.status(400).json({ ok: false, msg: 'Este login de usuário já está em uso. Escolha outro.' });
    }
    res.status(500).json({ ok: false, msg: 'Erro ao criar usuário: ' + err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, usuario, pin, cargo_id, genero, level, short, teams, idioma, ativo } = req.body;

    const cur = await getOne('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!cur) return res.status(404).json({ ok: false, msg: 'Usuário não encontrado.' });

    // Apenas troca de senha
    if (pin && pin.trim() && !nome) {
      await execute('UPDATE usuarios SET pin_hash = ? WHERE id = ?', [hashPin(pin), id]);
      return res.json({ ok: true });
    }

    const cId = cargo_id || cur.cargo_id;
    const gen = genero || cur.genero || 'M';
    const lvl = level || cur.level || 'employee';
    const sh = short || cur.short || 'FUNC';
    const tm = teams !== undefined ? JSON.stringify(Array.isArray(teams) ? teams : (teams ? [teams] : [])) : cur.teams;
    const atv = (ativo === 0 || ativo === false) ? 0 : 1;
    const idm = idioma !== undefined ? idioma : cur.idioma;
    const n = nome ? nome.trim() : cur.nome;
    const u = usuario ? usuario.trim() : cur.usuario;

    if (pin && pin.trim()) {
      await execute(
        `UPDATE usuarios SET nome=?, usuario=?, pin_hash=?, cargo_id=?, genero=?, level=?, short=?, teams=?, idioma=?, ativo=? WHERE id=?`,
        [n, u, hashPin(pin), cId, gen, lvl, sh, tm, idm, atv, id]
      );
    } else {
      await execute(
        `UPDATE usuarios SET nome=?, usuario=?, cargo_id=?, genero=?, level=?, short=?, teams=?, idioma=?, ativo=? WHERE id=?`,
        [n, u, cId, gen, lvl, sh, tm, idm, atv, id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[USERS] Update error:', err);
    if (err.message && err.message.includes('unique constraint "usuarios_usuario_key"')) {
      return res.status(400).json({ ok: false, msg: 'Este login de usuário já está em uso por outra pessoa.' });
    }
    if (err.message && err.message.includes('ER_DUP_ENTRY')) {
      return res.status(400).json({ ok: false, msg: 'Este login de usuário já está em uso por outra pessoa.' });
    }
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar usuário.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;

    if (parseInt(id) === requestingUserId) {
      return res.status(400).json({ ok: false, msg: 'Você não pode se excluir.' });
    }

    await execute('UPDATE tarefas SET responsavel_id = NULL WHERE responsavel_id = ?', [id]);
    await execute('UPDATE tarefas SET criado_por = NULL WHERE criado_por = ?', [id]);
    await execute('UPDATE programas SET criado_por = NULL WHERE criado_por = ?', [id]);
    await execute('UPDATE status_historico SET usuario_id = NULL WHERE usuario_id = ?', [id]);
    await execute('UPDATE chat_mensagens SET usuario_id = NULL WHERE usuario_id = ?', [id]);
    await execute('UPDATE chat_mensagens SET destinatario_id = NULL WHERE destinatario_id = ?', [id]);
    await execute('DELETE FROM notificacoes WHERE usuario_id = ?', [id]);
    await execute('DELETE FROM atividades WHERE usuario_id = ?', [id]);
    
    await execute('DELETE FROM usuarios WHERE id = ?', [id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[USERS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir usuário: ' + (err.message || '') });
  }
});

router.get('/fix-fks/run', async (req, res) => {
  try {
    const q = `SELECT tc.table_name, tc.constraint_name, kcu.column_name 
               FROM information_schema.table_constraints AS tc 
               JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
               JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
               WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'usuarios'`;
    const rows = await query(q);
    const fixes = [];
    for (let row of rows) {
      if (row.constraint_name.includes('ON DELETE')) continue;
      await execute(`ALTER TABLE ${row.table_name} DROP CONSTRAINT ${row.constraint_name}`);
      const act = row.table_name === 'notificacoes' ? 'CASCADE' : 'SET NULL';
      await execute(`ALTER TABLE ${row.table_name} ADD CONSTRAINT ${row.constraint_name} FOREIGN KEY (${row.column_name}) REFERENCES usuarios(id) ON DELETE ${act}`);
      fixes.push(row.table_name + '.' + row.column_name);
    }
    res.json({ ok: true, msg: 'Fix completed', fixes });
  } catch (err) {
    res.status(500).json({ ok: false, msg: err.message });
  }
});

export default router;