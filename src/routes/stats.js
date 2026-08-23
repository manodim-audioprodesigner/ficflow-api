import { Router } from 'express';
import { query, getOne } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();

router.use(authenticateToken);

function cargoFilter(cargo, alias) {
  if (!cargo || cargo === 'Admin') return { w: '', a: [] };
  return { w: `AND ${alias}.cargo_id = (SELECT id FROM cargos WHERE nome = ?)`, a: [cargo] };
}

router.get('/dashboard', async (req, res) => {
  try {
    const { cargo } = req.query;
    const { w, a } = cargoFilter(cargo, 'e');

    const total = await getOne(
      `SELECT COUNT(*) n FROM tarefas t JOIN pipeline_etapas e ON e.id = t.etapa_id WHERE t.arquivado = 0 ${w}`,
      a
    );
    const travado = await getOne(
      `SELECT COUNT(*) n FROM tarefas t JOIN pipeline_etapas e ON e.id = t.etapa_id WHERE t.arquivado = 0 AND t.status = 0 ${w}`,
      a
    );
    const fazendo = await getOne(
      `SELECT COUNT(*) n FROM tarefas t JOIN pipeline_etapas e ON e.id = t.etapa_id WHERE t.arquivado = 0 AND t.status = 1 ${w}`,
      a
    );
    const pronto = await getOne(
      `SELECT COUNT(*) n FROM tarefas t JOIN pipeline_etapas e ON e.id = t.etapa_id WHERE t.arquivado = 0 AND t.status = 2 ${w}`,
      a
    );
    const porEtapa = await query(
      `SELECT e.id, e.nome, e.cor,
              COUNT(t.id) total,
              SUM(CASE WHEN t.status = 0 THEN 1 ELSE 0 END) travado,
              SUM(CASE WHEN t.status = 1 THEN 1 ELSE 0 END) fazendo,
              SUM(CASE WHEN t.status = 2 THEN 1 ELSE 0 END) pronto
       FROM pipeline_etapas e
       LEFT JOIN tarefas t ON t.etapa_id = e.id AND t.arquivado = 0
       ${cargo && cargo !== 'Admin' ? 'WHERE e.cargo_id = (SELECT id FROM cargos WHERE nome = ?)' : ''}
       GROUP BY e.id ORDER BY e.ordem`,
      cargo && cargo !== 'Admin' ? [cargo] : []
    );

    res.json({
      ok: true,
      data: {
        total: total.n,
        travado: travado.n,
        fazendo: fazendo.n,
        pronto: pronto.n,
        porEtapa
      }
    });
  } catch (err) {
    console.error('[STATS] Dashboard error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar estatisticas.' });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const { cargo, periodo } = req.query;
    const hoje = new Date();
    const buckets = [];

    if (periodo === 'dia') {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(hoje.getTime() - i * 3600 * 1000);
        buckets.push({
          key: d.getHours().toString().padStart(2, '0') + 'h',
          inicio: new Date(d.getTime() - 3600 * 1000),
          fim: d
        });
      }
    } else if (periodo === 'semana') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const ini = new Date(d);
        const fim = new Date(d);
        fim.setDate(fim.getDate() + 1);
        buckets.push({
          key: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][d.getDay()] + ' ' + d.getDate(),
          inicio: ini,
          fim
        });
      }
    } else if (periodo === 'mes') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(hoje);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const ini = new Date(d);
        const fim = new Date(d);
        fim.setDate(fim.getDate() + 1);
        buckets.push({ key: `${d.getDate()}/${d.getMonth() + 1}`, inicio: ini, fim });
      }
    } else if (periodo === 'ano') {
      const nomesMes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        buckets.push({
          key: nomesMes[d.getMonth()] + ' ' + d.getFullYear(),
          inicio: new Date(d),
          fim: new Date(d.getFullYear(), d.getMonth() + 1, 1)
        });
      }
    } else {
      return res.json({ ok: true, data: { labels: [], criadas: [], concluidas: [] } });
    }

    const { w, a } = cargoFilter(cargo, 'e');
    const labels = [], criadas = [], concluidas = [];

    for (const b of buckets) {
      const iniStr = b.inicio.toISOString().slice(0, 19).replace('T', ' ');
      const fimStr = b.fim.toISOString().slice(0, 19).replace('T', ' ');
      const c = await getOne(
        `SELECT COUNT(*) n FROM tarefas t JOIN pipeline_etapas e ON e.id = t.etapa_id WHERE t.criado_em >= ? AND t.criado_em < ? ${w}`,
        [iniStr, fimStr, ...a]
      );
      const k = await getOne(
        `SELECT COUNT(*) n FROM status_historico h JOIN pipeline_etapas e ON e.id = h.etapa_id WHERE h.status_para = 2 AND h.criado_em >= ? AND h.criado_em < ? ${w}`,
        [iniStr, fimStr, ...a]
      );
      labels.push(b.key);
      criadas.push(c.n);
      concluidas.push(k.n);
    }

    res.json({ ok: true, data: { labels, criadas, concluidas } });
  } catch (err) {
    console.error('[STATS] Timeline error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar timeline.' });
  }
});

router.get('/por-setor', async (req, res) => {
  try {
    const { cargo } = req.query;
    const rows = await query(
      `SELECT c.nome, c.cor,
              COUNT(t.id) total,
              SUM(CASE WHEN t.status = 0 THEN 1 ELSE 0 END) travado,
              SUM(CASE WHEN t.status = 1 THEN 1 ELSE 0 END) fazendo,
              SUM(CASE WHEN t.status = 2 THEN 1 ELSE 0 END) pronto
       FROM cargos c
       LEFT JOIN pipeline_etapas e ON e.cargo_id = c.id
       LEFT JOIN tarefas t ON t.etapa_id = e.id AND t.arquivado = 0
       ${cargo && cargo !== 'Admin' ? 'WHERE c.nome = ?' : ''}
       GROUP BY c.id ORDER BY c.id`,
      cargo && cargo !== 'Admin' ? [cargo] : []
    );

    res.json({ ok: true, data: rows.filter(r => r.nome !== 'Admin' || cargo === 'Admin') });
  } catch (err) {
    console.error('[STATS] PorSetor error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar producao por setor.' });
  }
});

router.get('/atividade', async (req, res) => {
  try {
    const { cargo, limite } = req.query;
    const { w, a } = cargoFilter(cargo, 'e');

    const atividade = await query(
      `SELECT h.criado_em, u.nome AS usuario_nome, c.nome AS cargo_nome, c.cor AS cargo_cor,
              e.nome AS etapa_nome, t.titulo
       FROM status_historico h
       JOIN tarefas t ON t.id = h.tarefa_id
       JOIN pipeline_etapas e ON e.id = h.etapa_id
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       LEFT JOIN cargos c ON c.id = u.cargo_id
       WHERE h.status_para = 2 ${w}
       ORDER BY h.criado_em DESC LIMIT ?`,
      [...a, parseInt(limite) || 20]
    );

    res.json({ ok: true, data: atividade });
  } catch (err) {
    console.error('[STATS] Atividade error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar atividade.' });
  }
});

router.get('/produtividade', async (req, res) => {
  try {
    const { inicio, fim } = req.query;

    const criadas = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(t.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN tarefas t ON t.criado_por = u.id AND t.arquivado = 0
         ${inicio ? 'AND t.criado_em >= ?' : ''} ${fim ? 'AND t.criado_em <= ?' : ''}
       WHERE u.ativo = 1
       GROUP BY u.id ORDER BY total DESC`,
      [...(inicio ? [inicio] : []), ...(fim ? [fim] : [])]
    );

    const concluidas = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(h.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN status_historico h ON h.usuario_id = u.id AND h.status_para = 2
         ${inicio ? 'AND h.criado_em >= ?' : ''} ${fim ? 'AND h.criado_em <= ?' : ''}
       WHERE u.ativo = 1
       GROUP BY u.id ORDER BY total DESC`,
      [...(inicio ? [inicio] : []), ...(fim ? [fim] : [])]
    );

    const fazendo = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(t.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN tarefas t ON t.responsavel_id = u.id AND t.status = 1 AND t.arquivado = 0
       WHERE u.ativo = 1
       GROUP BY u.id ORDER BY total DESC`
    );

    const travadas = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(t.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN tarefas t ON t.responsavel_id = u.id AND t.status = 0 AND t.arquivado = 0
       WHERE u.ativo = 1
       GROUP BY u.id ORDER BY total DESC`
    );

    res.json({ ok: true, data: { criadas, concluidas, fazendo, travadas } });
  } catch (err) {
    console.error('[STATS] Produtividade error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar produtividade.' });
  }
});

export default router;