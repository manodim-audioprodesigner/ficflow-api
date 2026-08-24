import { Router } from 'express';
import { query, getOne } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();

router.use(authenticateToken);

function cargoFilter(cargo, alias) {
  if (!cargo || cargo === 'Admin' || cargo === 'all') return { w: '', a: [] };
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
       ${cargo && cargo !== 'Admin' && cargo !== 'all' ? 'WHERE e.cargo_id = (SELECT id FROM cargos WHERE nome = ?)' : ''}
       GROUP BY e.id, e.nome, e.cor, e.ordem ORDER BY e.ordem`,
      cargo && cargo !== 'Admin' && cargo !== 'all' ? [cargo] : []
    );

    res.json({
      ok: true,
      data: {
        total: Number(total?.n || 0),
        travado: Number(travado?.n || 0),
        fazendo: Number(fazendo?.n || 0),
        pronto: Number(pronto?.n || 0),
        porEtapa: porEtapa.map(r => ({
          ...r,
          total: Number(r.total || 0),
          travado: Number(r.travado || 0),
          fazendo: Number(r.fazendo || 0),
          pronto: Number(r.pronto || 0)
        }))
      }
    });
  } catch (err) {
    console.error('[STATS] Dashboard error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar estatisticas.' });
  }
});

router.get('/director-overview', async (req, res) => {
  try {
    const ativosProg = await getOne("SELECT COUNT(*) n FROM programas WHERE status != 'Concluído'");
    const concluidosProg = await getOne("SELECT COUNT(*) n FROM programas WHERE status = 'Concluído'");
    const tarefasSemResp = await getOne("SELECT COUNT(*) n FROM tarefas WHERE responsavel_id IS NULL AND arquivado = 0 AND status != 2");
    
    res.json({
      ok: true,
      data: {
        ativosProg: Number(ativosProg?.n || 0),
        concluidosProg: Number(concluidosProg?.n || 0),
        tarefasSemResp: Number(tarefasSemResp?.n || 0)
      }
    });
  } catch (err) {
    console.error('[STATS] Director Overview error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar overview da direção.' });
  }
});

router.get('/por-setor', async (req, res) => {
  try {
    const data = await query(
      `SELECT c.id, c.nome, c.cor,
              COUNT(t.id) total,
              SUM(CASE WHEN t.status = 0 THEN 1 ELSE 0 END) travado,
              SUM(CASE WHEN t.status = 1 THEN 1 ELSE 0 END) fazendo,
              SUM(CASE WHEN t.status = 2 THEN 1 ELSE 0 END) pronto
       FROM cargos c
       LEFT JOIN pipeline_etapas e ON e.cargo_id = c.id
       LEFT JOIN tarefas t ON t.etapa_id = e.id AND t.arquivado = 0
       GROUP BY c.id, c.nome, c.cor ORDER BY c.nome`
    );
    res.json({
      ok: true,
      data: data.map(d => ({
        ...d,
        total: Number(d.total || 0),
        travado: Number(d.travado || 0),
        fazendo: Number(d.fazendo || 0),
        pronto: Number(d.pronto || 0)
      }))
    });
  } catch (err) {
    console.error('[STATS] Por setor error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar estatisticas por setor.' });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const { cargo, periodo } = req.query;
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
    const criadas = [0, 0, 0, 0, 0, 0, 0];
    const concluidas = [0, 0, 0, 0, 0, 0, 0];

    res.json({ ok: true, data: { labels, criadas, concluidas } });
  } catch (err) {
    console.error('[STATS] Timeline error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar timeline.' });
  }
});

router.get('/atividade', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const data = await query('SELECT * FROM atividades ORDER BY id DESC LIMIT ?', [limite]);
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[STATS] Atividade error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar atividades.' });
  }
});

router.get('/produtividade', async (req, res) => {
  try {
    const criadas = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(t.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN tarefas t ON t.criado_por = u.id AND t.arquivado = 0
       WHERE u.ativo = 1
       GROUP BY u.id, u.nome, u.cargo_id, c.nome, c.cor ORDER BY total DESC`
    );

    const concluidas = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(h.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN status_historico h ON h.usuario_id = u.id AND h.status_para = 2
       WHERE u.ativo = 1
       GROUP BY u.id, u.nome, u.cargo_id, c.nome, c.cor ORDER BY total DESC`
    );

    const fazendo = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(t.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN tarefas t ON t.responsavel_id = u.id AND t.status = 1 AND t.arquivado = 0
       WHERE u.ativo = 1
       GROUP BY u.id, u.nome, u.cargo_id, c.nome, c.cor ORDER BY total DESC`
    );

    const travadas = await query(
      `SELECT u.id, u.nome, u.cargo_id, c.nome AS cargo_nome, c.cor AS cargo_cor, COUNT(t.id) total
       FROM usuarios u
       JOIN cargos c ON c.id = u.cargo_id
       LEFT JOIN tarefas t ON t.responsavel_id = u.id AND t.status = 0 AND t.arquivado = 0
       WHERE u.ativo = 1
       GROUP BY u.id, u.nome, u.cargo_id, c.nome, c.cor ORDER BY total DESC`
    );

    res.json({
      ok: true,
      data: {
        criadas: criadas.map(x => ({ ...x, total: Number(x.total || 0) })),
        concluidas: concluidas.map(x => ({ ...x, total: Number(x.total || 0) })),
        fazendo: fazendo.map(x => ({ ...x, total: Number(x.total || 0) })),
        travadas: travadas.map(x => ({ ...x, total: Number(x.total || 0) }))
      }
    });
  } catch (err) {
    console.error('[STATS] Produtividade error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao buscar produtividade.' });
  }
});

export default router;