import { Router } from 'express';
import { query, execute } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

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

export default router;