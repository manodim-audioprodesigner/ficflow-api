App.graficos = {};

App.graficos.render = async function (host) {
  host.innerHTML =
    '<div class="tab-bar">' +
      ['dia','semana','mes','ano'].map((p,i) => '<button class="tab '+(i===1?'active':'')+'" data-periodo="' + p + '">' + ({dia:'Dia (24h)',semana:'Semana (7d)',mes:'Mes (30d)',ano:'Ano (12m)'})[p] + '</button>').join('') +
    '</div>' +
    '<div class="kpi-row" id="kpi-row"></div>' +
    '<div class="graph-grid">' +
      '<div class="graph-card"><h3>Tarefas criadas vs concluidas</h3><div class="gc-sub">Evolucao no periodo selecionado</div><svg id="chart-line" viewBox="0 0 600 240" preserveAspectRatio="none"></svg><div class="legend"><div class="li"><span class="ld" style="background:#2ec4f1"></span>Criadas</div><div class="li"><span class="ld" style="background:#2ed573"></span>Concluidas</div></div></div>' +
      '<div class="graph-card"><h3>Concluidas por bucket</h3><div class="gc-sub">Volume de entregas por periodo</div><svg id="chart-bars" viewBox="0 0 600 240" preserveAspectRatio="none"></svg></div>' +
      '<div class="graph-card"><h3>Distribuicao por setor</h3><div class="gc-sub">Volume total de tarefas por cargo</div><svg id="chart-pie" viewBox="0 0 600 240" preserveAspectRatio="none"></svg></div>' +
      '<div class="graph-card"><h3>Atividade recente da equipe</h3><div class="gc-sub">Ultimas tarefas marcadas como pronto</div><div class="atv-list" id="atv-list"></div></div>' +
    '</div>';

  host.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    host.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    App.graficos.load(t.dataset.periodo);
  });

  App.graficos.load('semana');
};

App.graficos._periodoAtual = 'semana';

App.graficos.load = async function (periodo) {
  App.graficos._periodoAtual = periodo;
  const cargo = App.user.cargo;
  const [tl, setor, atv] = await Promise.all([
    App.stats.timeline(cargo, periodo),
    App.stats.porSetor(cargo),
    App.stats.atividade(cargo, 20)
  ]);

  // KPIs
  const concl = tl.concluidas.reduce((a,b)=>a+b,0);
  const criad = tl.criadas.reduce((a,b)=>a+b,0);
  const taxa = criad ? Math.round(concl/criad*100) : 0;
  const ultima = tl.concluidas[tl.concluidas.length-1] || 0;
  const penult = tl.concluidas[tl.concluidas.length-2] || 0;
  const trend = ultima - penult;
  document.getElementById('kpi-row').innerHTML =
    App.graficos.kpi('Criadas no periodo', criad, '#2ec4f1', '') +
    App.graficos.kpi('Concluidas no periodo', concl, '#2ed573', '') +
    App.graficos.kpi('Taxa de entrega', taxa + '%', '#7c5cff', '') +
    App.graficos.kpi('Ultimo bucket ' + tl.labels[tl.labels.length-1], ultima, '#ffd460', trend >= 0 ? ('▲ +' + trend) : ('▼ ' + trend), trend>=0);

  App.graficos.lineChart(document.getElementById('chart-line'), tl);
  App.graficos.barsChart(document.getElementById('chart-bars'), tl);
  App.graficos.pieChart(document.getElementById('chart-pie'), setor);
  App.graficos.atividade(document.getElementById('atv-list'), atv);
};

App.graficos.kpi = function (label, value, color, trend, up) {
  return '<div class="kpi"><div class="k-label">' + label + '</div>' +
    '<div class="k-value" style="color:' + color + '">' + value + '</div>' +
    (trend !== '' ? '<div class="k-trend ' + (up ? 'up' : 'down') + '">' + trend + ' vs anterior</div>' : '') +
    '</div>';
};

// GRAFICO DE LINHAS (criadas x concluidas)
App.graficos.lineChart = function (svg, tl) {
  const W = 600, H = 240, P = 32;
  const max = Math.max(1, ...tl.criadas, ...tl.concluidas);
  const n = tl.labels.length;
  const stepX = (W - 2*P) / Math.max(1, n - 1);
  function pts(arr) {
    return arr.map((v,i) => {
      const x = P + i * stepX;
      const y = H - P - (v / max) * (H - 2*P);
      return [x, y];
    });
  }
  function path(pts) { return pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '); }
  function areaPts(pts) {
    const first = pts[0], last = pts[pts.length-1];
    return path(pts) + ' L' + last[0] + ',' + (H-P) + ' L' + first[0] + ',' + (H-P) + ' Z';
  }
  const cP = pts(tl.criadas), kP = pts(tl.concluidas);
  // grid
  let grid = '';
  for (let i=0;i<=4;i++) { const y = P + i*(H-2*P)/4; grid += '<line x1="' + P + '" x2="' + (W-P) + '" y1="' + y + '" y2="' + y + '" stroke="#2a2f5c" stroke-width="1"/>'; }
  // areas
  let s = '<defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2ec4f1" stop-opacity=".35"/><stop offset="1" stop-color="#2ec4f1" stop-opacity="0"/></linearGradient><linearGradient id="gk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2ed573" stop-opacity=".35"/><stop offset="1" stop-color="#2ed573" stop-opacity="0"/></linearGradient></defs>';
  s += grid;
  s += '<path d="' + areaPts(cP) + '" fill="url(#gc)"/>';
  s += '<path d="' + areaPts(kP) + '" fill="url(#gk)"/>';
  s += '<path d="' + path(cP) + '" fill="none" stroke="#2ec4f1" stroke-width="2.5"/>';
  s += '<path d="' + path(kP) + '" fill="none" stroke="#2ed573" stroke-width="2.5"/>';
  // points
  cP.forEach(p => { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#2ec4f1"/>'; });
  kP.forEach(p => { s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#2ed573"/>'; });
  // x labels (sparse)
  const labelEvery = Math.ceil(n / 8);
  tl.labels.forEach((lab, i) => {
    if (i % labelEvery === 0 || i === n - 1) {
      const x = P + i * stepX;
      s += '<text x="' + x.toFixed(1) + '" y="' + (H - 10) + '" fill="#6c71a3" font-size="9" text-anchor="middle">' + lab + '</text>';
    }
  });
  // y labels
  for (let i=0;i<=4;i++) {
    const v = Math.round(max * (4-i)/4);
    const y = P + i*(H-2*P)/4 + 3;
    s += '<text x="4" y="' + y + '" fill="#6c71a3" font-size="9">' + v + '</text>';
  }
  svg.innerHTML = s;
};

// GRAFICO DE BARRAS (somente concluidas)
App.graficos.barsChart = function (svg, tl) {
  const W = 600, H = 240, P = 32;
  const max = Math.max(1, ...tl.concluidas);
  const n = tl.concluidas.length;
  const bw = (W - 2*P) / n * 0.7;
  const gap = (W - 2*P) / n * 0.3;
  let s = '';
  // grid
  for (let i=0;i<=4;i++) { const y = P + i*(H-2*P)/4; s += '<line x1="' + P + '" x2="' + (W-P) + '" y1="' + y + '" y2="' + y + '" stroke="#2a2f5c" stroke-width="1"/>'; }
  tl.concluidas.forEach((v, i) => {
    const x = P + i * ((W - 2*P) / n) + gap/2;
    const h = (v / max) * (H - 2*P);
    const y = H - P - h;
    s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="#2ed573"/>';
    if (v > 0) s += '<text x="' + (x + bw/2).toFixed(1) + '" y="' + (y - 3) + '" fill="#9aa0c7" font-size="9" text-anchor="middle">' + v + '</text>';
  });
  // x labels
  const labelEvery = Math.ceil(n / 8);
  tl.labels.forEach((lab, i) => {
    if (i % labelEvery === 0 || i === n - 1) {
      const x = P + i * ((W - 2*P) / n) + ((W - 2*P) / n)/2;
      s += '<text x="' + x.toFixed(1) + '" y="' + (H - 10) + '" fill="#6c71a3" font-size="9" text-anchor="middle">' + lab + '</text>';
    }
  });
  for (let i=0;i<=4;i++) {
    const v = Math.round(max * (4-i)/4);
    const y = P + i*(H-2*P)/4 + 3;
    s += '<text x="4" y="' + y + '" fill="#6c71a3" font-size="9">' + v + '</text>';
  }
  svg.innerHTML = s;
};

// GRAFICO DE PIZZA - Distribuicao por setor
App.graficos.pieChart = function (svg, setorData) {
  const W = 600, H = 240;
  const items = setorData.filter(s => s.nome !== 'Admin' && s.total > 0);
  if (items.length === 0) {
    svg.innerHTML = '<text x="' + (W/2) + '" y="' + (H/2) + '" fill="#6c71a3" font-size="13" text-anchor="middle">Sem dados</text>';
    return;
  }
  
  const cx = W / 2 - 100;
  const cy = H / 2;
  const r = 90;
  const total = items.reduce((acc, it) => acc + it.total, 0);
  
  let s_ = '';
  let startAngle = 0;
  
  items.forEach((it, i) => {
    const angle = (it.total / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = it.cor || ['#ff4757','#ff9f43','#2ed573','#1e90ff','#a29bfe','#fdcb6e','#00b894','#e84393'][i % 8];
    
    if (it.total === total) {
      s_ += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+color+'" stroke="#1f2343" stroke-width="2"/>';
    } else {
      s_ += '<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+largeArc+' 1 '+x2+' '+y2+' Z" fill="'+color+'" stroke="#1f2343" stroke-width="2"><title>'+App.utils.escape(it.nome)+': '+it.total+'</title></path>';
    }
    
    if (angle > 0.2) {
      const mx = cx + (r * 0.6) * Math.cos(startAngle + angle/2);
      const my = cy + (r * 0.6) * Math.sin(startAngle + angle/2);
      s_ += '<text x="'+mx+'" y="'+(my+4)+'" fill="#fff" font-size="11" text-anchor="middle" font-weight="700">'+it.total+'</text>';
    }
    
    startAngle = endAngle;
    
    const legX = W - 200;
    const legY = 20 + i * 16;
    if (i < 13) {
      s_ += '<rect x="'+legX+'" y="'+(legY-8)+'" width="10" height="10" fill="'+color+'" rx="2"/>';
      s_ += '<text x="'+(legX+16)+'" y="'+legY+'" fill="#9aa0c7" font-size="10">'+App.utils.escape(it.nome).substring(0, 25)+' ('+it.total+')</text>';
    } else if (i === 13) {
      s_ += '<text x="'+legX+'" y="'+legY+'" fill="#6c71a3" font-size="10">...e outros</text>';
    }
  });
  
  svg.innerHTML = s_;
};

// LISTA DE ATIVIDADE RECENTE
App.graficos.atividade = function (el, atv) {
  if (!atv || atv.length === 0) { el.innerHTML = '<div class="empty">Sem atividade recente.</div>'; return; }
  el.innerHTML = atv.map(a => {
    const cor = a.cargo_cor || '#666';
    return '<div class="atv-item">' +
      '<span class="ai-dot" style="background:' + cor + '"></span>' +
      '<span><b>' + App.utils.escape(a.usuario_nome || 'Desconhecido') + '</b> concluiu <b>' + App.utils.escape(a.titulo) + '</b> (' + App.utils.escape(a.etapa_nome) + ')</span>' +
      '<span class="ai-when">' + (a.criado_em || '') + '</span>' +
    '</div>';
  }).join('');
};
