import { Router } from 'express';
import { query, getOne, execute } from '../db.js';
import { authenticateToken } from './auth.js';

const router = Router();
router.use(authenticateToken);

async function pickWorker(cargoName) {
  try {
    const users = await query(`
      SELECT u.id, u.nome, u.genero, u.short, u.teams, c.nome AS cargo_nome,
             (SELECT COUNT(*) FROM tarefas t WHERE t.responsavel_id=u.id AND t.status!=2 AND t.arquivado=0) AS load
      FROM usuarios u
      JOIN cargos c ON c.id=u.cargo_id
      WHERE u.ativo=1 AND u.level != 'director'
    `);

    const candidates = users.filter(u => {
      if (u.cargo_nome === cargoName) return true;
      let teams = [];
      try {
        teams = typeof u.teams === 'string' ? JSON.parse(u.teams) : (Array.isArray(u.teams) ? u.teams : []);
      } catch (e) {}
      return teams.includes(cargoName);
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => (Number(a.load) - Number(b.load)) || a.nome.localeCompare(b.nome));
    return candidates[0] || null;
  } catch (e) {
    return null;
  }
}

// Listar todos os programas com métricas
router.get('/', async (req, res) => {
  try {
    const { busca, status } = req.query;
    let sql = `
      SELECT p.*,
        (SELECT COUNT(*) FROM tarefas t WHERE t.programa_id=p.id AND t.arquivado=0) AS total_tarefas,
        (SELECT COUNT(*) FROM tarefas t WHERE t.programa_id=p.id AND t.status=2 AND t.arquivado=0) AS concluidas,
        (SELECT t.titulo FROM tarefas t WHERE t.programa_id=p.id AND t.status!=2 AND t.arquivado=0 ORDER BY t.id ASC LIMIT 1) AS tarefa_atual,
        (SELECT u.nome FROM tarefas t JOIN usuarios u ON u.id=t.responsavel_id WHERE t.programa_id=p.id AND t.status!=2 AND t.arquivado=0 ORDER BY t.id ASC LIMIT 1) AS responsavel_atual,
        (SELECT u.genero FROM tarefas t JOIN usuarios u ON u.id=t.responsavel_id WHERE t.programa_id=p.id AND t.status!=2 AND t.arquivado=0 ORDER BY t.id ASC LIMIT 1) AS responsavel_genero
      FROM programas p
      WHERE 1=1
    `;
    const params = [];
    if (busca) {
      sql += ' AND (p.nome LIKE ? OR p.codigo LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }
    if (status && status !== 'Todos') {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY p.criado_em DESC';

    const progs = await query(sql, params);
    const formatted = progs.map(p => {
      let expectedCount = 11;
      if (p.custom_flow) {
        try {
          const parsed = typeof p.custom_flow === 'string' ? JSON.parse(p.custom_flow) : p.custom_flow;
          if (Array.isArray(parsed) && parsed.length > 0) expectedCount = parsed.length;
        } catch (e) {}
      }
      const total = Number(p.total_tarefas) || 0;
      const done = Number(p.concluidas) || 0;
      const pct = total > 0 ? Math.round((done / expectedCount) * 100) : (p.status === 'Concluído' ? 100 : 0);
      return { ...p, progresso: Math.min(100, pct) };
    });

    res.json({ ok: true, data: formatted });
  } catch (err) {
    console.error('[PROGRAMS] List error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao listar programas.' });
  }
});

// Criar programa & gerar fluxo de tarefas
router.post('/', async (req, res) => {
  try {
    const { nome = 'SHOW DA FÉ', codigo, root, prioridade = 'Normal', steps, etapas, custom_flow, criado_por } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ ok: false, msg: 'Nome do programa é obrigatório.' });

    const code = codigo ? String(codigo).trim() : String(Date.now()).slice(-4);
    const rootPath = root || `\\\\SERVIDOR\\\\Dublagem\\\\${nome}\\\\${code}`;
    const stepsList = steps || etapas || (custom_flow ? (typeof custom_flow === 'string' ? JSON.parse(custom_flow) : custom_flow) : null);
    const flowJson = (stepsList && Array.isArray(stepsList) && stepsList.length > 0) ? JSON.stringify(stepsList) : null;
    const userId = criado_por || req.user.id;
    const prioVal = prioridade === 'Alta' ? 2 : (prioridade === 'Urgente' ? 3 : 1);

    const r = await execute(
      `INSERT INTO programas (nome, codigo, root, prioridade, status, custom_flow, criado_por)
       VALUES (?, ?, ?, ?, 'Em andamento', ?, ?)`,
      [nome.trim(), code, rootPath, prioVal, flowJson, userId]
    );
    const progId = r.insertId;

    // Se foram passadas etapas personalizadas
    if (stepsList && Array.isArray(stepsList) && stepsList.length > 0) {
      for (let i = 0; i < stepsList.length; i++) {
        const st = stepsList[i];
        let etapa = null;
        if (st.etapa_id) {
          etapa = await getOne('SELECT * FROM pipeline_etapas WHERE id=?', [st.etapa_id]);
        }
        if (!etapa) {
          const cargo = await getOne('SELECT id FROM cargos WHERE nome=?', [st.cargo || 'Editor de Video']);
          etapa = await getOne('SELECT * FROM pipeline_etapas WHERE cargo_id=? ORDER BY ordem ASC LIMIT 1', [cargo ? cargo.id : 1])
               || await getOne('SELECT * FROM pipeline_etapas ORDER BY ordem ASC LIMIT 1');
        }

        let workerId = st.responsavel_id || null;
        if (!workerId && i === 0) {
          const worker = await pickWorker(st.cargo || 'Editor de Video');
          if (worker) workerId = worker.id;
        }

        const folder = st.folder ? `${rootPath}\\${st.folder}` : `${rootPath}\\Etapa_${i+1}`;
        const stepLabel = st.label || (etapa ? etapa.nome : `Etapa ${i+1}`);
        const statusVal = 0; // Travado / Pendente

        await execute(
          `INSERT INTO tarefas (programa_id, titulo, cliente, etapa_id, responsavel_id, prioridade, folder, programa_nome, programa_codigo, status, criado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [progId, `${nome} ${code} — ${stepLabel}`, nome, etapa ? etapa.id : 1, workerId, prioVal, folder, nome, code, statusVal, userId]
        );
      }
    } else {
      // Fluxo Padrão das 11 etapas
      const allEtapas = await query('SELECT id, nome, codigo, ordem FROM pipeline_etapas ORDER BY ordem ASC');
      for (let i = 0; i < allEtapas.length; i++) {
        const et = allEtapas[i];
        let workerId = null;
        if (i === 0) {
          const worker = await pickWorker('Editor de Video');
          if (worker) workerId = worker.id;
        }
        const folder = `${rootPath}\\${et.codigo || `Etapa_${i+1}`}`;
        await execute(
          `INSERT INTO tarefas (programa_id, titulo, cliente, etapa_id, responsavel_id, prioridade, folder, programa_nome, programa_codigo, status, criado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [progId, `${nome} ${code} — ${et.nome}`, nome, et.id, workerId, prioVal, folder, nome, code, userId]
        );
      }
    }

    // Registra atividade
    await execute(
      `INSERT INTO atividades (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
       VALUES (?, ?, 'CRIAR_PROGRAMA', 'programas', ?, ?)`,
      [userId, req.user.nome || req.user.usuario, progId, `Cadastrou programa ${nome} ${code}`]
    );

    res.json({ ok: true, id: progId, code });
  } catch (err) {
    console.error('[PROGRAMS] Create error:', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar programa: ' + err.message });
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
