import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();
router.use(authenticateToken);

// Listar todos os programas
router.get('/', async (req, res) => {
  try {
    const programs = await query('SELECT * FROM programas ORDER BY id DESC');
    res.json({ ok: true, data: programs });
  } catch (err) {
    console.error('[PROGRAMS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar programas.' });
  }
});

// Criar programa com fluxo customizado
router.post('/', async (req, res) => {
  try {
    const { nome, codigo, root, prioridade, custom_flow, etapas } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ ok: false, msg: 'Nome do programa é obrigatório.' });

    const flowJson = Array.isArray(etapas) ? JSON.stringify(etapas) : (custom_flow || null);
    const userId = req.user.id;

    const r = await execute(
      `INSERT INTO programas (nome, codigo, root, prioridade, status, custom_flow, criado_por)
       VALUES (?, ?, ?, ?, 'pendente', ?, ?)`,
      [nome.trim(), (codigo || '').trim().toUpperCase(), root || '', prioridade || 2, flowJson, userId]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (err) {
    console.error('[PROGRAMS] Create error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar programa.' });
  }
});

// Atualizar status do programa
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await execute('UPDATE programas SET status=? WHERE id=?', [status, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PROGRAMS] Update error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar programa.' });
  }
});

// Excluir programa
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await execute('DELETE FROM tarefas WHERE programa_id=?', [id]);
    await execute('DELETE FROM programas WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PROGRAMS] Delete error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao excluir programa.' });
  }
});

export default router;
