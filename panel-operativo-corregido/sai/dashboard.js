// ============================================================
// Dashboard ejecutivo (SOLO ADMIN)
// ============================================================
let execUltimaData = null;
let mesResumenSAI = (() => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
})();

function publicarResumenSAI() {
  if (window.parent === window || typeof allRows === "undefined") return;
  const meses = [...new Set(allRows.map(r => claveMes(r.fechaInfusion)).filter(Boolean))].sort();
  const rowsMes = allRows.filter(r => mesResumenSAI === "all" || claveMes(r.fechaInfusion) === mesResumenSAI);
  const facturados = rowsMes.filter(r => r.montoServicio !== null && r.montoServicio !== undefined && r.montoServicio !== "");
  const montoTotal = facturados.reduce((total, r) => total + (Number(r.montoServicio) || 0), 0);
  const meta = 4000000;
  window.parent.postMessage({ type: "SAI_MESES_DISPONIBLES", meses }, "*");
  window.parent.postMessage({
    type: "SAI_UPDATE",
    payload: { montoTotal, meta, pctAvance: montoTotal / meta * 100,
      faltante: Math.max(0, meta - montoTotal), conteo: facturados.length }
  }, "*");
}

window.addEventListener("message", event => {
  if (event.source !== window.parent || !event.data) return;
  if (event.data.type === "PANEL_FILTRO_MES") {
    if (event.data.mes === "all" || /^\d{4}-\d{2}$/.test(event.data.mes)) {
      mesResumenSAI = event.data.mes;
      publicarResumenSAI();
    }
  } else if (event.data.type === "SOLICITAR_SAI_UPDATE") {
    publicarResumenSAI();
  }
});

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
  } else {
    $("execSedeLider").textContent = "—";
    $("execSedeLiderMonto").textContent = "$0";
  }

  // ---- Meta mensual ----
  const meta = 4000000;
  const pctAvance = montoTotal / meta * 100;
  $("execMetaAvance").textContent = `${pctAvance.toFixed(1)}%`;
  $("execMetaAvance").style.color = pctAvance >= 100 ? "#37d39a" : pctAvance >= 50 ? "#f59e0b" : "#38bdf8";
  $("execMetaDetalle").textContent = montoTotal < meta
    ? `Faltan ${formatearMoneda(meta - montoTotal)} para la meta`
    : `¡Meta superada por ${formatearMoneda(montoTotal - meta)}!`;
  $("execMetaBar").style.width = `${Math.min(100, pctAvance)}%`;
  $("execMetaBar").style.background = $("execMetaAvance").style.color;

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
  $("execNuevosVol").textContent = String(nuevos.length);
  $("execNuevosMonto").textContent = formatearMoneda(nuevos.reduce((a, r) => a + (Number(r.montoServicio) || 0), 0));
  $("execRecurrentesVol").textContent = String(recurrentes.length);
  $("execRecurrentesMonto").textContent = formatearMoneda(recurrentes.reduce((a, r) => a + (Number(r.montoServicio) || 0), 0));

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

// La homologación es exclusiva del dashboard. Los registros capturados y sus
// exportaciones conservan el texto original.
function homologarDiagnostico(valor) {
  const original = apartadoValorCelda(valor);
  if (original === "SIN DATO") return original;

  const texto = normalizarTexto(original)
    .replace(/\bca\.(?=\s)/g, "ca")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim()
    // En los registros observados, "con AT pulmonar" acompaña al diagnóstico
    // de mama; no representa aquí un segundo cáncer primario.
    .replace(/\bcon at pulmonar\b/g, " ").replace(/\s+/g, " ").trim();

  // Un registro que combina cáncer con otra enfermedad no se asigna a una sola.
  if (/\b(y|mas)\b/.test(texto) && /\b(diabetes|leucemia|linfoma|mieloma|insuficiencia|enfermedad renal)\b/.test(texto)) return original;

  const cancer = /\b(cancer|carcinoma|adenocarcinoma|neoplasia maligna|tumor maligno|ca)\b/.test(texto);
  if (cancer) {
    const sitios = [
      [/\b(mama|mamario|mamaria|seno|senos)\b/, "CÁNCER DE MAMA"],
      [/\b(pulmon|pulmonar|bronco|bronquial)\b/, "CÁNCER DE PULMÓN"],
      [/\b(colon|colorrectal|colorectal|recto)\b/, "CÁNCER COLORRECTAL"],
      [/\b(prostata|prostatico|prostatica)\b/, "CÁNCER DE PRÓSTATA"],
      [/\b(cervix|cervical|cervicouterino|cervico uterino|cuello uterino|cuello de utero)\b/, "CÁNCER CERVICOUTERINO"],
      [/\b(ovario|ovarico|ovarica)\b/, "CÁNCER DE OVARIO"],
      [/\b(utero|uterino|uterina|endometrio|endometrial)\b/, "CÁNCER DE ÚTERO"],
      [/\b(estomago|gastrico|gastrica)\b/, "CÁNCER GÁSTRICO"],
      [/\b(pancreas|pancreatico|pancreatica)\b/, "CÁNCER DE PÁNCREAS"],
      [/\b(higado|hepatico|hepatica|hepatocelular)\b/, "CÁNCER DE HÍGADO"],
      [/\b(rinon|renal|rinal)\b/, "CÁNCER RENAL"],
      [/\b(vejiga|vesical)\b/, "CÁNCER DE VEJIGA"],
      [/\b(tiroides|tiroideo|tiroidea)\b/, "CÁNCER DE TIROIDES"],
      [/\b(piel|cutaneo|cutanea)\b/, "CÁNCER DE PIEL"],
      [/\b(cabeza y cuello|orofaringe|laringe|faringe)\b/, "CÁNCER DE CABEZA Y CUELLO"],
      [/\b(esofago|esofagico|esofagica)\b/, "CÁNCER DE ESÓFAGO"],
      [/\b(testiculo|testicular)\b/, "CÁNCER TESTICULAR"],
      [/\b(cerebro|cerebral|encefalo)\b/, "CÁNCER CEREBRAL"]
    ];
    const encontrados = sitios.filter(([patron]) => patron.test(texto));
    if (encontrados.length === 2 && /\b(cuello uterino|cervico uterino)\b/.test(texto) &&
        encontrados.some(([, nombre]) => nombre === "CÁNCER CERVICOUTERINO") &&
        encontrados.some(([, nombre]) => nombre === "CÁNCER DE ÚTERO")) return "CÁNCER CERVICOUTERINO";
    if (encontrados.length === 1) return encontrados[0][1];
    if (encontrados.length > 1) return original;
  }

  if (/\bleucemia\b/.test(texto)) return "LEUCEMIA";
  if (/\blinfoma\b/.test(texto)) return "LINFOMA";
  if (/\bmieloma\b/.test(texto)) return "MIELOMA MÚLTIPLE";
  if (/\bmelanoma\b/.test(texto)) return "MELANOMA";
  if (/\bneuritis\s*optica\s+recurrente\b/.test(texto)) return "NEURITIS ÓPTICA RECURRENTE";

  // Equivalencias frecuentes fuera de oncología; las demás enfermedades solo
  // se unifican por tildes, puntuación y espacios para evitar falsos grupos.
  if (/\b(dm2|diabetes mellitus tipo 2|diabetes tipo 2)\b/.test(texto)) return "DIABETES MELLITUS TIPO 2";
  if (/\b(dm1|diabetes mellitus tipo 1|diabetes tipo 1)\b/.test(texto)) return "DIABETES MELLITUS TIPO 1";
  if (/\b(erc|enfermedad renal cronica|insuficiencia renal cronica)\b/.test(texto)) return "ENFERMEDAD RENAL CRÓNICA";

  return texto.toUpperCase();
}

function homologarMedico(valor) {
  const original = apartadoValorCelda(valor);
  if (original === "SIN DATO") return original;
  // Solo se juntan nombres completos que coinciden tras retirar tratamientos,
  // tildes, signos y espacios. Una inicial o apellido faltante no basta.
  const nombre = normalizarTexto(original)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim()
    .replace(/^(?:dr|dra|dr a|doctor|doctora|medico|medica|m c)\s+/, "");
  return nombre.toUpperCase() || "SIN DATO";
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
    const val = key === "diagnostico" ? homologarDiagnostico(r[key])
      : key === "medicos" ? homologarMedico(r[key]) : apartadoValorCelda(r[key]);
    mapa.set(val, (mapa.get(val) || 0) + 1);
  });
  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
}

function clavePaciente(valor) {
  return normalizarTexto(valor).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function pacientesPorMedico(rows) {
  const mapa = new Map();
  rows.forEach(r => {
    const medico = homologarMedico(r.medicos);
    if (!mapa.has(medico)) mapa.set(medico, new Set());
    const paciente = clavePaciente(r.paciente);
    if (paciente) mapa.get(medico).add(paciente);
  });
  return mapa;
}

function montosPorDiagnostico(rows) {
  const mapa = new Map();
  rows.forEach(r => {
    const grupo = homologarDiagnostico(r.diagnostico);
    if (!mapa.has(grupo)) mapa.set(grupo, { montoTotal: 0, registrosConMonto: 0, pacientes: new Set() });
    const resumen = mapa.get(grupo);
    const paciente = clavePaciente(r.paciente);
    if (paciente) resumen.pacientes.add(paciente);
    const bruto = r.montoServicio;
    if (bruto === null || bruto === undefined || String(bruto).trim() === "") return;
    const monto = Number(bruto);
    if (!Number.isFinite(monto)) return;
    resumen.montoTotal += monto;
    resumen.registrosConMonto++;
  });
  return mapa;
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
    const variantes = new Map();
    const montos = campo.key === "diagnostico" ? montosPorDiagnostico(rows) : null;
    const pacientesMedico = campo.key === "medicos" ? pacientesPorMedico(rows) : null;
    if (campo.key === "diagnostico" || campo.key === "medicos") {
      rows.forEach(r => {
        const grupo = campo.key === "diagnostico" ? homologarDiagnostico(r.diagnostico) : homologarMedico(r.medicos);
        if (!variantes.has(grupo)) variantes.set(grupo, new Map());
        const original = apartadoValorCelda(r[campo.key]);
        const mapa = variantes.get(grupo);
        mapa.set(original, (mapa.get(original) || 0) + 1);
      });
    }

    if (apartadoDetBuscarTexto) {
      const q = normalizarTexto(apartadoDetBuscarTexto);
      dist = dist.filter(([v]) => normalizarTexto(v).includes(q) ||
        (variantes.get(v) && Array.from(variantes.get(v).keys()).some(original => normalizarTexto(original).includes(q))));
    }

    subtitulo = `${totalReg} registro(s) analizado(s) · ${dist.length} valor(es) distinto(s)${apartadoDetBuscarTexto ? " (filtrado)" : ""}`;

    const notaMontos = campo.key === "diagnostico"
      ? `<p class="muted apartado-tabla-nota">Pacientes únicos por diagnóstico. El ticket promedio se calcula como monto total del servicio ÷ registros con monto.</p>`
      : "";

    if (!dist.length) {
      bodyHtml = `<p class="muted">Sin resultados para ese filtro.</p>`;
    } else if (dist.length <= UMBRAL_GRAFICA_BARRAS) {
      const maxC = dist[0][1];
      bodyHtml = `${notaMontos}
        <div class="apartado-bars">
          ${dist.map(([val, count], i) => `
            <div class="apartado-bar-row">
              <span class="apartado-bar-label" title="${escapeHtml(val)}">${escapeHtml(val)}</span>
              <div class="apartado-bar-track"><div class="apartado-bar-fill" style="width:${Math.max(3, (count / maxC) * 100)}%; background:${colores.paleta[i % colores.paleta.length]}"></div></div>
              <span class="apartado-bar-valor">${count} · ${totalReg ? Math.round((count / totalReg) * 100) : 0}%</span>
            </div>`).join("")}
        </div>`;
    } else {
      bodyHtml = `${notaMontos}<p class="muted apartado-tabla-nota">Este apartado tiene muchos valores distintos: se muestra como tabla clasificada por frecuencia (usa el buscador para filtrar).</p>`;
    }

    tablaHeadHtml = `<thead><tr><th>${escapeHtml(campo.label)}</th><th>Registros</th>${campo.key === "diagnostico" || campo.key === "medicos" ? "<th>Pacientes</th>" : ""}<th>%</th>${campo.key === "diagnostico" ? "<th>Con monto</th><th>Monto total del servicio</th><th>Ticket promedio</th>" : ""}</tr></thead>`;
    tablaFilasHtml = dist.map(([val, count]) => {
      const resumen = montos && montos.get(val);
      const montoHtml = resumen
        ? `<td>${resumen.registrosConMonto}</td><td>${resumen.registrosConMonto ? formatearMoneda(resumen.montoTotal) : "—"}</td><td>${resumen.registrosConMonto ? formatearMoneda(resumen.montoTotal / resumen.registrosConMonto) : "—"}</td>`
        : "";
      const pacientesHtml = resumen ? `<td>${resumen.pacientes.size}</td>`
        : pacientesMedico ? `<td>${(pacientesMedico.get(val) || new Set()).size}</td>` : "";
      return `<tr><td>${escapeHtml(val)}</td><td>${count}</td>${pacientesHtml}<td>${totalReg ? Math.round((count / totalReg) * 100) : 0}%</td>${montoHtml}</tr>`;
    }).join("");
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
  if (window.parent !== window) window.parent.postMessage({ type: "SAI_READY" }, "*");
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
