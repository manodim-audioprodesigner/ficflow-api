import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { usuario_id, entidade, entidade_id, inicio, fim, limite } = req.query;

    let sql = 'SELECT * FROM atividades WHERE 1=1';
    const params = [];

    if (usuario_id) { sql += ' AND usuario_id = ?'; params.push(usuario_id); }
    if (entidade) { sql += ' AND entidade = ?'; params.push(entidade); }
    if (entidade_id) { sql += ' AND entidade_id = ?'; params.push(entidade_id); }
    if (inicio) { sql += ' AND criado_em >= ?'; params.push(inicio); }
    if (fim) { sql += ' AND criado_em <= ?'; params.push(fim); }

    sql += ' ORDER BY criado_em DESC';
    if (limite) { sql += ' LIMIT ?'; params.push(parseInt(limite)); }

    const atividades = await query(sql, params);
    res.json({ ok: true, data: atividades });
  } catch (err) {
    console.error('[ATIVIDADES] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar atividades.' });
  }
});

export default router;