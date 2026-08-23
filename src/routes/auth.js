import { Router } from 'express';
import { getOne, hashPin } from '../db.js';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ficflow-secret-change-in-production';
const JWT_EXPIRES = '8h';

router.post('/login', async (req, res) => {
  try {
    const { usuario, pin } = req.body;
    if (!usuario || !pin) {
      return res.status(400).json({ ok: false, msg: 'Informe usuario e PIN.' });
    }

    const user = await getOne(
      `SELECT u.*, c.nome AS cargo, c.cor AS cargo_cor
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       WHERE u.usuario = ? AND u.ativo = 1`,
      [usuario]
    );

    if (!user) {
      return res.status(401).json({ ok: false, msg: 'Usuario nao encontrado.' });
    }

    if (user.pin_hash !== hashPin(pin)) {
      return res.status(401).json({ ok: false, msg: 'PIN incorreto.' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, cargo: user.cargo, cargo_id: user.cargo_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        nome: user.nome,
        usuario: user.usuario,
        cargo: user.cargo,
        cargo_cor: user.cargo_cor,
        cargo_id: user.cargo_id
      }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ ok: false, msg: 'Erro interno do servidor.' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getOne(
      `SELECT u.id, u.nome, u.usuario, u.cargo_id, u.ativo, c.nome AS cargo, c.cor AS cargo_cor
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ ok: false, msg: 'Usuario nao encontrado.' });
    }

    res.json({ ok: true, user });
  } catch (err) {
    console.error('[AUTH] Me error:', err);
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ ok: false, msg: 'Token nao fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ ok: false, msg: 'Token invalido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (req.user.cargo_id !== 1) {
    return res.status(403).json({ ok: false, msg: 'Acesso restrito a administradores.' });
  }
  next();
}

export { JWT_SECRET };
export default router;