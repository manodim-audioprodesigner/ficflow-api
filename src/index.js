import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import cargosRoutes from './routes/cargos.js';
import categoriasRoutes from './routes/categorias.js';
import etapasRoutes from './routes/etapas.js';
import tarefasRoutes from './routes/tarefas.js';
import statsRoutes from './routes/stats.js';
import atividadesRoutes from './routes/atividades.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Segurança
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Rate limit global
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'fic-flow-api', time: new Date().toISOString() });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/cargos', cargosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/etapas', etapasRoutes);
app.use('/api/tarefas', tarefasRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/atividades', atividadesRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, msg: 'Rota nao encontrada.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[API] Error:', err);
  res.status(500).json({ ok: false, msg: 'Erro interno do servidor.' });
});

import { initDb } from './db.js';

app.listen(PORT, async () => {
  console.log(`[FIC FLOW API] rodando na porta ${PORT}`);
  await initDb();
});