import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { etapa_id, categoria_id, status, busca, cargo } = req.query;
    
    let sql = `
      SELECT t.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.codigo AS etapa_codigo, e.ordem,
             c.nome AS categoria_nome, c.cor AS categoria_cor,
             u.nome AS responsavel_nome, u.genero AS responsavel_genero,
             cr.nome AS criado_por_nome
      FROM tarefas t
      JOIN pipeline_etapas e ON e.id = t.etapa_id
      LEFT JOIN categorias c ON c.id = t.categoria_id
      LEFT JOIN usuarios u ON u.id = t.responsavel_id
      LEFT JOIN usuarios cr ON cr.id = t.criado_por
      WHERE t.arquivado = 0
    `;
    const params = [];

    if (etapa_id) { sql += ' AND t.etapa_id = ?'; params.push(etapa_id); }
    if (categoria_id) { sql += ' AND t.categoria_id = ?'; params.push(categoria_id); }
    if (status !== undefined && status !== '') { sql += ' AND t.status = ?'; params.push(status); }
    if (busca) {
      sql += ' AND (t.titulo LIKE ? OR t.cliente LIKE ? OR t.idioma LIKE ? OR t.nota LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    sql += ' ORDER BY e.ordem, CASE t.prioridade WHEN 0 THEN 0 WHEN 1 THEN 1 ELSE 2 END, t.criado_em DESC';

    const tarefas = await query(sql, params);
    res.json({ ok: true, data: tarefas });
  } catch (err) {
    console.error('[TAREFAS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar tarefas.' });
  }
});

router.get('/minhas', async (req, res) => {
  try {
    const { status, usuario_id } = req.query;
    const userId = usuario_id ? parseInt(usuario_id) : req.user.id;

    let sql = `
      SELECT t.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.codigo AS etapa_codigo, e.ordem,
             c.nome AS categoria_nome, c.cor AS categoria_cor,
             u.nome AS responsavel_nome, u.genero AS responsavel_genero
      FROM tarefas t
      JOIN pipeline_etapas e ON e.id = t.etapa_id
      LEFT JOIN categorias c ON c.id = t.categoria_id
      LEFT JOIN usuarios u ON u.id = t.responsavel_id
      WHERE t.arquivado = 0 AND (t.responsavel_id = ? OR t.criado_por = ?)
    `;
    const params = [userId, userId];

    if (status !== undefined && status !== '') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.ordem, t.prioridade DESC, t.criado_em DESC';

    const tarefas = await query(sql, params);
    res.json({ ok: true, data: tarefas });
  } catch (err) {
    console.error('[TAREFAS] Minhas error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar minhas tarefas.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tarefa = await getOne(
      `SELECT t.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.codigo AS etapa_codigo, e.ordem,
              c.nome AS categoria_nome, c.cor AS categoria_cor,
              u.nome AS responsavel_nome, u.genero AS responsavel_genero,
              cr.nome AS criado_por_nome
       FROM tarefas t
       JOIN pipeline_etapas e ON e.id = t.etapa_id
       LEFT JOIN categorias c ON c.id = t.categoria_id
       LEFT JOIN usuarios u ON u.id = t.responsavel_id
       LEFT JOIN usuarios cr ON cr.id = t.criado_por
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (!tarefa) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    res.json({ ok: true, data: tarefa });
  } catch (err) {
    console.error('[TAREFAS] Get error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar tarefa.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { titulo, cliente, idioma, nota, categoria_id, etapa_id, responsavel_id, prioridade, prazo } = req.body;
    const prioVal = (typeof prioridade === 'number') ? prioridade : (prioridade === 'Alta' ? 2 : (prioridade === 'Urgente' ? 3 : 1));
    
    if (!titulo || !etapa_id) {
      return res.status(400).json({ ok: false, msg: 'Titulo e etapa sao obrigatorios.' });
    }

    const result = await execute(
      `INSERT INTO tarefas (titulo, cliente, idioma, nota, categoria_id, etapa_id, responsavel_id, prioridade, prazo, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titulo, cliente || null, idioma || null, nota || null, categoria_id || null, etapa_id, responsavel_id || null, prioVal, prazo || null, req.user.id]
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'CRIAR_TAREFA', 'tarefas', ?, ?)`,
      [req.user.id, req.user.usuario, result.insertId, `Criou tarefa: ${titulo}`]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[TAREFAS] Create error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar tarefa.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = (rawId && rawId !== '[object Object]' && !isNaN(rawId)) ? parseInt(rawId) : (req.body.id ? parseInt(req.body.id) : null);
    if (!id) return res.status(400).json({ ok: false, msg: 'ID inválido.' });

    const { titulo, cliente, idioma, nota, categoria_id, etapa_id, responsavel_id, prioridade, prazo } = req.body;
    const prioVal = (typeof prioridade === 'number') ? prioridade : (prioridade === 'Alta' ? 2 : (prioridade === 'Urgente' ? 3 : 1));

    const old = await getOne('SELECT * FROM tarefas WHERE id = ?', [id]);
    if (!old) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    await execute(
      `UPDATE tarefas SET titulo=?, cliente=?, idioma=?, nota=?, categoria_id=?, etapa_id=?, responsavel_id=?, prioridade=?, prazo=?, atualizado_em=NOW() WHERE id=?`,
      [titulo || old.titulo, cliente !== undefined ? cliente : old.cliente, idioma !== undefined ? idioma : old.idioma, nota !== undefined ? nota : old.nota, categoria_id || old.categoria_id, etapa_id || old.etapa_id, responsavel_id !== undefined ? responsavel_id : old.responsavel_id, prioVal, prazo || old.prazo, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Update error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar tarefa.' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = (rawId && rawId !== '[object Object]' && !isNaN(rawId)) ? parseInt(rawId) : (req.body.id ? parseInt(req.body.id) : null);
    if (!id) return res.status(400).json({ ok: false, msg: 'ID inválido.' });

    const { status, observacao, usuario_id } = req.body;
    const userId = usuario_id ? parseInt(usuario_id) : req.user.id;

    const tarefa = await getOne('SELECT status, etapa_id, titulo FROM tarefas WHERE id = ?', [id]);
    if (!tarefa) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    const oldStatus = tarefa.status;
    const statusLabels = { 0: 'Travado', 1: 'Fazendo', 2: 'Pronto' };

    if (parseInt(status) === 1) {
      await execute(
        'UPDATE tarefas SET status = ?, responsavel_id = ?, atualizado_em = NOW(), status_atualizado_em = NOW() WHERE id = ?',
        [status, userId, id]
      );
    } else {
      await execute(
        'UPDATE tarefas SET status = ?, atualizado_em = NOW(), status_atualizado_em = NOW() WHERE id = ?',
        [status, id]
      );
    }

    await execute(
      `INSERT INTO status_historico (tarefa_id, etapa_id, status_de, status_para, usuario_id, observacao)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tarefa.etapa_id, oldStatus, status, userId, observacao || null]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Status error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao alterar status.' });
  }
});

router.post('/:id/avancar', async (req, res) => {
  try {
    const { id } = req.params;
    const { observacao } = req.body;

    const tarefa = await getOne('SELECT etapa_id, status, titulo, programa_id FROM tarefas WHERE id = ?', [id]);
    if (!tarefa) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    const prox = await getOne(
      'SELECT id, nome FROM pipeline_etapas WHERE ordem > (SELECT ordem FROM pipeline_etapas WHERE id = ?) ORDER BY ordem LIMIT 1',
      [tarefa.etapa_id]
    );
    if (!prox) {
      return res.status(400).json({ ok: false, msg: 'Nao ha proxima etapa.' });
    }

    await execute(
      'UPDATE tarefas SET etapa_id = ?, status = 0, atualizado_em = NOW() WHERE id = ?',
      [prox.id, id]
    );

    await execute(
      `INSERT INTO status_historico (tarefa_id, etapa_id, status_de, status_para, usuario_id, observacao)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [id, prox.id, tarefa.status, req.user.id, observacao || 'Avançou etapa']
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Avancar error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao avancar etapa.' });
  }
});

router.post('/:id/seen', async (req, res) => {
  try {
    const { id } = req.params;
    await execute('UPDATE tarefas SET seen_at = NOW() WHERE id = ? AND seen_at IS NULL', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: true });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    await execute('UPDATE tarefas SET status = 2, atualizado_em = NOW() WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao concluir tarefa.' });
  }
});

router.post('/:id/remanejar', async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id } = req.body;
    await execute('UPDATE tarefas SET responsavel_id = ?, atualizado_em = NOW() WHERE id = ?', [usuario_id || null, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao remanejar tarefa.' });
  }
});

router.post('/distribuir', async (req, res) => {
  res.json({ ok: true });
});

router.post('/rebalance', async (req, res) => {
  res.json({ ok: true });
});

router.get('/:id/historico', async (req, res) => {
  try {
    const historico = await query(
      `SELECT h.*, e.nome AS etapa_nome, u.nome AS usuario_nome
       FROM status_historico h
       JOIN pipeline_etapas e ON e.id = h.etapa_id
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.tarefa_id = ?
       ORDER BY h.criado_em DESC`,
      [req.params.id]
    );
    res.json({ ok: true, data: historico });
  } catch (err) {
    console.error('[TAREFAS] Historico error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar historico.' });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    await execute('UPDATE tarefas SET arquivado = 1 WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Archive error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao arquivar tarefa.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute('DELETE FROM tarefas WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir tarefa.' });
  }
});

export default router;