import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { etapa_id, categoria_id, status, busca } = req.query;
    
    let sql = `
      SELECT t.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.codigo AS etapa_codigo, e.ordem,
             c.nome AS categoria_nome, c.cor AS categoria_cor,
             u.nome AS responsavel_nome,
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
    const { status } = req.query;
    const userId = req.user.id;

    let sql = `
      SELECT t.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.codigo AS etapa_codigo, e.ordem,
             c.nome AS categoria_nome, c.cor AS categoria_cor
      FROM tarefas t
      JOIN pipeline_etapas e ON e.id = t.etapa_id
      LEFT JOIN categorias c ON c.id = t.categoria_id
      WHERE t.arquivado = 0 AND (t.responsavel_id = ? OR t.criado_por = ?)
    `;
    const params = [userId, userId];

    if (status !== undefined && status !== '') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.ordem, CASE t.prioridade WHEN 0 THEN 0 WHEN 1 THEN 1 ELSE 2 END, t.criado_em DESC';

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
              u.nome AS responsavel_nome,
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
    
    if (!titulo || !etapa_id) {
      return res.status(400).json({ ok: false, msg: 'Titulo e etapa sao obrigatorios.' });
    }

    const result = await execute(
      `INSERT INTO tarefas (titulo, cliente, idioma, nota, categoria_id, etapa_id, responsavel_id, prioridade, prazo, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titulo, cliente || null, idioma || null, nota || null, categoria_id || null, etapa_id, responsavel_id || null, prioridade || 2, prazo || null, req.user.id]
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
    const { id } = req.params;
    const { titulo, cliente, idioma, nota, categoria_id, etapa_id, responsavel_id, prioridade, prazo } = req.body;

    const old = await getOne('SELECT * FROM tarefas WHERE id = ?', [id]);
    if (!old) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    await execute(
      `UPDATE tarefas SET titulo=?, cliente=?, idioma=?, nota=?, categoria_id=?, etapa_id=?, responsavel_id=?, prioridade=?, prazo=?, atualizado_em=NOW() WHERE id=?`,
      [titulo, cliente || null, idioma || null, nota || null, categoria_id || null, etapa_id, responsavel_id || null, prioridade || 2, prazo || null, id]
    );

    const mudancas = [];
    if (old.titulo !== titulo) mudancas.push(`Titulo: ${old.titulo} → ${titulo}`);
    if (old.cliente !== (cliente || null)) mudancas.push(`Cliente: ${old.cliente || '-'} → ${cliente || '-'}`);
    if (old.idioma !== (idioma || null)) mudancas.push(`Idioma: ${old.idioma || '-'} → ${idioma || '-'}`);
    if (old.categoria_id !== (categoria_id || null)) mudancas.push('Categoria alterada');
    if (old.etapa_id !== parseInt(etapa_id)) mudancas.push('Etapa alterada');
    if (old.responsavel_id !== (responsavel_id || null)) mudancas.push('Responsavel alterado');
    if (old.prioridade !== (prioridade || 2)) mudancas.push(`Prioridade: ${old.prioridade} → ${prioridade || 2}`);

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'ATUALIZAR_TAREFA', 'tarefas', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Atualizou tarefa: ${mudancas.join('; ') || 'Sem alterações'}`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Update error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar tarefa.' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, observacao } = req.body;

    const tarefa = await getOne('SELECT status, etapa_id, titulo FROM tarefas WHERE id = ?', [id]);
    if (!tarefa) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    const oldStatus = tarefa.status;
    const statusLabels = { 0: 'Travado', 1: 'Fazendo', 2: 'Pronto' };

    if (status === 1) {
      await execute(
        'UPDATE tarefas SET status = ?, responsavel_id = ?, atualizado_em = NOW() WHERE id = ?',
        [status, req.user.id, id]
      );
    } else {
      await execute(
        'UPDATE tarefas SET status = ?, atualizado_em = NOW() WHERE id = ?',
        [status, id]
      );
    }

    await execute(
      `INSERT INTO status_historico (tarefa_id, etapa_id, status_de, status_para, usuario_id, observacao)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tarefa.etapa_id, oldStatus, status, req.user.id, observacao || null]
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'ALTERAR_STATUS', 'tarefas', ?, ?)`,
      [req.user.id, req.user.usuario, id, `${statusLabels[oldStatus] || oldStatus} → ${statusLabels[status] || status}: ${tarefa.titulo}${observacao ? ` (${observacao})` : ''}`]
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

    const tarefa = await getOne('SELECT etapa_id, status, titulo FROM tarefas WHERE id = ?', [id]);
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

    const etapaAntiga = await getOne('SELECT nome FROM pipeline_etapas WHERE id = ?', [tarefa.etapa_id]);

    await execute(
      'UPDATE tarefas SET etapa_id = ?, status = 0, atualizado_em = NOW() WHERE id = ?',
      [prox.id, id]
    );

    await execute(
      `INSERT INTO status_historico (tarefa_id, etapa_id, status_de, status_para, usuario_id, observacao)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [id, prox.id, tarefa.status, req.user.id, observacao || 'Avancou etapa']
    );

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'AVANCAR_ETAPA', 'tarefas', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Moveu "${tarefa.titulo}" de ${etapaAntiga?.nome} para ${prox.nome}${observacao ? ` (${observacao})` : ''}`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Avancar error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao avancar etapa.' });
  }
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
    const tarefa = await getOne('SELECT titulo FROM tarefas WHERE id = ?', [id]);
    
    await execute('UPDATE tarefas SET arquivado = 1 WHERE id = ?', [id]);

    if (tarefa) {
      await execute(
        `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
         VALUES (?, ?, 'ARQUIVAR_TAREFA', 'tarefas', ?, ?)`,
        [req.user.id, req.user.usuario, id, `Arquivou tarefa: ${tarefa.titulo}`]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Archive error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao arquivar tarefa.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tarefa = await getOne('SELECT criado_por, titulo FROM tarefas WHERE id = ?', [id]);
    
    if (!tarefa) {
      return res.status(404).json({ ok: false, msg: 'Tarefa nao encontrada.' });
    }

    const user = await getOne('SELECT cargo_id FROM usuarios WHERE id = ? AND ativo = 1', [req.user.id]);
    const ehAdmin = user && user.cargo_id === 1;

    if (!ehAdmin && tarefa.criado_por !== req.user.id) {
      return res.status(403).json({ ok: false, msg: 'Somente quem criou a tarefa ou o Administrador pode excluir.' });
    }

    await execute('DELETE FROM tarefas WHERE id = ?', [id]);

    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'EXCLUIR_TAREFA', 'tarefas', ?, ?)`,
      [req.user.id, req.user.usuario, id, `Excluiu tarefa: ${tarefa.titulo}`]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[TAREFAS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir tarefa.' });
  }
});

export default router;