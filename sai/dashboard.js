// ============================================================
// Dashboard ejecutivo (SOLO ADMIN)
// ============================================================
let execUltimaData = null;

function obtenerColoresTema() {
  const estilos = getComputedStyle(document.documentElement);
  const esClaro = document.documentElement.getAttribute("data-theme") === "light";
  return {
    esClaro,
    muted: (estilos.getPropertyValue("--muted") || "#9fb0c8").trim(),
    grid: esClaro ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.14)",
    fondoPunto: esClaro ? "#ffffff" : "#0b1524",
    paleta: ["#4ea3ff", "#7c5cff", "#22d3ee", "#37d39a", "#ffb020", "#ff6b81", "#c084fc", "#5eead4"]
  };
}

function agruparSumaPorClave(rows, obtenerClave) {
  const mapa = new Map();
  rows.forEach(r => {
    const clave = obtenerClave(r);
    if (clave === null || clave === undefined || clave === "") return;
    const monto = Number(r.montoServicio) || 0;
    mapa.set(clave, (mapa.get(clave) || 0) + monto);
  });
  return mapa;
}

function claveMes(fechaISO) {
  if (!fechaISO) return null;
  return fechaISO.slice(0, 7); // YYYY-MM
}

function nombreMes(claveYYYYMM) {
  const [y, m] = claveYYYYMM.split("-");
  const fecha = new Date(Number(y), Number(m) - 1, 1);
  const texto = fecha.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ¿El campo "aseguradora y/o pago de bolsillo" indica pago de bolsillo?
function esPagoDeBolsillo(texto) {
  const t = normalizarEncabezado(texto);
  return !t || t.includes("bolsillo");
}

// ¿El campo "1º vez" indica paciente nuevo (vs subsecuente/recurrente)?
function esPacienteNuevo(texto) {
  const t = normalizarEncabezado(texto);
  return /1.*vez|^nuevo/.test(t);
}

// ============================================================
// TABS del dashboard ejecutivo (Resumen ejecutivo / Tabla dinámica)
// ============================================================
function initExecTabs() {
  const botones = document.querySelectorAll(".exec-tab-btn");
  if (!botones.length) return;
  botones.forEach(btn => {
    btn.addEventListener("click", () => {
      botones.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.execTab;
      $("execTabResumen").classList.toggle("hidden", tab !== "resumen");
      $("execTabPivot").classList.toggle("hidden", tab !== "pivot");
      if (tab === "pivot") { renderGridApartados($("apartadoBuscarCampo") ? $("apartadoBuscarCampo").value : ""); renderDetalleApartado(); }
    });
  });
}

function renderExecutiveDashboard(rows) {
  const panel = document.getElementById("panelDashboardAdmin");
  if (!panel) return;

  execUltimaData = rows || []; // todas las sedes (sin aplicar el filtro de sede)
  if (panel.classList.contains("hidden")) return; // solo se pinta si el perfil es admin

  // Filtro de sede seleccionado en la barra de filtros superior.
  // Afecta al ticket promedio/monto total, EXCEPTO: Sede líder y
  // Sede con mejor ticket promedio, que siempre comparan todas las sedes.
  const sedeFiltro = $("filtroSede") ? $("filtroSede").value : "";
  const rowsSedeFiltrada = sedeFiltro
    ? execUltimaData.filter(r => normalizarTexto(r.sede) === normalizarTexto(sedeFiltro))
    : execUltimaData;

  const rowsConMontoTodas = execUltimaData.filter(
    r => r.montoServicio !== null && r.montoServicio !== undefined && r.montoServicio !== ""
  );
  const rowsConMonto = rowsSedeFiltrada.filter(
    r => r.montoServicio !== null && r.montoServicio !== undefined && r.montoServicio !== ""
  );

  if ($("execActualizado")) {
    $("execActualizado").textContent = `Actualizado: ${new Date().toLocaleString("es-MX")}`;
  }

  // ---- KPI: monto total y ticket promedio (respeta el filtro de sede) ----
  const montoTotal = rowsConMonto.reduce((a, r) => a + (Number(r.montoServicio) || 0), 0);
  $("execMontoTotal").textContent = formatearMoneda(montoTotal);
  $("execMontoRegistros").textContent = `${rowsConMonto.length} registro(s) facturado(s)`;
  $("execTicketPromedio").textContent = formatearMoneda(rowsConMonto.length ? montoTotal / rowsConMonto.length : 0);

  // ---- Agrupado por sede (siempre con TODAS las sedes, para poder comparar) ----
  const porSede = agruparSumaPorClave(rowsConMontoTodas, r => r.sede);
  const sedesOrdenadas = Array.from(porSede.entries()).sort((a, b) => b[1] - a[1]);
  if (sedesOrdenadas.length) {
    $("execSedeLider").textContent = sedesOrdenadas[0][0];
    $("execSedeLiderMonto").textContent = formatearMoneda(sedesOrdenadas[0][1]);
  calcularUtilidadGlobal(rowsConMontoTodas);

  } else {
    $("execSedeLider").textContent = "—";
    $("execSedeLiderMonto").textContent = "$0";
  }

  // ---- Tendencia mensual (mes actual vs anterior) ----
  const porMes = agruparSumaPorClave(rowsConMonto, r => claveMes(r.fechaInfusion));
  const mesesOrdenados = Array.from(porMes.keys()).sort();
  const valoresMes = mesesOrdenados.map(m => porMes.get(m));

  // ---- Meta mensual (4M) ----
  const meta = 4000000;
  const pctAvance = (montoTotal / meta) * 100;
  $("execMetaAvance").textContent = `${pctAvance.toFixed(1)}%`;
  
  if (pctAvance >= 100) {
    $("execMetaAvance").style.color = "#37d39a"; // Verde
    $("execMetaBar").style.background = "#37d39a";
  } else if (pctAvance >= 50) {
    $("execMetaAvance").style.color = "#f59e0b"; // Naranja
    $("execMetaBar").style.background = "#f59e0b";
  } else {
    $("execMetaAvance").style.color = "#38bdf8"; // Azul
    $("execMetaBar").style.background = "#38bdf8";
  }
  
  const faltante = Math.max(0, meta - montoTotal);
  if (faltante > 0) {
    $("execMetaDetalle").textContent = `Faltan ${formatearMoneda(faltante)} para la meta`;
  } else {
    $("execMetaDetalle").textContent = `¡Meta superada por ${formatearMoneda(montoTotal - meta)}!`;
  }
  $("execMetaBar").style.width = `${Math.min(100, pctAvance)}%`;

  // Update Parent for Resumen Directivo
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'SAI_UPDATE',
        payload: {
          montoTotal: montoTotal,
          meta: meta,
          pctAvance: pctAvance,
          faltante: faltante,
          conteo: rowsConMonto.length
        }
      }, '*');
    }
  } catch(e) {}

  // ---- Origen del pago: aseguradora vs pago de bolsillo ----
  const montoBolsillo = rowsConMonto
    .filter(r => esPagoDeBolsillo(r.aseguradora))
    .reduce((a, r) => a + (Number(r.montoServicio) || 0), 0);
  const montoAseguradora = montoTotal - montoBolsillo;
  const pctAseguradora = montoTotal > 0 ? (montoAseguradora / montoTotal) * 100 : 0;
  const pctBolsillo = montoTotal > 0 ? (montoBolsillo / montoTotal) * 100 : 0;
  if ($("execOrigenPagoPct")) {
    if (montoTotal > 0) {
      const mayorEsAseguradora = montoAseguradora >= montoBolsillo;
      const pctMayor = mayorEsAseguradora ? pctAseguradora : pctBolsillo;
      const pctMenor = mayorEsAseguradora ? pctBolsillo : pctAseguradora;
      const montoMenor = mayorEsAseguradora ? montoBolsillo : montoAseguradora;
      const etiquetaMayor = mayorEsAseguradora ? "aseguradora" : "pago de bolsillo";
      const etiquetaMenor = mayorEsAseguradora ? "pago de bolsillo" : "aseguradora";

      $("execOrigenPagoPct").textContent = `${pctMayor.toFixed(0)}% ${etiquetaMayor}`;
      $("execOrigenPagoDetalle").textContent = `${pctMenor.toFixed(0)}% ${etiquetaMenor} (${formatearMoneda(montoMenor)})`;
    } else {
      $("execOrigenPagoPct").textContent = "—";
      $("execOrigenPagoDetalle").textContent = "Sin datos suficientes";
    }
  }

  // ---- Retención: pacientes nuevos vs recurrentes ----
  const nuevos = rowsConMonto.filter(r => esPacienteNuevo(r.primeraVez));
  const recurrentes = rowsConMonto.filter(r => !esPacienteNuevo(r.primeraVez));
  
  const montoNuevos = nuevos.reduce((a, r) => a + (Number(r.montoServicio) || 0), 0);
  const montoRecurrentes = recurrentes.reduce((a, r) => a + (Number(r.montoServicio) || 0), 0);
  
  if ($("execNuevosVol")) $("execNuevosVol").textContent = `${nuevos.length} pac`;
  if ($("execNuevosMonto")) $("execNuevosMonto").textContent = formatearMoneda(montoNuevos);
  
  if ($("execRecurrentesVol")) $("execRecurrentesVol").textContent = `${recurrentes.length} pac`;
  if ($("execRecurrentesMonto")) $("execRecurrentesMonto").textContent = formatearMoneda(montoRecurrentes);

  // ---- Ticket promedio por sede (siempre todas las sedes, para comparar) ----
  const conteoPorSede = new Map();
  rowsConMontoTodas.forEach(r => {
    if (!r.sede) return;
    conteoPorSede.set(r.sede, (conteoPorSede.get(r.sede) || 0) + 1);
  });
  const ticketPromedioPorSede = sedesOrdenadas.map(([sede, monto]) => [sede, conteoPorSede.get(sede) ? monto / conteoPorSede.get(sede) : 0]);
  const sedeMejorTicket = ticketPromedioPorSede.slice().sort((a, b) => b[1] - a[1])[0];
  if ($("execSedeMejorTicket")) {
    $("execSedeMejorTicket").textContent = sedeMejorTicket ? sedeMejorTicket[0] : "—";
    $("execSedeMejorTicketMonto").textContent = sedeMejorTicket ? `${formatearMoneda(sedeMejorTicket[1])} por registro` : "$0 por registro";
  }

  // Si la pestaña de dashboard interactivo está activa, la refrescamos también
  const tabPivot = $("execTabPivot");
  if (tabPivot && !tabPivot.classList.contains("hidden")) {
    renderGridApartados($("apartadoBuscarCampo") ? $("apartadoBuscarCampo").value : "");
    renderDetalleApartado();
  }
}

// ============================================================
// DASHBOARD INTERACTIVO — datos del concentrado
// (excluye Fecha Infusión, Semana, Subtotal, Iva, Monto del
// servicio y Notas, tal como se pidió)
//
// Cómo funciona: se genera una tarjeta por cada apartado de
// llenado. Al seleccionar una, se desglosa automáticamente en
// la visualización que mejor le queda (gráfica de barras,
// histograma o tabla clasificada si hay demasiados valores
// distintos), siempre con su tabla de datos y exportación a Excel.
// ============================================================
const APARTADOS = [
  { key: "folio", label: "Folio", icon: "🧾", tipo: "categorica" },
  { key: "marca", label: "Marca", icon: "🏷️", tipo: "categorica" },
  { key: "sede", label: "Sede", icon: "🏥", tipo: "categorica" },
  { key: "servicio", label: "Servicio", icon: "💉", tipo: "categorica" },
  { key: "horaCita", label: "Hora de Cita", icon: "🕐", tipo: "categorica" },
  { key: "horaIngreso", label: "Hora de Ingreso", icon: "🕑", tipo: "categorica" },
  { key: "horaSalida", label: "Hora de Salida", icon: "🕒", tipo: "categorica" },
  { key: "viaAcceso", label: "Vía de Acceso", icon: "🩸", tipo: "categorica" },
  { key: "tiempoInfusion", label: "Tiempo de Infusión", icon: "⏱️", tipo: "categorica" },
  { key: "ciclo", label: "Ciclo", icon: "🔄", tipo: "categorica" },
  { key: "numeroCiclos", label: "No. de Ciclos", icon: "🔢", tipo: "numerica" },
  { key: "delegacion", label: "Delegación de Origen", icon: "📍", tipo: "categorica" },
  { key: "edad", label: "Edad", icon: "🎂", tipo: "numerica", unidad: "años" },
  { key: "sexo", label: "Sexo", icon: "⚧", tipo: "categorica" },
  { key: "estatusPaciente", label: "Estatus de Paciente", icon: "✅", tipo: "categorica" },
  { key: "medicos", label: "Médicos", icon: "👨‍⚕️", tipo: "categorica" },
  { key: "tipoTratamiento", label: "Tipo de tratamiento", icon: "🧬", tipo: "categorica" },
  { key: "aseguradora", label: "Aseguradora y/o pago de bolsillo", icon: "💳", tipo: "categorica" },
  { key: "honorarioMedico", label: "Honorario médico", icon: "💰", tipo: "categorica" },
  { key: "primeraVez", label: "1º vez", icon: "🆕", tipo: "categorica" },
  { key: "tratamiento", label: "Tratamiento", icon: "🩺", tipo: "categorica" },
  { key: "diagnostico", label: "Diagnóstico", icon: "📋", tipo: "categorica" }
];

const UMBRAL_GRAFICA_BARRAS = 12; // hasta este número de valores distintos, se dibuja gráfica; más allá, tabla clasificada

let apartadoActivo = null;
let apartadoDetBuscarTexto = "";

function apartadoValorCelda(valor) {
  if (valor === null || valor === undefined || valor === "") return "SIN DATO";
  return String(valor).trim().toUpperCase() || "SIN DATO";
}

function apartadoFormatoNumero(valor, campo) {
  if (valor === null || valor === undefined || isNaN(valor)) return "—";
  if (campo.moneda) return formatearMoneda(valor);
  const redondeado = Math.round(valor * 10) / 10;
  const texto = redondeado.toLocaleString("es-MX");
  return campo.unidad ? `${texto} ${campo.unidad}` : texto;
}

function distribucionCategorica(rows, key) {
  const mapa = new Map();
  rows.forEach(r => {
    const val = apartadoValorCelda(r[key]);
    mapa.set(val, (mapa.get(val) || 0) + 1);
  });
  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
}

function estadisticasNumericas(rows, key) {
  const valores = rows
    .map(r => r[key])
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter(v => !isNaN(v));
  if (!valores.length) return null;
  const suma = valores.reduce((a, b) => a + b, 0);
  const ordenados = valores.slice().sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  const mediana = ordenados.length % 2 ? ordenados[medio] : (ordenados[medio - 1] + ordenados[medio]) / 2;
  return { valores, n: valores.length, suma, promedio: suma / valores.length, min: ordenados[0], max: ordenados[ordenados.length - 1], mediana };
}

function construirHistograma(valores, bins) {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (min === max) return [{ etiqueta: String(min), count: valores.length }];
  const ancho = (max - min) / bins;
  const cubetas = Array.from({ length: bins }, (_, i) => ({ desde: min + i * ancho, hasta: min + (i + 1) * ancho, count: 0 }));
  valores.forEach(v => {
    let idx = Math.floor((v - min) / ancho);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    cubetas[idx].count++;
  });
  return cubetas.map(c => ({
    etiqueta: `${Math.round(c.desde).toLocaleString("es-MX")}–${Math.round(c.hasta).toLocaleString("es-MX")}`,
    count: c.count
  }));
}

function renderGridApartados(filtroTexto) {
  const cont = $("apartadosGrid");
  if (!cont) return;

  const rows = (execUltimaData || []).filter(r => r.paciente);
  const q = normalizarTexto(filtroTexto || "");
  const colores = obtenerColoresTema();

  const campos = APARTADOS.filter(a => !q || normalizarTexto(a.label).includes(q));

  cont.innerHTML = campos.length
    ? campos.map(a => {
        let topLinea = "Sin datos", subLinea = "", mini = "";

        if (a.tipo === "numerica") {
          const stats = estadisticasNumericas(rows, a.key);
          if (stats) {
            topLinea = `Prom. ${apartadoFormatoNumero(stats.promedio, a)}`;
            subLinea = `Rango ${apartadoFormatoNumero(stats.min, a)} – ${apartadoFormatoNumero(stats.max, a)}`;
            const hist = construirHistograma(stats.valores, 6);
            const maxCount = Math.max(1, ...hist.map(h => h.count));
            mini = hist.map((h, i) => `<span style="height:${Math.max(10, (h.count / maxCount) * 100)}%; background:${colores.paleta[i % colores.paleta.length]}"></span>`).join("");
          }
        } else {
          const dist = distribucionCategorica(rows, a.key);
          if (dist.length) {
            const total = dist.reduce((s, [, c]) => s + c, 0);
            const [topVal, topCount] = dist[0];
            const pct = total ? Math.round((topCount / total) * 100) : 0;
            topLinea = topVal.length > 24 ? topVal.slice(0, 22) + "…" : topVal;
            subLinea = `${pct}% · ${dist.length} valor${dist.length === 1 ? "" : "es"} distinto${dist.length === 1 ? "" : "s"}`;
            const top4 = dist.slice(0, 4);
            const maxC = top4[0][1];
            mini = top4.map(([, c], i) => `<span style="height:${Math.max(10, (c / maxC) * 100)}%; background:${colores.paleta[i % colores.paleta.length]}"></span>`).join("");
          }
        }

        const activo = a.key === apartadoActivo ? " active" : "";
        return `
          <button type="button" class="apartado-card${activo}" data-campo="${a.key}">
            <div class="apartado-card-head">
              <span class="apartado-card-icon">${a.icon}</span>
              <span class="apartado-card-label">${escapeHtml(a.label)}</span>
            </div>
            <strong class="apartado-card-top">${escapeHtml(topLinea)}</strong>
            <small class="apartado-card-sub">${escapeHtml(subLinea)}</small>
            <div class="apartado-card-mini">${mini}</div>
          </button>`;
      }).join("")
    : `<p class="muted">No hay apartados que coincidan con la búsqueda.</p>`;

  cont.querySelectorAll(".apartado-card").forEach(btn => {
    btn.addEventListener("click", () => activarApartado(btn.dataset.campo));
  });
}

function activarApartado(key) {
  apartadoActivo = key;
  apartadoDetBuscarTexto = "";
  renderGridApartados($("apartadoBuscarCampo") ? $("apartadoBuscarCampo").value : "");
  renderDetalleApartado();
  const det = $("apartadoDetalle");
  if (det) det.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderDetalleApartado() {
  const cont = $("apartadoDetalle");
  if (!cont) return;

  if (!apartadoActivo) {
    cont.innerHTML = `<p class="muted apartado-vacio">Selecciona un apartado arriba para desglosarlo.</p>`;
    return;
  }

  const campo = APARTADOS.find(a => a.key === apartadoActivo);
  if (!campo) return;

  const rows = (execUltimaData || []).filter(r => r.paciente);
  const colores = obtenerColoresTema();

  let subtitulo = "";
  let bodyHtml = "";
  let tablaHeadHtml = "";
  let tablaFilasHtml = "";
  let mostrarBuscador = false;

  if (campo.tipo === "numerica") {
    const stats = estadisticasNumericas(rows, campo.key);
    if (!stats) {
      bodyHtml = `<p class="muted">No hay datos numéricos para este apartado.</p>`;
      subtitulo = "0 registros con dato";
    } else {
      subtitulo = `${stats.n} registro(s) con dato · Promedio ${apartadoFormatoNumero(stats.promedio, campo)} · Mediana ${apartadoFormatoNumero(stats.mediana, campo)}`;
      const hist = construirHistograma(stats.valores, 8);
      const maxCount = Math.max(1, ...hist.map(h => h.count));

      bodyHtml = `
        <div class="apartado-stats-row">
          <div class="apartado-stat"><span>Mínimo</span><strong>${apartadoFormatoNumero(stats.min, campo)}</strong></div>
          <div class="apartado-stat"><span>Máximo</span><strong>${apartadoFormatoNumero(stats.max, campo)}</strong></div>
          <div class="apartado-stat"><span>Promedio</span><strong>${apartadoFormatoNumero(stats.promedio, campo)}</strong></div>
          <div class="apartado-stat"><span>Mediana</span><strong>${apartadoFormatoNumero(stats.mediana, campo)}</strong></div>
          <div class="apartado-stat"><span>Suma</span><strong>${apartadoFormatoNumero(stats.suma, campo)}</strong></div>
        </div>
        <div class="apartado-bars">
          ${hist.map((h, i) => `
            <div class="apartado-bar-row">
              <span class="apartado-bar-label" title="${escapeHtml(h.etiqueta)}">${escapeHtml(h.etiqueta)}</span>
              <div class="apartado-bar-track"><div class="apartado-bar-fill" style="width:${Math.max(3, (h.count / maxCount) * 100)}%; background:${colores.paleta[i % colores.paleta.length]}"></div></div>
              <span class="apartado-bar-valor">${h.count}</span>
            </div>`).join("")}
        </div>`;

      tablaHeadHtml = `<thead><tr><th>Rango</th><th>Registros</th><th>%</th></tr></thead>`;
      tablaFilasHtml = hist.map(h => `<tr><td>${escapeHtml(h.etiqueta)}</td><td>${h.count}</td><td>${stats.n ? Math.round((h.count / stats.n) * 100) : 0}%</td></tr>`).join("");
    }
  } else {
    let dist = distribucionCategorica(rows, campo.key);
    const totalReg = dist.reduce((s, [, c]) => s + c, 0);
    mostrarBuscador = dist.length > UMBRAL_GRAFICA_BARRAS;

    if (apartadoDetBuscarTexto) {
      const q = normalizarTexto(apartadoDetBuscarTexto);
      dist = dist.filter(([v]) => normalizarTexto(v).includes(q));
    }

    subtitulo = `${totalReg} registro(s) analizado(s) · ${dist.length} valor(es) distinto(s)${apartadoDetBuscarTexto ? " (filtrado)" : ""}`;

    if (!dist.length) {
      bodyHtml = `<p class="muted">Sin resultados para ese filtro.</p>`;
    } else if (dist.length <= UMBRAL_GRAFICA_BARRAS) {
      const maxC = dist[0][1];
      bodyHtml = `
        <div class="apartado-bars">
          ${dist.map(([val, count], i) => `
            <div class="apartado-bar-row">
              <span class="apartado-bar-label" title="${escapeHtml(val)}">${escapeHtml(val)}</span>
              <div class="apartado-bar-track"><div class="apartado-bar-fill" style="width:${Math.max(3, (count / maxC) * 100)}%; background:${colores.paleta[i % colores.paleta.length]}"></div></div>
              <span class="apartado-bar-valor">${count} · ${totalReg ? Math.round((count / totalReg) * 100) : 0}%</span>
            </div>`).join("")}
        </div>`;
    } else {
      bodyHtml = `<p class="muted apartado-tabla-nota">Este apartado tiene muchos valores distintos: se muestra como tabla clasificada por frecuencia (usa el buscador para filtrar).</p>`;
    }

    tablaHeadHtml = `<thead><tr><th>${escapeHtml(campo.label)}</th><th>Registros</th><th>%</th></tr></thead>`;
    tablaFilasHtml = dist.map(([val, count]) => `<tr><td>${escapeHtml(val)}</td><td>${count}</td><td>${totalReg ? Math.round((count / totalReg) * 100) : 0}%</td></tr>`).join("");
  }

  cont.innerHTML = `
    <div class="apartado-detalle-head">
      <div>
        <span class="eyebrow">Desglose</span>
        <h3>${campo.icon} ${escapeHtml(campo.label)}</h3>
        <p class="muted">${subtitulo}</p>
      </div>
      <div class="apartado-detalle-actions">
        ${campo.tipo !== "numerica" ? `<input type="text" id="apartadoDetBuscar" placeholder="Filtrar valores..." value="${escapeHtml(apartadoDetBuscarTexto)}" />` : ""}
        <button type="button" id="btnApartadoExportar" class="btn btn-ghost">Exportar a Excel</button>
      </div>
    </div>
    <div class="apartado-detalle-body">
      ${bodyHtml}
      <div class="pivot-table-wrap apartado-table-wrap">
        <table class="pivot-table" id="apartadoTabla">${tablaHeadHtml}<tbody>${tablaFilasHtml}</tbody></table>
      </div>
    </div>`;

  const inputDet = $("apartadoDetBuscar");
  if (inputDet) {
    inputDet.addEventListener("input", () => {
      apartadoDetBuscarTexto = inputDet.value;
      const cursor = inputDet.selectionStart;
      renderDetalleApartado();
      const nuevoInput = $("apartadoDetBuscar");
      if (nuevoInput) {
        nuevoInput.focus();
        nuevoInput.setSelectionRange(cursor, cursor);
      }
    });
  }

  const btnExp = $("btnApartadoExportar");
  if (btnExp) btnExp.addEventListener("click", () => exportarApartadoAExcel(campo));
}

function exportarApartadoAExcel(campo) {
  const tabla = $("apartadoTabla");
  if (!tabla || !tabla.querySelector("tbody") || !tabla.querySelector("tbody").children.length) {
    showToast("No hay datos en este desglose para exportar.", "error");
    return;
  }
  if (typeof XLSX === "undefined") {
    showToast("No se pudo exportar: falta la librería XLSX.", "error");
    return;
  }
  const hoja = XLSX.utils.table_to_sheet(tabla);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, campo.label.slice(0, 28));
  const fechaHoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(libro, `desglose_${campo.key}_${fechaHoy}.xlsx`);
  showToast("Desglose exportado.", "success");
}

function initDashboardInteractivoEventos() {
  renderGridApartados("");
  renderDetalleApartado();

  const buscadorCampo = $("apartadoBuscarCampo");
  if (buscadorCampo) buscadorCampo.addEventListener("input", () => renderGridApartados(buscadorCampo.value));
}

document.addEventListener("DOMContentLoaded", () => {
  initExecTabs();
  initDashboardInteractivoEventos();
});

// Vuelve a pintar el dashboard interactivo con la paleta correcta al cambiar de tema
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      setTimeout(() => {
        const tabPivot = $("execTabPivot");
        if (execUltimaData && tabPivot && !tabPivot.classList.contains("hidden")) {
          renderGridApartados($("apartadoBuscarCampo") ? $("apartadoBuscarCampo").value : "");
          renderDetalleApartado();
        }
      }, 50);
    });
  });
});

window.renderExecutiveDashboard = renderExecutiveDashboard;


// ============================================================
// UTILIDAD POR SEDE - cruza paciente SAI con cotizaciones INNVIDA
// ============================================================
let _costosCache = null;

async function calcularUtilidadGlobal(rowsConMontoTodas) {
  try {
    // 1. Cargar catalogo de costos
    if (!_costosCache) {
      if (window.COSTOS_DATA) {
        _costosCache = window.COSTOS_DATA;
      } else {
        const resp = await fetch('../assets/costos.json');
        if (!resp.ok) throw new Error('No se pudo cargar costos.json');
        _costosCache = await resp.json();
      }
    }

    const catalogo = _costosCache['catalogo'] || [];

    // Solo filas con costo numerico real
    const catalogoFiltrado = catalogo.filter(function(row) {
      // row['__EMPTY_1'] es la Descripción, row['__EMPTY_2'] es el COSTO COMPRA
      var costo = parseFloat(row['__EMPTY_2']);
      return !isNaN(costo) && costo > 0;
    });

    // Normaliza texto: sin acentos, minusculas, sin espacios extra
    function norm(s) {
      return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
    }

    // Busca el costo unitario de un medicamento/servicio en el catalogo
    function buscarCostoItem(nombre) {
      var n = norm(nombre);
      if (!n || n.length < 3) return 0;

      // Buscar en el catálogo único (hoja 1)
      for (var i = 0; i < catalogoFiltrado.length; i++) {
        var c = catalogoFiltrado[i];
        var desc = norm(c['__EMPTY_1'] || '');
        if (desc && desc.length > 2 && (desc.includes(n) || n.includes(desc))) {
          return parseFloat(c['__EMPTY_2']) || 0;
        }
      }

      return 0;
    }

    // 2. Obtener cotizaciones del panel padre (enviadas via postMessage)
    var todasCotizaciones = window.cotizacionesDesdePadre || [];


    // Mapa de nombre-normalizado -> lista de cotizaciones para busqueda rapida
    var cotizacionesPorNombre = {};
    todasCotizaciones.forEach(function(c) {
      var p = norm(c.paciente || c.PACIENTE || c.nombrePaciente || '');
      if (!p) return;
      if (!cotizacionesPorNombre[p]) cotizacionesPorNombre[p] = [];
      cotizacionesPorNombre[p].push(c);
    });

    var matchCount = 0;
    var noMatchCount = 0;
    var utilidadTotal = 0;
    var utilidadPorSede = {};
    
    // Matriz para exportar Excel/CSV de justificacion
    var reporteCsvData = [
      ["Paciente", "Sede", "Monto Servicio", "Costo Medicamentos", "Costo Servicios", "Costo Total Calculado", "Utilidad (Monto - Costo)", "Detalle Medicamentos", "Detalle Servicios", "Cotizacion Encontrada"]
    ];

    // 3. Para cada registro del SAI, buscar su cotizacion y calcular utilidad
    rowsConMontoTodas.forEach(function(row) {
      var nomPac = norm(row.paciente);
      if (!nomPac) return;

      var montoServicio = parseFloat(row.montoServicio) || 0;
      if (!montoServicio) return;

      var sede = row.sede || 'Sin Sede';

      // Busqueda exacta primero
      var matches = cotizacionesPorNombre[nomPac] || [];

      // Si no hay match exacto, intentar busqueda parcial (nombre incompleto)
      if (!matches.length) {
        var parts = nomPac.split(' ').filter(function(p) { return p.length > 2; });
        if (parts.length >= 2) {
          var keys = Object.keys(cotizacionesPorNombre);
          for (var ki = 0; ki < keys.length; ki++) {
            var key = keys[ki];
            var matched = parts.every(function(p) { return key.includes(p); }) ||
                          key.split(' ').filter(function(p){ return p.length > 2; }).every(function(p) { return nomPac.includes(p); });
            if (matched) {
              matches = cotizacionesPorNombre[key];
              break;
            }
          }
        }
      }

      if (!matches.length) {
        noMatchCount++;
        // Registrar en CSV como NO MATCH
        reporteCsvData.push([row.paciente, sede, montoServicio, 0, 0, 0, montoServicio, "Ninguno", "Ninguno", "NO"]);
        return;
      }
      
      matchCount++;

      // ---- Obtener TODOS los conceptos de la cotización (maneja los 3 formatos) ----
      
      // Formato 1: Cotizador 3.0 → quote.state.items [{innovador:{...}, patente:{...}, qty}]
      // Formato 2: Sanaré       → quote.servicios + quote.medicamentos [{nombre, cantidad, subtotal}]  
      // Formato 3: Otro         → quote.items directos

      // Elegir la mejor cotización del match: preferir cotizador 3.0, luego genérico, luego la primera
      var quote = null;
      for (var qi = 0; qi < matches.length; qi++) {
        if (matches[qi].state && Array.isArray(matches[qi].state.items) && matches[qi].state.items.length > 0) { quote = matches[qi]; break; }
      }
      if (!quote) {
        for (var qi2 = 0; qi2 < matches.length; qi2++) {
          if ((Array.isArray(matches[qi2].servicios) && matches[qi2].servicios.length > 0) ||
              (Array.isArray(matches[qi2].medicamentos) && matches[qi2].medicamentos.length > 0)) { quote = matches[qi2]; break; }
        }
      }
      if (!quote) { for (var qi3 = 0; qi3 < matches.length; qi3++) { if (Array.isArray(matches[qi3].items) && matches[qi3].items.length > 0) { quote = matches[qi3]; break; } } }
      if (!quote) quote = matches[0];

      var conceptos = []; // Cada elemento: { nombre, qty, precioVenta }
      
      // LOG DIAGNÓSTICO: Mostrar estructura real del primer match (quitar en producción)
      if (matchCount === 1) {
        console.log('[DIAGNÓSTICO] Primer quote para:', row.paciente, '| _source:', quote._source);
        console.log('[DIAGNÓSTICO] quote keys:', Object.keys(quote));
        if (quote.state && quote.state.items && quote.state.items[0]) {
          console.log('[DIAGNÓSTICO] state.items[0]:', JSON.stringify(quote.state.items[0]).substring(0, 300));
        }
        if (quote.servicios && quote.servicios[0]) {
          console.log('[DIAGNÓSTICO] servicios[0]:', JSON.stringify(quote.servicios[0]).substring(0, 300));
        }
        if (quote.medicamentos && quote.medicamentos[0]) {
          console.log('[DIAGNÓSTICO] medicamentos[0]:', JSON.stringify(quote.medicamentos[0]).substring(0, 300));
        }
      }


      function extraeNombre(item) {
        var n = item.nombre || item.name || item.descripcion || item.concepto || item.ESQUEMA || item.esquema || item.pa || item.servicio || '';
        if (!n && item.bio) n = item.bio.PA || item.bio['NOMBRE COMERCIAL'] || item.bio.DESCRIPCION || item.bio.descripcion || '';
        if (!n && item.innovador) n = item.innovador.nombre || item.innovador.name || item.innovador.descripcion || '';
        if (!n && item.patente) n = item.patente.nombre || item.patente.name || item.patente.descripcion || '';
        if (!n && item.generico) n = item.generico.nombre || item.generico.name || item.generico.descripcion || '';
        return String(n).trim();
      }

      function cleanNum(v) {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        var p = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
        return isNaN(p) ? 0 : p;
      }

      if (quote.state && Array.isArray(quote.state.items) && quote.state.items.length > 0) {
        // Cotizador 3.0
        quote.state.items.forEach(function(item) {
          var nombre = extraeNombre(item);
          var qty = cleanNum(item.qty || item.cant || item.cantidad || 1);
          
          var subObj = item.innovador || item.patente || item.generico || item;
          var precioVenta = cleanNum(subObj.BOLSILLO || subObj.bolsillo || item.BOLSILLO || item.bolsillo || 0);

          if (!nombre) nombre = 'Item sin nombre: ' + JSON.stringify(item).substring(0, 100);
          
          var tipo = (item.type === 'med' || item.pa || item.bio) ? 'med' : 'serv';
          conceptos.push({ nombre: nombre, qty: qty, precioVenta: precioVenta, tipo: tipo });
        });
      } else if ((Array.isArray(quote.servicios) && quote.servicios.length > 0) || 
                 (Array.isArray(quote.medicamentos) && quote.medicamentos.length > 0)) {
        // Sanaré: tiene servicios y medicamentos como arrays separados
        var srvs = quote.servicios || [];
        srvs.forEach(function(item) {
          var nombre = extraeNombre(item) || item.prueba || '';
          if (!nombre) nombre = JSON.stringify(item).substring(0, 100);
          var qty = cleanNum(item.cantidad || item.cant || 1);
          var precioVenta = cleanNum(item.subtotal || item.total || item.precio || 0);
          conceptos.push({ nombre: nombre, qty: qty, precioVenta: precioVenta, tipo: 'serv' });
        });

        var meds = quote.medicamentos || [];
        meds.forEach(function(item) {
          var nombre = extraeNombre(item);
          if (!nombre) nombre = JSON.stringify(item).substring(0, 100);
          var qty = cleanNum(item.cantidad || item.cant || 1);
          var precioVenta = cleanNum(item.subtotal || item.total || item.precio || 0);
          conceptos.push({ nombre: nombre, qty: qty, precioVenta: precioVenta, tipo: 'med' });
        });
      } else if (Array.isArray(quote.items) && quote.items.length > 0) {
        // Formato genérico
        quote.items.forEach(function(item) {
          var nombre = extraeNombre(item);
          var qty = cleanNum(item.cantidad || item.qty || item.cant || 1);
          var precioVenta = cleanNum(item.subtotal || item.precio || item.total || 0);
          if (!nombre) nombre = JSON.stringify(item).substring(0, 100);
          
          var tipo = (item.type === 'med' || item.pa || nombre.toLowerCase().includes('mg') || nombre.toLowerCase().includes('ml')) ? 'med' : 'serv';
          conceptos.push({ nombre: nombre, qty: qty, precioVenta: precioVenta, tipo: tipo });
        });
      }

      // ---- Calcular costo real cruzando cada concepto con el catálogo de costos ----
      var costoMeds = 0;
      var costoServs = 0;
      var descMeds = [];
      var descServs = [];
      
      if (conceptos.length > 0) {
        conceptos.forEach(function(c) {
          var costoCatalogo = buscarCostoItem(c.nombre);
          var costoFila = costoCatalogo * c.qty;
          var detalleText = c.nombre + ' | Costo Cat: $' + costoCatalogo.toFixed(2) + ' x ' + c.qty;
          
          if (c.tipo === 'med') {
            costoMeds += costoFila;
            descMeds.push(detalleText);
          } else {
            costoServs += costoFila;
            descServs.push(detalleText);
          }
        });
      } else {
        // Sin items detallados: buscar por nombre del tratamiento del registro SAI
        var esqNom = norm(row.tratamiento || row.servicio || row.esquema || '');
        if (esqNom) {
          costoServs = buscarCostoItem(esqNom);
          descServs.push("Esquema SAI: " + (row.tratamiento || row.servicio || row.esquema) + " (Costo: $" + costoServs + ")");
        } else {
          descServs.push("Sin items detallados ni esquema");
        }
      }

      var costoRealTotal = costoMeds + costoServs;
      var utilRow = montoServicio - costoRealTotal;
      utilidadTotal += utilRow;
      utilidadPorSede[sede] = (utilidadPorSede[sede] || 0) + utilRow;

      reporteCsvData.push([
        row.paciente, 
        sede, 
        montoServicio.toFixed(2), 
        costoMeds.toFixed(2),
        costoServs.toFixed(2),
        costoRealTotal.toFixed(2), 
        utilRow.toFixed(2), 
        descMeds.join(" || ") || "Ninguno", 
        descServs.join(" || ") || "Ninguno", 
        "SI"
      ]);
    });

    // Crear contenido CSV
    var csvContent = reporteCsvData.map(function(e) { return e.map(function(cel) { return '"' + String(cel).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
    // Crear un Blob y generar un Data URL
    var blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    var csvUrl = URL.createObjectURL(blob);

    // 4. Actualizar el DOM
    var totalEl = document.getElementById('execUtilidadTotal');
    var sedesEl = document.getElementById('execUtilidadSedes');

    if (totalEl) {
      totalEl.textContent = formatearMoneda(utilidadTotal);
      totalEl.style.color = utilidadTotal >= 0 ? '#22c55e' : '#ef4444';
      
      // Inyectar el boton de descarga junto al titulo
      var parentArticle = totalEl.closest('article');
      if (parentArticle) {
        var existingBtn = parentArticle.querySelector('#btnDescargarUtilidad');
        if (existingBtn) existingBtn.remove();
        
        var btnHTML = '<a id="btnDescargarUtilidad" href="' + csvUrl + '" download="Justificacion_Utilidad.csv" style="display:block; margin-top:8px; font-size:12px; color:#3b82f6; text-decoration:underline; cursor:pointer;">📥 Descargar reporte de cálculo</a>';
        totalEl.insertAdjacentHTML('afterend', btnHTML);
      }
    }
    if (sedesEl) {
      if (todasCotizaciones.length === 0) {
        sedesEl.textContent = 'Panel INNVIDA sin datos aun (recarga en unos segundos)';
        sedesEl.style.color = '#f59e0b';
      } else {
        var sedesEntries = Object.entries(utilidadPorSede)
          .filter(function(pair) { return pair[1] !== 0; })
          .sort(function(a, b) { return b[1] - a[1]; });

        if (sedesEntries.length > 0) {
          sedesEl.textContent = sedesEntries.map(function(pair) {
            return pair[0] + ': ' + formatearMoneda(pair[1]);
          }).join(' | ');
          sedesEl.style.color = '';
        } else if (matchCount === 0) {
          sedesEl.textContent = 'Sin coincidencias de pacientes (' + todasCotizaciones.length + ' cotizaciones cargadas)';
          sedesEl.style.color = '#f59e0b';
        } else {
          sedesEl.textContent = matchCount + ' pacientes cruzados, costo no encontrado en catalogo';
          sedesEl.style.color = '#f59e0b';
        }
      }
    }

    console.log('[Utilidad] Cotizaciones cargadas:', todasCotizaciones.length, '| Matches:', matchCount, '| Sin match:', noMatchCount);

  } catch (err) {
    console.error('[Utilidad] Error:', err);
    var el = document.getElementById('execUtilidadSedes');
    if (el) el.textContent = 'Error: ' + err.message;
  }
}

// Listener para recibir datos de cotizaciones del padre (resuelve CORS en local)
window.cotizacionesDesdePadre = [];
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'INNVIDA_COTIZACIONES') {
    console.log('[Utilidad] Recibidas cotizaciones del padre:', e.data.cotizaciones.length);
    window.cotizacionesDesdePadre = e.data.cotizaciones || [];
    if (typeof execUltimaData !== 'undefined' && execUltimaData && execUltimaData.length > 0) {
      const rowsConMontoTodas = execUltimaData.filter(r => r.montoServicio !== null && r.montoServicio !== undefined && r.montoServicio !== "");
      calcularUtilidadGlobal(rowsConMontoTodas);
    }
  }
});

// Avisar al padre que el iframe ya esta listo (para que mande la data si ya la habia cargado)
window.parent.postMessage({ type: 'SAI_READY' }, '*');

