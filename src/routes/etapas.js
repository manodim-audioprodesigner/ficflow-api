import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const etapas = await query(
      `SELECT e.*, c.nome AS cargo_nome, c.cor AS cargo_cor
       FROM pipeline_etapas e
       LEFT JOIN cargos c ON c.id = e.cargo_id
       WHERE e.id != 1
       ORDER BY e.ordem`
    );
    res.json({ ok: true, data: etapas });
  } catch (err) {
    console.error('[ETAPAS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar etapas.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { codigo, nome, ordem, cargo_id, categoria, cor } = req.body;
    const result = await execute(
      'INSERT INTO pipeline_etapas (codigo, nome, ordem, cargo_id, categoria, cor) VALUES (?, ?, ?, ?, ?, ?)',
      [codigo, nome, ordem, cargo_id || null, categoria, cor || '#666']
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'CRIAR_ETAPA', 'pipeline_etapas', ?, ?)`,
      [req.user.id, req.user.usuario, result.insertId, `Criou etapa: ${nome} (${codigo})`]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[ETAPAS] Create error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar etapa.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nome, ordem, cargo_id, categoria, cor } = req.body;

    await execute(
      'UPDATE pipeline_etapas SET codigo = ?, nome = ?, ordem = ?, cargo_id = ?, categoria = ?, cor = ? WHERE id = ?',
      [codigo, nome, ordem, cargo_id || null, categoria, cor, id]
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'ATUALIZAR_ETAPA', 'pipeline_etapas', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Atualizou etapa: ${nome} (${codigo})`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[ETAPAS] Update error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar etapa.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tarefasCount = await getOne('SELECT COUNT(*) as count FROM tarefas WHERE etapa_id = ?', [id]);
    if (tarefasCount.count > 0) {
      return res.status(400).json({ ok: false, msg: 'Existem tarefas nesta etapa.' });
    }

    const etapa = await getOne('SELECT nome FROM pipeline_etapas WHERE id = ?', [id]);
    await execute('DELETE FROM pipeline_etapas WHERE id = ?', [id]);

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'EXCLUIR_ETAPA', 'pipeline_etapas', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Excluiu etapa: ${etapa?.nome || id}`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[ETAPAS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir etapa.' });
  }
});

export default router;