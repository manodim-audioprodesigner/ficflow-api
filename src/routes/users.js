import { Router } from 'express';
import { query, getOne, execute, hashPin } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.nome, u.usuario, u.ativo, c.nome AS cargo, c.cor AS cargo_cor
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       ORDER BY u.nome`
    );
    res.json({ ok: true, data: users });
  } catch (err) {
    console.error('[USERS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar usuarios.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nome, usuario, pin, cargo_id } = req.body;
    if (!nome || !usuario || !pin || !cargo_id) {
      return res.status(400).json({ ok: false, msg: 'Dados insuficientes.' });
    }

    const result = await execute(
      'INSERT INTO usuarios (nome, usuario, pin_hash, cargo_id) VALUES (?, ?, ?, ?)',
      [nome, usuario, hashPin(pin), cargo_id]
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'CRIAR_USUARIO', 'usuarios', ?, ?)`,
      [req.user.id, req.user.usuario, result.insertId, `Criou usuário: ${nome} (${usuario})`]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[USERS] Create error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, msg: 'Usuario ja existe.' });
    }
    res.status(500).json({ ok: false, msg: 'Erro ao criar usuario.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, usuario, pin, cargo_id, ativo } = req.body;

    if (pin) {
      await execute(
        'UPDATE usuarios SET nome=?, usuario=?, pin_hash=?, cargo_id=?, ativo=? WHERE id=?',
        [nome, usuario, hashPin(pin), cargo_id, ativo ? 1 : 0, id]
      );
    } else {
      await execute(
        'UPDATE usuarios SET nome=?, usuario=?, cargo_id=?, ativo=? WHERE id=?',
        [nome, usuario, cargo_id, ativo ? 1 : 0, id]
      );
    }

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'ATUALIZAR_USUARIO', 'usuarios', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Atualizou usuário: ${nome} (${usuario})`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[USERS] Update error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar usuario.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;

    if (parseInt(id) === requestingUserId) {
      return res.status(400).json({ ok: false, msg: 'Voce nao pode se excluir.' });
    }

    const userToDelete = await getOne('SELECT nome, usuario, cargo_id FROM usuarios WHERE id = ?', [id]);
    if (!userToDelete) {
      return res.status(404).json({ ok: false, msg: 'Usuario nao encontrado.' });
    }

    if (userToDelete.cargo_id === 1) {
      return res.status(400).json({ ok: false, msg: 'Nao e permitido excluir administradores.' });
    }

    await execute('UPDATE tarefas SET responsavel_id = NULL WHERE responsavel_id = ?', [id]);
    await execute('UPDATE tarefas SET criado_por = NULL WHERE criado_por = ?', [id]);
    await execute('UPDATE status_historico SET usuario_id = NULL WHERE usuario_id = ?', [id]);
    await execute('UPDATE atividades SET usuario_id = NULL, usuario_nome = "Usuario Excluido" WHERE usuario_id = ?', [id]);
    await execute('DELETE FROM usuarios WHERE id = ?', [id]);

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'EXCLUIR_USUARIO', 'usuarios', ?, ?)`,
      [requestingUserId, req.user.usuario, id, `Excluiu usuário: ${userToDelete.nome} (${userToDelete.usuario})`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[USERS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir usuario.' });
  }
});

export default router;