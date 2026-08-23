import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const categorias = await query('SELECT * FROM categorias ORDER BY nome');
    res.json({ ok: true, data: categorias });
  } catch (err) {
    console.error('[CATEGORIAS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar categorias.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nome, cor } = req.body;
    const result = await execute(
      'INSERT INTO categorias (nome, cor) VALUES (?, ?)',
      [nome, cor || '#666']
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'CRIAR_CATEGORIA', 'categorias', ?, ?)`,
      [req.user.id, req.user.usuario, result.insertId, `Criou categoria: ${nome}`]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[CATEGORIAS] Create error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar categoria.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cor } = req.body;

    await execute('UPDATE categorias SET nome = ?, cor = ? WHERE id = ?', [nome, cor, id]);

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'ATUALIZAR_CATEGORIA', 'categorias', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Atualizou categoria: ${nome}`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[CATEGORIAS] Update error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar categoria.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tarefasCount = await getOne('SELECT COUNT(*) as count FROM tarefas WHERE categoria_id = ?', [id]);
    if (tarefasCount.count > 0) {
      return res.status(400).json({ ok: false, msg: 'Existem tarefas vinculadas.' });
    }

    const cat = await getOne('SELECT nome FROM categorias WHERE id = ?', [id]);
    await execute('DELETE FROM categorias WHERE id = ?', [id]);

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'EXCLUIR_CATEGORIA', 'categorias', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Excluiu categoria: ${cat?.nome || id}`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[CATEGORIAS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir categoria.' });
  }
});

export default router;