import { Router } from 'express';
import { query, execute } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const cargos = await query('SELECT * FROM cargos ORDER BY id');
    res.json({ ok: true, data: cargos });
  } catch (err) {
    console.error('[CARGOS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar cargos.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nome, cor } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ ok: false, msg: 'Nome do setor/cargo é obrigatório.' });

    const r = await execute('INSERT INTO cargos (nome, cor) VALUES (?, ?)', [nome.trim(), cor || '#888']);
    res.json({ ok: true, id: r.insertId });
  } catch (err) {
    console.error('[CARGOS] Create error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar setor/cargo.' });
  }
});

export default router;