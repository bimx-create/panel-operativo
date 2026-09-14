(async function() {
  const KAM_ALIAS = {
    'ANAYELI': 'ANAYELY TAPIA',
    'ANAYELI TAPIA': 'ANAYELY TAPIA',
    'ANAYELY': 'ANAYELY TAPIA',
    'MARICARMEN': 'CLAUDIA',
    'MARICARMEN CASTILLO': 'CLAUDIA',
    'MARICARMEN CASTILLO PEREZ': 'CLAUDIA',
    'DAVID': 'DAVID SANTIAGO',
    'ALAIN': 'DR. ALAIN RAMÍREZ',
    'ALAIN RAMIREZ': 'DR. ALAIN RAMÍREZ',
    'DR ALAIN': 'DR. ALAIN RAMÍREZ',
    'DR. ALAIN': 'DR. ALAIN RAMÍREZ',
    'LIZETE': 'LIZETE GUADALUPE',
    'LIZETE GUADALUPE': 'LIZETE GUADALUPE',
    'LIZETH': 'LIZETE GUADALUPE',
    'LIZETH GUADALUPE': 'LIZETE GUADALUPE'
  };

  // Solo estos KAMs deben aparecer en el reporte — lista exacta
  const ALLOWED_KAMS = new Set([
    'ANAYELY TAPIA', 'CLAUDIA', 'DAVID SANTIAGO',
    'DR. ALAIN RAMÍREZ', 'LIZETE GUADALUPE', 'OSCAR RANGEL'
  ]);

  const KNOWN_KAMS = [...ALLOWED_KAMS]; // para inicializar semanas


  function normalizeKAM(k) {
    const upper = (k || '').trim().toUpperCase();
    return KAM_ALIAS[upper] || upper;
  }

  function getWeekString(date) {
    if (!date) return 'Desconocido';
    const d = new Date(date);
    if (isNaN(d)) return 'Desconocido';
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 1 - (d.getDay() || 7));
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `Semana del ${day}/${month}/${d.getFullYear()}`;
  }

  function getMonthString(date) {
    if (!date) return 'Desconocido';
    const d = new Date(date);
    if (isNaN(d)) return 'Desconocido';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const state = {
    medicos: [],
    seg_medicos: [],
    cotizaciones: [],
    seg_cotizaciones: [],
    loaded: { main: false, sanare: false, nomad: false }
  };

  function updateStatus() {
    const s = state.loaded;
    const all = s.main && s.sanare && s.nomad && s.cotizador30;
    const partial = s.main && s.sanare && s.nomad;
    if (all) {
      document.getElementById('statusBar').innerHTML =
        '<span class="status-chip ok">Sincronizado en tiempo real (4 fuentes)</span>';
      renderData();
    } else if (partial) {
      document.getElementById('statusBar').innerHTML =
        '<span class="status-chip ok" style="background:#f59e0b">Cargando cotizador 3.0...</span>';
      renderData();
    }
  }

  window.forceRefresh = () => renderData();
  document.getElementById('filtroMes').addEventListener('change', renderData);
  document.getElementById('filtroSemana').addEventListener('change', renderData);

  let theGroupedData = {};
  let currentChart = null;

  function processData() {
    const grouped = {};
    const months = new Set();
    const weeks = new Set();
    const globalKams = new Set(KNOWN_KAMS);

    const initKamData = () => ({
      med: 0, sMed: 0, cot: 0, sCot: 0, month: '',
      medList: [], sMedList: [], cotList: [], sCotList: []
    });

    const addMetric = (date, kam, metric, item) => {
      if (!date || isNaN(new Date(date))) return;
      const k = normalizeKAM(kam);
      if (!k || !ALLOWED_KAMS.has(k)) return; // solo KAMs de la lista exacta

      const w = getWeekString(date);
      const m = getMonthString(date);

      months.add(m);
      weeks.add(w);
      // no agregamos a globalKams porque ya está fija con KNOWN_KAMS

      if (!grouped[w]) grouped[w] = { dateForSort: new Date(date).getTime(), kams: {} };
      if (!grouped[w].kams[k]) {
        grouped[w].kams[k] = initKamData();
        grouped[w].kams[k].month = m;
      }

      const list = grouped[w].kams[k][metric + 'List'];

      // Deduplication logic
      let isDup = false;
      if (metric === 'med') {
        const nom = (item.Nombre || item.nombre || '').trim().toLowerCase();
        isDup = nom && list.some(x => (x.Nombre || x.nombre || '').trim().toLowerCase() === nom);
      } else if (metric === 'cot') {
        const nom = (item.medico || item.nombre || item.MEDICO || '').trim().toLowerCase();
        const pac = (item.paciente || item.nombrePaciente || item.PACIENTE || '').trim().toLowerCase();
        const mto = parseFloat((item.total || item.subtotal || item.monto || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
        isDup = nom && list.some(x => {
          const xNom = (x.medico || x.nombre || x.MEDICO || '').trim().toLowerCase();
          const xPac = (x.paciente || x.nombrePaciente || x.PACIENTE || '').trim().toLowerCase();
          const xMto = parseFloat((x.total || x.subtotal || x.monto || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
          return xNom === nom && xPac === pac && Math.abs(xMto - mto) < 1;
        });
      }

      if (!isDup) {
        grouped[w].kams[k][metric]++;
        list.push(item);
      }
    };

    state.medicos.forEach(m => {
      const d = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : m.createdAt;
      addMetric(d, m.kam || m['GERENTE/KAM'], 'med', m);
    });

    state.seg_medicos.forEach(s => {
      const d = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt;
      addMetric(d, s.kam, 'sMed', s);
    });

    state.cotizaciones.forEach(c => {
      const status = (c.estatusGlobal || c.estatus || c.status || '').toUpperCase();
      if (status.includes('CANCELADA') || status.includes('CANCELADO')) return;

      const d = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate() : (c.fecha || c.createdAt);
      addMetric(d, c.kam || c.KAM, 'cot', c);
    });

    state.seg_cotizaciones.forEach(s => {
      const status = (s.estatus || s.estado || '').toUpperCase();
      const obs = (s.comentario || s.comentarios || '').trim();
      
      // Si la cotización fue cancelada durante el seguimiento, SÍ cuenta como trabajo del KAM,
      // PERO SOLO si dejaron una observación (comentario).
      if ((status.includes('CANCELADA') || status.includes('CANCELADO')) && obs.length === 0) {
        return;
      }

      const d = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt;
      addMetric(d, s.kam, 'sCot', s);
    });

    // Ensure ALL known KAMs appear in every week (with 0s if no activity)
    for (const w in grouped) {
      for (const k of globalKams) {
        if (!grouped[w].kams[k]) grouped[w].kams[k] = initKamData();
      }
    }

    theGroupedData = grouped;
    return { grouped, months, weeks };
  }

  function renderData() {
    const { grouped, months } = processData();

    const fMes = document.getElementById('filtroMes');
    if (fMes.options.length === 1) {
      Array.from(months).sort().reverse().forEach(m => {
        if (!m) return;
        const opt = document.createElement('option');
        opt.value = m; opt.text = m; fMes.appendChild(opt);
      });
    }

    const fSemana = document.getElementById('filtroSemana');
    const selectedMes = fMes.value;

    const sortedWeeks = Object.keys(grouped).sort((a, b) => grouped[b].dateForSort - grouped[a].dateForSort);
    const validWeeks = sortedWeeks.filter(w =>
      selectedMes === 'all' || Object.values(grouped[w].kams).some(k => k.month === selectedMes)
    );

    const prevSel = fSemana.value;
    fSemana.innerHTML = '<option value="all">Seleccionar Semana...</option>';
    validWeeks.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w; opt.text = w;
      if (w === prevSel) opt.selected = true;
      fSemana.appendChild(opt);
    });
    if (fSemana.value === 'all' && validWeeks.length > 0) fSemana.value = validWeeks[0];

    // Sync Resumen selectors
    const fMesR = document.getElementById('filtroMesResumen');
    const fSemR = document.getElementById('filtroSemanaResumen');
    if (fMesR && fMesR.options.length <= 1) {
      fMesR.innerHTML = '<option value="all">Todos los meses</option>';
      Array.from(months).sort().reverse().forEach(m => {
        if (!m) return;
        const opt = document.createElement('option'); opt.value = m; opt.text = m; fMesR.appendChild(opt);
      });
    }
    if (fSemR) {
      const prevSelR = fSemR.value;
      fSemR.innerHTML = '<option value="all">Seleccionar Semana...</option>';
      validWeeks.forEach(w => {
        const opt = document.createElement('option'); opt.value = w; opt.text = w;
        if (w === prevSelR) opt.selected = true;
        fSemR.appendChild(opt);
      });
      if (fSemR.value === 'all' && validWeeks.length > 0) fSemR.value = validWeeks[0];
    }

    const selectedSemana = fSemana.value;
    const repContent = document.getElementById('repContent');

    if (selectedSemana === 'all' || !grouped[selectedSemana]) {
      repContent.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Selecciona una semana para ver el desglose.</div>';
      renderPodiumsAndChart({});
      return;
    }

    const kData = grouped[selectedSemana].kams;
    renderPodiumsAndChart(kData);
    
    // Resumen uses its own semana selector
    const fSemR2 = document.getElementById('filtroSemanaResumen');
    const semResumen = (fSemR2 && fSemR2.value !== 'all' && grouped[fSemR2.value]) ? fSemR2.value : selectedSemana;
    renderResumenDirectivo(grouped[semResumen].kams, semResumen);

    const kamKeys = Object.keys(kData).sort();
    let html = '<div class="kam-grid">';
    kamKeys.forEach(k => {
      const d = kData[k];
      const hasAction = d.med > 0 || d.sMed > 0 || d.cot > 0 || d.sCot > 0;
      const dotColor = hasAction ? '#0A6EBD' : '#ef4444';
      const alertHTML = hasAction ? '' : `
        <div style="margin-top:12px;font-size:11px;color:#ef4444;background:rgba(239,68,68,0.1);padding:8px 10px;border-radius:6px;line-height:1.5;">
          ⚠️ <strong>Sin actividad esta semana.</strong><br>
          Requiere prospectar nuevos médicos y generar cotizaciones.
        </div>`;

      html += `<div class="kam-card">
        <div class="kam-card-name"><div class="dot" style="background:${dotColor}"></div>${k}</div>
        <div class="kam-metrics">
          <div class="kam-metric" onclick="window.openDetails('${k}','med')">
            <div class="kam-metric-val blue">${d.med}</div>
            <div class="kam-metric-lbl">Nuevos Med</div>
          </div>
          <div class="kam-metric" onclick="window.openDetails('${k}','sMed')">
            <div class="kam-metric-val green">${d.sMed}</div>
            <div class="kam-metric-lbl">Seg. Med</div>
          </div>
          <div class="kam-metric" onclick="window.openDetails('${k}','cot')">
            <div class="kam-metric-val amber">${d.cot}</div>
            <div class="kam-metric-lbl">Nuevas Cot</div>
          </div>
          <div class="kam-metric" onclick="window.openDetails('${k}','sCot')">
            <div class="kam-metric-val purple">${d.sCot}</div>
            <div class="kam-metric-lbl">Seg. Cot</div>
          </div>
        </div>
        ${alertHTML}
      </div>`;
    });
    html += '</div>';
    repContent.innerHTML = html;
  }

  let iframeData = {
    sai: { montoTotal: 0, meta: 4000000, pctAvance: 0, faltante: 0, conteo: 0 },
    nomad: { cerradasMonto: 0, cerradasCount: 0 },
    romarico: { completo: 0, montoTotal: 0, totalCount: 0 }
  };

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SAI_UPDATE') {
      iframeData.sai = event.data.payload;
      const fSemR2 = document.getElementById('filtroSemanaResumen');
      const semResumen = (fSemR2 && fSemR2.value !== 'all' && theGroupedData[fSemR2.value]) ? fSemR2.value : document.getElementById('filtroSemana').value;
      if (theGroupedData[semResumen]) renderResumenDirectivo(theGroupedData[semResumen].kams, semResumen);
    } else if (event.data && event.data.type === 'NOMAD_UPDATE') {
      iframeData.nomad = event.data.payload;
      const fSemR2 = document.getElementById('filtroSemanaResumen');
      const semResumen = (fSemR2 && fSemR2.value !== 'all' && theGroupedData[fSemR2.value]) ? fSemR2.value : document.getElementById('filtroSemana').value;
      if (theGroupedData[semResumen]) renderResumenDirectivo(theGroupedData[semResumen].kams, semResumen);
    } else if (event.data && event.data.type === 'ROMARICO_UPDATE') {
      iframeData.romarico = event.data.payload;
      const fSemR2 = document.getElementById('filtroSemanaResumen');
      const semResumen = (fSemR2 && fSemR2.value !== 'all' && theGroupedData[fSemR2.value]) ? fSemR2.value : document.getElementById('filtroSemana').value;
      if (theGroupedData[semResumen]) renderResumenDirectivo(theGroupedData[semResumen].kams, semResumen);
    }
  });

  function generarDescripcionKam(kam, d) {
    const total = d.med + d.sMed + d.cot + d.sCot;
    if (total === 0) {
      return `<span style="color:#ef4444;font-weight:600;">Sin actividad.</span> El KAM no registró nuevos médicos, cotizaciones ni seguimientos. Se requiere reactivación urgente y plan de trabajo.`;
    }
    
    let txt = `Registró actividad con `;
    const hitos = [];
    if (d.med > 0) hitos.push(`<strong>${d.med}</strong> nuevos médicos`);
    if (d.sMed > 0) hitos.push(`<strong>${d.sMed}</strong> seguimientos a médicos`);
    if (d.cot > 0) hitos.push(`<strong>${d.cot}</strong> nuevas cotizaciones`);
    if (d.sCot > 0) hitos.push(`<strong>${d.sCot}</strong> seguimientos a cotizaciones`);
    
    txt += hitos.join(", ") + ". ";
    
    if (d.cot === 0 && d.sCot === 0) {
      txt += `<span style="color:#f59e0b;">Área de mejora:</span> Enfocarse en la generación y seguimiento de cotizaciones para materializar la prospección.`;
    } else if (d.sMed === 0 && d.sCot === 0) {
      txt += `<span style="color:#f59e0b;">Área de mejora:</span> Aumentar la retención mediante seguimientos. Se registró prospección pero falta dar continuidad.`;
    } else if (d.med === 0 && d.cot === 0) {
      txt += `<span style="color:#f59e0b;">Área de mejora:</span> Buscar nuevos prospectos. Hubo seguimiento a la cartera actual pero no expansión.`;
    } else {
      txt += `<span style="color:#22c55e;">Desempeño balanceado.</span> Mantuvo un buen ritmo entre prospección y seguimiento.`;
    }
    
    return txt;
  }

  function renderResumenDirectivo(kData, weekStr) {
    const container = document.getElementById('resumenDirectivoContent');
    if (!container) return;

    let kamsDesempeno = [];

    Object.keys(kData).sort().forEach(kam => {
      kamsDesempeno.push({
        nombre: kam,
        datos: kData[kam],
        descripcion: generarDescripcionKam(kam, kData[kam])
      });
    });

    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div class="panel" style="border-top: 4px solid #38bdf8;">
          <div class="panel-title" style="color: #38bdf8; display: flex; justify-content: space-between; align-items: center;">
            <span>🏥 SAI - Monto de Servicio (Mes)</span>
            <span style="font-size:12px; background:rgba(56,189,248,0.2); padding:3px 8px; border-radius:12px;">En vivo</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: #fff;">${fmt.format(iframeData.sai.montoTotal)}</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${iframeData.sai.conteo} registros facturados</div>
          
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
              <span>Meta mensual: ${fmt.format(iframeData.sai.meta)}</span>
              <span style="font-weight:600; color:${iframeData.sai.pctAvance >= 100 ? '#37d39a' : (iframeData.sai.pctAvance >= 50 ? '#f59e0b' : '#38bdf8')}">${iframeData.sai.pctAvance.toFixed(1)}%</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; margin-top: 6px; overflow: hidden;">
              <div style="background: ${iframeData.sai.pctAvance >= 100 ? '#37d39a' : (iframeData.sai.pctAvance >= 50 ? '#f59e0b' : '#38bdf8')}; height: 100%; width: ${Math.min(100, iframeData.sai.pctAvance)}%;"></div>
            </div>
          </div>
        </div>
        
        <div class="panel" style="border-top: 4px solid #a78bfa;">
          <div class="panel-title" style="color: #a78bfa; display: flex; justify-content: space-between; align-items: center;">
            <span>📑 NOMAD - Dashboard General</span>
            <span style="font-size:12px; background:rgba(167,139,250,0.2); padding:3px 8px; border-radius:12px;">Cerradas/Aceptadas</span>
          </div>
          <div style="font-size: 28px; font-weight: 800; color: #fff;">${fmt.format(iframeData.nomad.cerradasMonto)}</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${iframeData.nomad.cerradasCount} cotizaciones globales cerradas</div>
          
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
             <div style="font-size: 12px; color: #a78bfa; font-weight: 600; margin-bottom: 6px;">📋 Seguimiento Romarico (Facturables)</div>
             <div style="display: flex; justify-content: space-between; align-items: center;">
               <div>
                 <div style="font-size: 16px; font-weight: 700; color: #fff;">${fmt.format(iframeData.romarico.montoTotal)}</div>
                 <div style="font-size: 11px; color: #94a3b8;">${iframeData.romarico.completo} pacientes cerrados / ${iframeData.romarico.totalCount} totales</div>
               </div>
               <div style="font-size: 11px; text-align: right; color: #94a3b8;">
                  <div style="background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.3); padding: 3px 6px; border-radius: 6px; display: inline-block;">
                    Cierre: ${iframeData.romarico.totalCount ? ((iframeData.romarico.completo / iframeData.romarico.totalCount)*100).toFixed(1) : 0}%
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
      
      <div class="panel">
        <div class="panel-title" style="margin-bottom: 20px;">👥 Análisis Semanal KAM - ${weekStr}</div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
          ${kamsDesempeno.map(k => `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 8px;">
              <div style="font-weight: 700; font-size: 15px; color: #f1f5f9; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${(k.datos.med + k.datos.sMed + k.datos.cot + k.datos.sCot) > 0 ? '#22c55e' : '#ef4444'}"></div>
                ${k.nombre}
              </div>
              <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5; padding-left: 16px;">
                ${k.descripcion}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderPodiumsAndChart(kData) {
    const kams = Object.keys(kData);

    if (kams.length === 0) {
      document.getElementById('podiumMedicos').innerHTML = '<em style="color:#94a3b8;font-size:13px;">Sin datos</em>';
      document.getElementById('podiumCotizaciones').innerHTML = '<em style="color:#94a3b8;font-size:13px;">Sin datos</em>';
      if (currentChart) currentChart.destroy();
      return;
    }

    const renderPodium = (sortedList, metric, valueColor) => {
      const top = [...sortedList].sort((a, b) => kData[b][metric] - kData[a][metric]).slice(0, 3);
      return top.filter(k => kData[k][metric] > 0).map((k, i) => `
        <div class="podium-item">
          <div class="podium-rank rank-${i+1}">${['🥇','🥈','🥉'][i]}</div>
          <div class="podium-info"><div class="podium-name">${k}</div></div>
          <div class="podium-val" style="color:${valueColor}">${kData[k][metric]}</div>
        </div>`).join('') || '<em style="color:#94a3b8;font-size:13px;">Sin registros esta semana</em>';
    };

    document.getElementById('podiumMedicos').innerHTML = renderPodium(kams, 'med', '#22c55e');
    document.getElementById('podiumCotizaciones').innerHTML = renderPodium(kams, 'cot', '#f59e0b');

    const ctx = document.getElementById('chartKAMs').getContext('2d');
    if (currentChart) currentChart.destroy();
    const sortedKams = [...kams].sort();

    currentChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedKams,
        datasets: [
          { label: 'Nuevos Med', data: sortedKams.map(k => kData[k].med), backgroundColor: 'rgba(56,189,248,0.8)' },
          { label: 'Seg. Med', data: sortedKams.map(k => kData[k].sMed), backgroundColor: 'rgba(34,197,94,0.8)' },
          { label: 'Nuevas Cot', data: sortedKams.map(k => kData[k].cot), backgroundColor: 'rgba(245,158,11,0.8)' },
          { label: 'Seg. Cot', data: sortedKams.map(k => kData[k].sCot), backgroundColor: 'rgba(167,139,250,0.8)' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f1f5f9', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
      }
    });
  }

  window.openDetails = (kam, type) => {
    const selWeek = document.getElementById('filtroSemana').value;
    if (!theGroupedData[selWeek] || !theGroupedData[selWeek].kams[kam]) return;

    const d = theGroupedData[selWeek].kams[kam];
    const list = d[type + 'List'];
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    const titles = { med: 'Nuevos Médicos', sMed: 'Seguimientos a Médicos', cot: 'Nuevas Cotizaciones', sCot: 'Seguimientos en Cotizaciones' };
    document.getElementById('modalTitle').innerText = `${titles[type]} — ${kam}`;

    let html = '';
    if (list.length === 0) {
      html = '<div style="padding:30px;text-align:center;color:#94a3b8;">Sin registros para esta semana.</div>';
    } else if (type === 'med') {
      html = '<table class="detail-table"><tr><th>Fecha</th><th>Nombre</th><th>Especialidad</th><th>Hospital</th></tr>';
      list.forEach(m => {
        const dt = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleDateString('es-MX') : '';
        html += `<tr><td>${dt}</td><td style="font-weight:600;color:#38bdf8">${m.Nombre||m.nombre||'S/N'}</td><td>${m.Especialidad||m.especialidad||'—'}</td><td>${m.Hospital||m.hospital||'—'}</td></tr>`;
      });
      html += '</table>';
    } else if (type === 'sMed') {
      html = '<table class="detail-table"><tr><th>Fecha</th><th>Médico Ref</th><th>Estado</th><th>Comentario</th></tr>';
      list.forEach(s => {
        const dt = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate().toLocaleDateString('es-MX') : '';
        html += `<tr><td>${dt}</td><td>${s.medicoId||s.medico||'—'}</td><td><span class="badge badge-blue">${s.estado||'—'}</span></td><td>${s.comentarios||s.comentario||'—'}</td></tr>`;
      });
      html += '</table>';
    } else if (type === 'cot') {
      html = '<table class="detail-table"><tr><th>Fecha</th><th>Origen</th><th>Médico</th><th>Paciente</th><th>Monto</th></tr>';
      list.forEach(c => {
        const dt = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleDateString('es-MX') : (c.fecha||'');
        const mto = parseFloat((c.total||c.subtotal||c.monto||'0').toString().replace(/[^0-9.-]+/g,''))||0;
        const origen = (c._source || 'CRM/Local').toUpperCase();
        let bcolor = '#38bdf8';
        if (origen === 'SANARE') bcolor = '#22c55e';
        if (origen === 'NOMAD') bcolor = '#a78bfa';
        if (origen === 'COTIZADOR30') bcolor = '#f97316';
        const origenLabel = origen === 'COTIZADOR30' ? 'Sanaré 3.0' : origen;

        html += `<tr><td>${dt}</td><td><span class="badge" style="background:${bcolor};color:white;font-size:10px;">${origenLabel}</span></td><td style="font-weight:600;color:#f59e0b">${c.medico||c.nombre||c.MEDICO||'—'}</td><td>${c.paciente||c.nombrePaciente||c.PACIENTE||'—'}</td><td style="color:#22c55e;font-weight:700">${fmt.format(mto)}</td></tr>`;
      });
      html += '</table>';
    } else if (type === 'sCot') {
      html = '<table class="detail-table"><tr><th>Fecha</th><th>Ref</th><th>Estado</th><th>Comentario</th></tr>';
      list.forEach(s => {
        const dt = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate().toLocaleDateString('es-MX') : '';
        html += `<tr><td>${dt}</td><td>${s.cotizacionId||'—'}</td><td style="color:#a78bfa;font-weight:600">${s.estatus||'—'}</td><td>${s.comentario||s.comentarios||'—'}</td></tr>`;
      });
      html += '</table>';
    }

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('detailModal').style.display = 'flex';
  };

  // --- FIREBASE INIT ---
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getFirestore, collection, collectionGroup, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const appMain = initializeApp({
      apiKey: "AIzaSyAyksNhyRX-7QnZSOF27txNU-_SeMoOGps",
      authDomain: "crm-innvida-76e2e.firebaseapp.com",
      projectId: "crm-innvida-76e2e",
      storageBucket: "crm-innvida-76e2e.firebasestorage.app",
      messagingSenderId: "865341286325",
      appId: "1:865341286325:web:9fe061fa3c2c7fea4e9bfc"
    }, "mainCRM_Rep");
    const dbMain = getFirestore(appMain);

    // Seguimientos de Cotizaciones
    const appCotiza = initializeApp({
      apiKey: "AIzaSyDo3Leti8hcUDQpS7YAGI7VJLZEKuFjISM",
      authDomain: "directorio-cotizaciones-crm.firebaseapp.com",
      projectId: "directorio-cotizaciones-crm",
      storageBucket: "directorio-cotizaciones-crm.firebasestorage.app"
    }, "cotiza_Rep");
    const dbCotiza = getFirestore(appCotiza);

    const appSanare = initializeApp({
      apiKey: "AIzaSyAX1AA7tTnlnApVZlnnuMkB42k3W5IlwoM",
      authDomain: "sanare-cotizador.firebaseapp.com",
      projectId: "sanare-cotizador",
      storageBucket: "sanare-cotizador.firebasestorage.app"
    }, "sanareExt_Rep");
    const dbSanare = getFirestore(appSanare);

    const appNomad = initializeApp({
      apiKey: "AIzaSyDhtKZlWpHdhFcnVzWovB93bRSVRkC1sDI",
      authDomain: "cotizador-nomad.firebaseapp.com",
      projectId: "cotizador-nomad",
      storageBucket: "cotizador-nomad.firebasestorage.app"
    }, "nomadExt_Rep");
    const dbNomad = getFirestore(appNomad);

    onSnapshot(collection(dbMain, "medicos"), (snap) => {
      state.medicos = snap.docs.map(d => d.data());
      state.loaded.main = true;
      updateStatus();
    });

    onSnapshot(collectionGroup(dbMain, "seguimientos"), (snap) => {
      state.seg_medicos = snap.docs.map(d => d.data());
      updateStatus();
    });

    onSnapshot(collectionGroup(dbCotiza, "comentarios"), (snap) => {
      state.seg_cotizaciones = snap.docs.map(d => d.data());
      updateStatus();
    });


    onSnapshot(collection(dbSanare, "cotizaciones"), (snap) => {
      const cots = snap.docs.map(d => d.data());
      state.cotizaciones = state.cotizaciones.filter(c => c._source !== 'sanare')
        .concat(cots.map(c => ({ ...c, _source: 'sanare' })));
      state.loaded.sanare = true;
      updateStatus();
    });

    onSnapshot(collection(dbNomad, "cotizaciones"), (snap) => {
      const cots = snap.docs.map(d => d.data());
      state.cotizaciones = state.cotizaciones.filter(c => c._source !== 'nomad')
        .concat(cots.map(c => ({ ...c, _source: 'nomad' })));
      state.loaded.nomad = true;
      updateStatus();
    });

    // Cotizador 3.0 (cotizador-30)
    const appNuevo = initializeApp({
      apiKey: "AIzaSyCUFENXy1PE7Q6lX7c54F8hH3RjStM9Fdc",
      authDomain: "cotizador-30.firebaseapp.com",
      projectId: "cotizador-30",
      storageBucket: "cotizador-30.firebasestorage.app",
      messagingSenderId: "150005004914",
      appId: "1:150005004914:web:5b217c06aa13e34b9960eb"
    }, "cotizador30_Rep");
    const dbNuevo = getFirestore(appNuevo);

    onSnapshot(collection(dbNuevo, "cotizaciones"), (snap) => {
      const cots = snap.docs.map(d => {
        const data = d.data();
        // Normalizar campos del cotizador 3.0 al formato esperado
        const paciente = data.form ? data.form.paciente : (data.paciente || '');
        const medico   = data.form ? data.form.medico   : (data.medico   || '');
        // Calcular total si viene en items
        let total = data.total || 0;
        if (!total && data.state && Array.isArray(data.state.items)) {
          data.state.items.forEach(item => {
            const qty = item.qty || 1;
            const price = (item.innovador && item.innovador.BOLSILLO) ||
                          (item.patente   && item.patente.BOLSILLO)   ||
                          item.BOLSILLO || 0;
            total += parseFloat(price) * qty;
          });
        }
        return {
          ...data,
          paciente,
          medico,
          total,
          _source: 'cotizador30'
        };
      });
      state.cotizaciones = state.cotizaciones.filter(c => c._source !== 'cotizador30')
        .concat(cots);
      state.loaded.cotizador30 = true;
      updateStatus();
    });

    setTimeout(() => {
      if (window.COTIZACIONES_DATA) {
        const local = window.COTIZACIONES_DATA.map(c => ({
          kam: c.KAM, createdAt: c.FECHA || new Date(), _source: 'local', ...c
        }));
        state.cotizaciones = state.cotizaciones.filter(c => c._source !== 'local').concat(local);
        updateStatus();
      }
    }, 2000);

  } catch(e) {
    console.error("Error en Firebase:", e);
    document.getElementById('statusBar').innerHTML = '<span class="status-chip err">Error de conexión</span>';
  }

})();
