// js/main.js
// Dashboard de cotizadores Sanaré & Nomad (Firebase)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// CONFIG FIREBASE

const firebaseConfigSanare = {
  apiKey: "AIzaSyAX1AA7tTnlnApVZlnnuMkB42k3W5IlwoM",
  authDomain: "sanare-cotizador.firebaseapp.com",
  projectId: "sanare-cotizador",
  storageBucket: "sanare-cotizador.firebasestorage.app",
  messagingSenderId: "902613920907",
  appId: "1:902613920907:web:0e73bd5def3cf4396a788e"
};

const firebaseConfigNomad = {
  apiKey: "AIzaSyDhtKZlWpHdhFcnVzWovB93bRSVRkC1sDI",
  authDomain: "cotizador-nomad.firebaseapp.com",
  projectId: "cotizador-nomad",
  storageBucket: "cotizador-nomad.firebasestorage.app",
  messagingSenderId: "736481537624",
  appId: "1:736481537624:web:6f06667cf34bccc532642d"
};

// IMPORTANTE: en ambos proyectos el nombre de la colección es "cotizaciones"
const SANARE_COLLECTION = "cotizaciones";
const NOMAD_COLLECTION  = "cotizaciones";

// Inicializar apps
const appSanare = initializeApp(firebaseConfigSanare, "sanareApp");
const appNomad  = initializeApp(firebaseConfigNomad, "nomadApp");

const dbSanare = getFirestore(appSanare);
const dbNomad  = getFirestore(appNomad);

// Estatus
const ESTATUS_1_OPCIONES = [
  "Sin seguimiento",
  "Cotización enviada",
  "En negociación",
  "Cerrada / aceptada",
  "Perdida / rechazada",
  "Cancelada"
];

const ESTATUS_2_OPCIONES = [
  "Sin aplicación",
  "Por programar",
  "Programada",
  "Aplicada",
  "No aplicada / vencida",
  "Reprogramada"
];

// Map teléfono -> sede Sanaré
const MAPA_SEDES_SANARE = {
  "722 197 08 36": "Toluca",
  "55 5255 8403": "Narvarte"
};

function obtenerSedePorTelefono(telefono) {
  if (!telefono) return "";
  return MAPA_SEDES_SANARE[telefono.trim()] || "Otra / sin clasificar";
}

// Estado en memoria
let sanareRows = [];
let nomadRows  = [];
let allRows    = [];

// DOM
const tbody = document.getElementById("tablaCotizacionesBody");
const totalGlobalElem       = document.getElementById("totalGlobal");
const totalSanareElem       = document.getElementById("totalSanare");
const totalNomadElem        = document.getElementById("totalNomad");
const totalGlobalCountElem  = document.getElementById("totalGlobalCount");
const totalSanareCountElem  = document.getElementById("totalSanareCount");
const totalNomadCountElem   = document.getElementById("totalNomadCount");
const ticketPromedioElem    = document.getElementById("ticketPromedio");
const contadorFilasElem     = document.getElementById("contadorFilas");

const filtroFechaInicio = document.getElementById("filtroFechaInicio");
const filtroFechaFin    = document.getElementById("filtroFechaFin");
const filtroTexto       = document.getElementById("filtroTexto");
const filtroStatus1     = document.getElementById("filtroStatus1");
const filtroStatus2     = document.getElementById("filtroStatus2");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnExportCsvResumen   = document.getElementById("btnExportCsvResumen");
const btnExportCsvDetallado = document.getElementById("btnExportCsvDetallado");
const filtrosMarca = document.querySelectorAll(".filtro-marca");

// Init selects de estatus
function initStatusFilters() {
  ESTATUS_1_OPCIONES.forEach(op => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    filtroStatus1.appendChild(o);
  });
  ESTATUS_2_OPCIONES.forEach(op => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    filtroStatus2.appendChild(o);
  });
}

function getSelectedValues(selectElem) {
  const values = [];
  for (const opt of selectElem.options) {
    if (opt.selected) values.push(opt.value);
  }
  return values;
}

// Listeners tiempo real
function initRealtimeListeners() {
  onSnapshot(collection(dbSanare, SANARE_COLLECTION), snap => {
    sanareRows = snap.docs.map(d => mapSanareDoc(d));
    recomputeAll();
  }, err => console.error("Sanaré listener error:", err));

  onSnapshot(collection(dbNomad, NOMAD_COLLECTION), snap => {
    nomadRows = snap.docs.map(d => mapNomadDoc(d));
    recomputeAll();
  }, err => console.error("Nomad listener error:", err));
}

// Map docs
function mapSanareDoc(docSnap) {
  const data = docSnap.data();
  const total = Number(data.total || 0);

  const telefono = data.telefono || "";
  const sede     = obtenerSedePorTelefono(telefono);

  const status1 = data.status1 || "Sin seguimiento";
  const status2 = data.status2 || "Sin aplicación";
  const motivo  = data.motivo  || "";

  return {
    origen: "SANARE",
    idFirestore: docSnap.id,
    collection: SANARE_COLLECTION,
    folio: data.folio || "",
    fechaEmision: data.fechaEmision || "",
    fechaCierre: data.fechaCierre || "",
    fechaProgramacion: data.fechaProgramacion || "",
    fechaValidez: data.fechaValidez || "",
    createdAt: data.createdAt || "",
    paciente: data.paciente || "",
    medico: data.medico || "",
    kam: data.kam || "",
    aseguradora: data.aseguradora || "",
    telefono,
    sede,
    total,
    direccion: data.direccion || "",
    dx: data.dx || "",
    esquema: data.esquema || "",
    servicios: Array.isArray(data.servicios) ? data.servicios : [],
    medicamentos: Array.isArray(data.medicamentos) ? data.medicamentos : [],
    marca: "SANARE",
    status1,
    status2,
    motivo
  };
}

function mapNomadDoc(docSnap) {
  const data = docSnap.data();
  const total = Number(data.total || 0);

  const status1 = data.status1 || "Sin seguimiento";
  const status2 = data.status2 || "Sin aplicación";
  const motivo  = data.motivo  || "";

  return {
    origen: "NOMAD",
    idFirestore: docSnap.id,
    collection: NOMAD_COLLECTION,
    folio: data.folio || "",
    fechaEmision: data.fechaEmision || "",
    fechaCierre: data.fechaCierre || "",
    fechaProgramacion: data.fechaProgramacion || "",
    fechaValidez: data.fechaValidez || "",
    createdAt: data.createdAt || "",
    paciente: data.paciente || "",
    medico: data.medico || "",
    kam: data.kam || "",
    aseguradora: data.aseguradora || "",
    telefono: "",
    sede: "",
    total,
    diagnostico: data.diagnostico || "",
    marca: data.marca || "NOMAD",
    pruebas: Array.isArray(data.pruebas) ? data.pruebas : [],
    status1,
    status2,
    motivo
  };
}

function recomputeAll() {
  allRows = [...nomadRows];
  aplicarFiltrosYRender();
  // Re-cruzar con Sheet si ya hay datos cargados
  if (typeof sheetRows !== 'undefined' && sheetRows.length) {
    cruzarConNomad();
    aplicarFiltrosRomarico();
  }
}

function aplicarFiltrosYRender() {
  let filas = [...allRows];

  const inicio = filtroFechaInicio.value;
  const fin    = filtroFechaFin.value;
  if (inicio) filas = filas.filter(r => r.fechaEmision && r.fechaEmision >= inicio);
  if (fin)    filas = filas.filter(r => r.fechaEmision && r.fechaEmision <= fin);

  const texto = filtroTexto.value.trim().toLowerCase();
  if (texto) {
    filas = filas.filter(r =>
      (r.folio || "").toLowerCase().includes(texto) ||
      (r.paciente || "").toLowerCase().includes(texto) ||
      (r.medico || "").toLowerCase().includes(texto) ||
      (r.kam || "").toLowerCase().includes(texto)
    );
  }

  const st1 = getSelectedValues(filtroStatus1);
  const st2 = getSelectedValues(filtroStatus2);
  if (st1.length) filas = filas.filter(r => st1.includes(r.status1));
  if (st2.length) filas = filas.filter(r => st2.includes(r.status2));

  renderTabla(filas);
  actualizarTotales(filas);
  actualizarGraficos(filas);
  renderPodio(filas);
}

function renderTabla(filas) {
  tbody.innerHTML = "";
  filas.forEach(row => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.idFirestore;
    tr.dataset.collection = row.collection;

    const tdFolio   = document.createElement("td"); tdFolio.textContent = row.folio;
    const tdFecha   = document.createElement("td"); tdFecha.textContent = row.fechaEmision || "";

    const tdFechaCierre = document.createElement("td");
    const inpFechaCierre = document.createElement("input");
    inpFechaCierre.type = "date";
    inpFechaCierre.value = row.fechaCierre || "";
    inpFechaCierre.title = "Fecha de cierre";
    tdFechaCierre.appendChild(inpFechaCierre);

    const tdPac     = document.createElement("td"); tdPac.textContent = row.paciente || "";
    const tdMed     = document.createElement("td"); tdMed.textContent = row.medico || "";
    const tdKam     = document.createElement("td"); tdKam.textContent = row.kam || "";
    const tdAseg    = document.createElement("td"); tdAseg.textContent = row.aseguradora || "";
    const tdTotal   = document.createElement("td"); tdTotal.textContent = formatearMoneda(row.total); tdTotal.style.textAlign = "right";

    const tdStatus1 = document.createElement("td");
    const sel1 = document.createElement("select");
    ESTATUS_1_OPCIONES.forEach(op => {
      const o = document.createElement("option");
      o.value = o.textContent = op;
      if (op === row.status1) o.selected = true;
      sel1.appendChild(o);
    });
    tdStatus1.appendChild(sel1);

    const tdStatus2 = document.createElement("td");
    const sel2 = document.createElement("select");
    ESTATUS_2_OPCIONES.forEach(op => {
      const o = document.createElement("option");
      o.value = o.textContent = op;
      if (op === row.status2) o.selected = true;
      sel2.appendChild(o);
    });
    tdStatus2.appendChild(sel2);

    const tdMotivo = document.createElement("td");
    const inpMotivo = document.createElement("input");
    inpMotivo.type = "text";
    inpMotivo.value = row.motivo || "";
    inpMotivo.placeholder = "Motivo / comentario...";
    tdMotivo.appendChild(inpMotivo);

    const guardar = async () => {
      try {
        const db = row.marca === "SANARE" ? dbSanare : dbNomad;
        const ref = doc(db, row.collection, row.idFirestore);
        await updateDoc(ref, {
          status1: sel1.value,
          status2: sel2.value,
          motivo:  inpMotivo.value,
          fechaCierre: inpFechaCierre.value || ""
        });
      } catch (e) {
        console.error("Error actualizando seguimiento:", e);
        alert("No se pudo guardar en Firebase. Revisa consola.");
      }
    };

    inpFechaCierre.addEventListener("change", () => {
      if (inpFechaCierre.value) {
        sel1.value = "Cerrada / aceptada";
      }
      guardar();
    });

    sel1.addEventListener("change", guardar);
    sel2.addEventListener("change", guardar);
    inpMotivo.addEventListener("blur", guardar);
    inpMotivo.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        guardar();
      }
    });

    tr.appendChild(tdFolio);
    tr.appendChild(tdFecha);
    tr.appendChild(tdFechaCierre);
    tr.appendChild(tdPac);
    tr.appendChild(tdMed);
    tr.appendChild(tdKam);
    tr.appendChild(tdAseg);
    tr.appendChild(tdTotal);
    tr.appendChild(tdStatus1);
    tr.appendChild(tdStatus2);
    tr.appendChild(tdMotivo);

    tbody.appendChild(tr);
  });

  contadorFilasElem.textContent = filas.length + " filas";
}

// Helper: define si una fila debe excluirse del resumen global
function esExcluidaDeResumenGlobal(row) {
  const st1 = (row.status1 || "").toLowerCase();
  const st2 = (row.status2 || "").toLowerCase();

  const exclStatus1 =
    st1 === "perdida / rechazada" ||
    st1 === "cancelada";

  const exclStatus2 =
    st2 === "no aplicada / vencida";

  return exclStatus1 || exclStatus2;
}

// Totales
function actualizarTotales(filas) {
  const filasResumen = filas.filter(r => !esExcluidaDeResumenGlobal(r));
  const totalNomad = filasResumen.reduce((acc, r) => acc + (r.total || 0), 0);
  const ticket = filasResumen.length ? totalNomad / filasResumen.length : 0;

  const cerradas = filas.filter(r => (r.status1 || "").toLowerCase() === "cerrada / aceptada");
  const totalCerradas = cerradas.reduce((acc, r) => acc + (r.total || 0), 0);

  const perdidas = filas.filter(r => 
    (r.status1 || "").toLowerCase() === "perdida / rechazada" || 
    (r.status1 || "").toLowerCase() === "cancelada"
  );

  if(totalNomadElem) totalNomadElem.textContent = formatearMoneda(totalNomad);
  if(totalNomadCountElem) totalNomadCountElem.textContent = filasResumen.length;
  
  if(totalGlobalElem) totalGlobalElem.textContent = formatearMoneda(totalCerradas);
  if(totalGlobalCountElem) totalGlobalCountElem.textContent = cerradas.length;

  if(ticketPromedioElem) ticketPromedioElem.textContent = formatearMoneda(ticket);
  if(typeof totalSanareElem !== 'undefined' && totalSanareElem) totalSanareElem.textContent = perdidas.length;
  if(typeof totalSanareCountElem !== 'undefined' && totalSanareCountElem) totalSanareCountElem.textContent = perdidas.length;

  // ── NOMAD_UPDATE para el panel operativo ──
  // Contamos cerradas/aceptadas usando fechaCierre (no fechaEmision) sobre TODAS las filas.
  // Así, editar fechaCierre de una cotización de cualquier mes la contará en el mes correcto.
  try {
    if (window.parent && window.parent !== window) {
      const ahora = new Date();
      const mesActualYYYY = ahora.getFullYear();
      const mesActualMM   = ahora.getMonth(); // 0-based

      // Cerradas del mes en curso según fechaCierre (sobre allRows completo)
      const cerradasPorCierre = allRows.filter(r => {
        if ((r.status1 || "").toLowerCase() !== "cerrada / aceptada") return false;
        if (!r.fechaCierre) return false;
        const partes = r.fechaCierre.split("-");
        if (partes.length < 2) return false;
        const anio = parseInt(partes[0], 10);
        const mes  = parseInt(partes[1], 10) - 1; // 0-based
        return anio === mesActualYYYY && mes === mesActualMM;
      });

      const montoPorCierre = cerradasPorCierre.reduce((acc, r) => acc + (r.total || 0), 0);

      window.parent.postMessage({
        type: 'NOMAD_UPDATE',
        payload: {
          cerradasMonto: montoPorCierre,
          cerradasCount: cerradasPorCierre.length
        }
      }, '*');
    }
  } catch(e) {}
}

// Charts
let chartKams, chartKamsCount, chartKamStatus, chartPruebas, chartMeses, chartStatus1;

function crearOActualizarChart(ref, id, type, data, options) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (ref instanceof Chart) {
    ref.data = data;
    ref.options = options || {};
    ref.update();
    return ref;
  }
  return new Chart(ctx, { type, data, options });
}

function actualizarGraficos(filas) {
  // KAM (Total $)
  const porKam = {};
  const conteoKam = {};
  const statusPorKam = {};
  
  filas.forEach(r => {
    const k = r.kam || "Sin KAM";
    porKam[k] = (porKam[k] || 0) + (r.total || 0);
    conteoKam[k] = (conteoKam[k] || 0) + 1;
    
    if (!statusPorKam[k]) statusPorKam[k] = {};
    const st = r.status1 || "Sin seguimiento";
    statusPorKam[k][st] = (statusPorKam[k][st] || 0) + 1;
  });

  chartKams = crearOActualizarChart(chartKams, "chartKams", "bar", {
    labels: Object.keys(porKam),
    datasets: [{ label: "Total cotizado ($)", data: Object.values(porKam) }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  chartKamsCount = crearOActualizarChart(chartKamsCount, "chartKamsCount", "bar", {
    labels: Object.keys(conteoKam),
    datasets: [{ label: "Cantidad de cotizaciones", data: Object.values(conteoKam), backgroundColor: "#3b82f6" }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Status por KAM (Stacked Bar)
  const kamsList = Object.keys(statusPorKam);
  const allStatuses = [...new Set(filas.map(r => r.status1 || "Sin seguimiento"))];
  const colors = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#64748b", "#ec4899", "#14b8a6"];
  
  const datasetsStatus = allStatuses.map((st, i) => {
    return {
      label: st,
      data: kamsList.map(k => statusPorKam[k][st] || 0),
      backgroundColor: colors[i % colors.length]
    };
  });

  chartKamStatus = crearOActualizarChart(chartKamStatus, "chartKamStatus", "bar", {
    labels: kamsList,
    datasets: datasetsStatus
  }, {
    plugins: { legend: { position: "bottom" } },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
  });

  // Pruebas Nomad (solo pruebas, excluyendo biomarcadores)
const nomadFilas = filas.filter(r => r.marca === "NOMAD");
const porPrueba = {};
nomadFilas.forEach(r => {
  if (Array.isArray(r.pruebas)) {
    r.pruebas.forEach(p => {
      if (!p) return;

      const rawName = (p.prueba || "").toString();
      const tipo    = ((p.tipo || p.categoria || p.clasificacion || "") + "").toLowerCase();

      // Heurística para detectar biomarcadores:
      const nombreLower = rawName.toLowerCase();
      const esBiomarcador =
        tipo.includes("biomarc") ||
        tipo.includes("marcador") ||
        nombreLower.includes("biomarc") ||
        nombreLower.includes("marcador tumoral");

      // Si es biomarcador, lo excluimos del gráfico
      if (esBiomarcador) return;

      const nombre = rawName || "Sin nombre";
      const subtotal = Number(p.subtotal || p.total || p.precio || 0);
      porPrueba[nombre] = (porPrueba[nombre] || 0) + subtotal;
    });
  }
});
chartPruebas = crearOActualizarChart(chartPruebas, "chartPruebas", "bar", {
  labels: Object.keys(porPrueba),
  datasets: [{ label: "Total por prueba", data: Object.values(porPrueba) }]
}, { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }}});// Meses
  const porMes = {};
  filas.forEach(r => {
    const mes = formatearMes(r.fechaEmision);
    porMes[mes] = (porMes[mes] || 0) + (r.total || 0);
  });
  const labelsMes = Object.keys(porMes).sort();
  chartMeses = crearOActualizarChart(chartMeses, "chartMeses", "line", {
    labels: labelsMes,
    datasets: [{ label: "Total por mes", data: labelsMes.map(l => porMes[l]) }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Estatus 1
  const conteo = {};
  filas.forEach(r => {
    const st = r.status1 || "Sin seguimiento";
    conteo[st] = (conteo[st] || 0) + 1;
  });
  chartStatus1 = crearOActualizarChart(chartStatus1, "chartStatus1", "pie", {
    labels: Object.keys(conteo),
    datasets: [{ label: "Cotizaciones por estatus 1", data: Object.values(conteo) }]
  }, {
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || "";
            const value = context.raw || 0;
            const data = context.chart.data.datasets[0].data || [];
            const total = data.reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
            const porcentaje = total ? ((value * 100) / total).toFixed(1) : 0;
            return `${label}: ${value} (${porcentaje}%)`;
          }
        }
      }
    }
  });
}

function formatearMes(fecha) {
  if (!fecha) return "Sin fecha";
  const partes = fecha.split("-");
  if (partes.length < 2) return "Sin fecha";
  const [y, m] = partes;
  return y + "-" + m;
}

// CSV
function formatearListaParaCsv(lista) {
  // Convierte arreglos de objetos (servicios, medicamentos, pruebas) en texto legible
  if (!Array.isArray(lista) || !lista.length) return "";
  return lista.map(item => {
    if (item === null || typeof item !== "object") return String(item);

    const nombre    = (item.prueba || item.nombre || item.descripcion || item.concepto || "").toString().trim();
    const codigo    = (item.codigo || item.clave || "").toString().trim();
    const cantidad  = (item.cantidad || item.cant || "").toString().trim();
    const subtotal  = (item.subtotal || item.total || item.precio || "").toString().trim();

    const partes = [];
    if (nombre)   partes.push(nombre);
    if (codigo)   partes.push("cod:" + codigo);
    if (cantidad) partes.push("cant:" + cantidad);
    if (subtotal) partes.push("sub:" + subtotal);

    const texto = partes.join(" | ");
    return texto || JSON.stringify(item);
  }).join(" || ");
}

function exportarCsv(nombre, filas, detallado = false) {
  if (!filas.length) {
    alert("No hay filas para exportar.");
    return;
  }

  let encabezados, rows;
  if (!detallado) {
    encabezados = [
      "marca","folio","fechaEmision","fechaCierre","paciente","medico","kam",
      "aseguradora","total","telefono","sede","status1","status2","motivo"
    ];
    rows = filas.map(r => [
      r.marca || "", r.folio || "", r.fechaEmision || "", r.fechaCierre || "",
      r.paciente || "", r.medico || "", r.kam || "",
      r.aseguradora || "", r.total || 0,
      r.telefono || "", r.sede || "",
      r.status1 || "", r.status2 || "", r.motivo || ""
    ]);
  } else {
    encabezados = [
      "marca","folio","fechaEmision","fechaCierre","fechaProgramacion","fechaValidez",
      "paciente","medico","kam","aseguradora","total",
      "telefono","sede",
      "direccion","dx","esquema",
      "servicios","medicamentos",
      "diagnostico","pruebas",
      "status1","status2","motivo"
    ];
    rows = filas.map(r => [
      r.marca || "", r.folio || "", r.fechaEmision || "", r.fechaCierre || "",
      r.fechaProgramacion || "", r.fechaValidez || "",
      r.paciente || "", r.medico || "", r.kam || "",
      r.aseguradora || "", r.total || 0,
      r.telefono || "", r.sede || "",
      r.direccion || "", r.dx || "", r.esquema || "",
      formatearListaParaCsv(r.servicios || []),
      formatearListaParaCsv(r.medicamentos || []),
      r.diagnostico || "",
      formatearListaParaCsv(r.pruebas || []),
      r.status1 || "", r.status2 || "", r.motivo || ""
    ]);
  }

  const sep = ";"; // Usamos ';' y forzamos a Excel a reconocerlo con la primera línea
  // Agregamos BOM para que Excel respete UTF-8 y muestre bien acentos y caracteres especiales
  let csv = "\uFEFF";
  csv += "sep=" + sep + "\n";
  csv += encabezados.join(sep) + "\n";

  rows.forEach(r => {
    const linea = r.map(v => {
      if (v === null || v === undefined) return "";
      const str = String(v).replace(/"/g, '""');
      if (str.includes(sep) || str.includes("\n")) return `"\${str}"`;
      return str;
    }).join(sep);
    csv += linea + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatearMoneda(valor) {
  const num = Number(valor || 0);
  return num.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0
  });
}

// ── Podio KAM ──
function renderPodio(filas) {
  const podioCerradasEl = document.getElementById("podioCerradas");
  const podioSinSegEl   = document.getElementById("podioSinSeguimiento");
  if (!podioCerradasEl || !podioSinSegEl) return;

  const medals = ["🥇", "🥈", "🥉"];
  const kamCerradas = {};
  const kamSinSeg   = {};

  filas.forEach(r => {
    const kam = (r.kam || "Sin KAM").trim();
    if (!kam) return;
    if ((r.status1 || "").toLowerCase().includes("cerrada")) {
      kamCerradas[kam] = (kamCerradas[kam] || 0) + 1;
    }
    if ((r.status1 || "").toLowerCase().includes("sin seguimiento")) {
      kamSinSeg[kam] = (kamSinSeg[kam] || 0) + 1;
    }
  });

  const buildList = (mapObj, listEl, badgeClass) => {
    listEl.innerHTML = "";
    const sorted = Object.entries(mapObj).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!sorted.length) {
      const li = document.createElement("li");
      li.className = "podio-vacio";
      li.textContent = "Sin datos en el periodo seleccionado.";
      listEl.appendChild(li);
      return;
    }
    sorted.forEach(([kam, count], idx) => {
      const li = document.createElement("li");
      li.className = "podio-item";
      const medal = medals[idx] || `${idx + 1}.`;
      li.innerHTML = `
        <span class="podio-pos pos-${idx + 1}">${medal}</span>
        <span class="podio-kam-name">${kam}</span>
        <span class="podio-count ${badgeClass}">${count}</span>
      `;
      listEl.appendChild(li);
    });
  };

  buildList(kamCerradas, podioCerradasEl, "cerradas-badge");
  buildList(kamSinSeg,   podioSinSegEl,   "sin-seg-badge");
}

// UI events
function initUIEvents() {
  // Set default filter to current month
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  filtroFechaInicio.value = primerDia.toISOString().split("T")[0];
  filtroFechaFin.value    = ultimoDia.toISOString().split("T")[0];

  filtroFechaInicio.addEventListener("change", aplicarFiltrosYRender);
  filtroFechaFin.addEventListener("change", aplicarFiltrosYRender);
  filtroTexto.addEventListener("input", aplicarFiltrosYRender);
  filtroStatus1.addEventListener("change", aplicarFiltrosYRender);
  filtroStatus2.addEventListener("change", aplicarFiltrosYRender);
  filtrosMarca.forEach(cb => cb.addEventListener("change", aplicarFiltrosYRender));

  btnLimpiarFiltros.addEventListener("click", () => {
    const hoyL = new Date();
    const ini = new Date(hoyL.getFullYear(), hoyL.getMonth(), 1);
    const fin = new Date(hoyL.getFullYear(), hoyL.getMonth() + 1, 0);
    filtroFechaInicio.value = ini.toISOString().split("T")[0];
    filtroFechaFin.value    = fin.toISOString().split("T")[0];
    filtroTexto.value = "";
    for (const o of filtroStatus1.options) o.selected = false;
    for (const o of filtroStatus2.options) o.selected = false;
    filtrosMarca.forEach(cb => cb.checked = true);
    aplicarFiltrosYRender();
  });

  btnExportCsvResumen.addEventListener("click", () => {
    exportarCsv("cotizaciones_resumen.csv", getFilasFiltradasParaExport(), false);
  });
  btnExportCsvDetallado.addEventListener("click", () => {
    exportarCsv("cotizaciones_detallado.csv", getFilasFiltradasParaExport(), true);
  });
}

function getFilasFiltradasParaExport() {
  let filas = [...allRows];

  const marcasSeleccionadas = Array.from(filtrosMarca)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  if (marcasSeleccionadas.length > 0) {
    filas = filas.filter(r => marcasSeleccionadas.includes(r.marca));
  }

  const inicio = filtroFechaInicio.value;
  const fin    = filtroFechaFin.value;
  if (inicio) filas = filas.filter(r => r.fechaEmision && r.fechaEmision >= inicio);
  if (fin)    filas = filas.filter(r => r.fechaEmision && r.fechaEmision <= fin);

  const texto = filtroTexto.value.trim().toLowerCase();
  if (texto) {
    filas = filas.filter(r =>
      (r.folio || "").toLowerCase().includes(texto) ||
      (r.paciente || "").toLowerCase().includes(texto) ||
      (r.medico || "").toLowerCase().includes(texto) ||
      (r.kam || "").toLowerCase().includes(texto)
    );
  }

  const st1 = getSelectedValues(filtroStatus1);
  const st2 = getSelectedValues(filtroStatus2);
  if (st1.length) filas = filas.filter(r => st1.includes(r.status1));
  if (st2.length) filas = filas.filter(r => st2.includes(r.status2));

  return filas;
}

function init() {
  initStatusFilters();
  initUIEvents();
  initRealtimeListeners();
  initTabs();
  initRomarico();
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================
//  NAVEGACIÓN DE PESTAÑAS
// ============================================================
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const content = document.getElementById(target);
      if (content) content.classList.add("active");
    });
  });
}

// ============================================================
//  ROMARICO — Google Sheet Integration
// ============================================================
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1ImnVcnE5a9cuCLKX2X97QVZ2YVv_Z_jC/export?format=csv";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let sheetRows = [];      // filas crudas del Sheet
let sheetCruzadas = [];  // filas del Sheet ya cruzadas con nomadRows

// ── DOM Romarico ──
const romaricoLastUpdateEl  = document.getElementById("romaricoLastUpdate");
const romaricoTotalEl       = document.getElementById("romaricoTotal");
const romaricoConMatchEl    = document.getElementById("romaricoConMatch");
const romaricoSinMatchEl    = document.getElementById("romaricoSinMatch");
const romaricoCompletoEl    = document.getElementById("romaricoCompleto");
const romaricoMontoTotalEl  = document.getElementById("romaricoMontoTotal");
const romaricoSinMatchBadge = document.getElementById("romaricoSinMatchBadge");
const romaricoAlertSemana   = document.getElementById("romaricoAlertSemana");
const romaricoTextoSemana   = document.getElementById("romaricoTextoSemana");
const contadorRomaricoEl    = document.getElementById("contadorRomarico");
const tablaRomaricoBody     = document.getElementById("tablaRomaricoBody");
const romaricoLoadingState  = document.getElementById("romaricoLoadingState");
const romaricoErrorState    = document.getElementById("romaricoErrorState");
const romaricoTableContainer= document.getElementById("romaricoTableContainer");

const filtroRomaricoTexto       = document.getElementById("filtroRomaricoTexto");
const filtroRomaricoFormaPago   = document.getElementById("filtroRomaricoFormaPago");
const filtroRomaricoResponsable = document.getElementById("filtroRomaricoResponsable");
const filtroRomaricoMatch       = document.getElementById("filtroRomaricoMatch");
const btnLimpiarFiltrosRomarico = document.getElementById("btnLimpiarFiltrosRomarico");
const btnRefreshRomarico        = document.getElementById("btnRefreshRomarico");
const btnExportRomarico         = document.getElementById("btnExportRomarico");
const btnRetryRomarico          = document.getElementById("btnRetryRomarico");

const filtroRomaricoFechaInicio = document.getElementById("filtroRomaricoFechaInicio");
const filtroRomaricoFechaFin    = document.getElementById("filtroRomaricoFechaFin");

function initRomarico() {
  if (filtroRomaricoTexto)
    filtroRomaricoTexto.addEventListener("input", aplicarFiltrosRomarico);
  if (filtroRomaricoFormaPago)
    filtroRomaricoFormaPago.addEventListener("change", aplicarFiltrosRomarico);
  if (filtroRomaricoResponsable)
    filtroRomaricoResponsable.addEventListener("change", aplicarFiltrosRomarico);
  if (filtroRomaricoMatch)
    filtroRomaricoMatch.addEventListener("change", aplicarFiltrosRomarico);
  if (filtroRomaricoFechaInicio)
    filtroRomaricoFechaInicio.addEventListener("change", aplicarFiltrosRomarico);
  if (filtroRomaricoFechaFin)
    filtroRomaricoFechaFin.addEventListener("change", aplicarFiltrosRomarico);

  // Set default to current month
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  
  if (filtroRomaricoFechaInicio) {
    filtroRomaricoFechaInicio.value = primerDia.toISOString().split("T")[0];
  }
  if (filtroRomaricoFechaFin) {
    filtroRomaricoFechaFin.value = ultimoDia.toISOString().split("T")[0];
  }

  if (btnLimpiarFiltrosRomarico)
    btnLimpiarFiltrosRomarico.addEventListener("click", limpiarFiltrosRomarico);
  if (btnRefreshRomarico)
    btnRefreshRomarico.addEventListener("click", () => cargarSheet(true));
  if (btnExportRomarico)
    btnExportRomarico.addEventListener("click", exportarCsvRomarico);
  if (btnRetryRomarico)
    btnRetryRomarico.addEventListener("click", () => cargarSheet(true));

  // Primera carga
  cargarSheet(false);

  // Auto-refresh cada 5 min
  setInterval(() => cargarSheet(false), REFRESH_INTERVAL_MS);
}

// ── Parser de CSV robusto ──
function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;
  const rows = [];
  let cells = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQuotes) {
      if (ch === '\r') i++;
      cells.push(current.trim());
      rows.push(cells);
      cells = [];
      current = "";
    } else {
      current += ch;
    }
  }
  if (current || cells.length) {
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

// ── Normalizar nombre para matching ──
function normalizarNombre(nombre) {
  if (!nombre) return "";
  return nombre
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, "")    // quitar especiales
    .replace(/\s+/g, " ")            // espacios múltiples
    .trim();
}

// ── Helper: un registro está completo si seguimiento O notas lo indica ──
function esCompletadoRow(r) {
  const checkStr = (s) => {
    const t = (s || "").toUpperCase();
    return t.includes("COMPLET") || t.includes("ENVIADO EEUU") ||
           t.includes("EN PROCESO DE RESULTADO") || t.includes("ENTREGARON RESULT");
  };
  return checkStr(r.seguimiento) || checkStr(r.notas);
}

// ── Detectar clase CSS de estado ──
function classeEstado(texto) {
  if (!texto) return "";
  const t = texto.toLowerCase();
  if (t.includes("complet") || t.includes("enviado eeuu") || t.includes("en espera de resultado") || t.includes("entregaron result"))
    return "status-completo";
  if (t.includes("cancel") || t.includes("no contesta") || t.includes("rechaza") || t.includes("falleci"))
    return "status-cancelado";
  if (t.includes("proceso") || t.includes("espera de carta") || t.includes("validacion"))
    return "status-proceso";
  if (t.includes("espera") || t.includes("pendiente") || t.includes("pause"))
    return "status-espera";
  if (t.includes("envi") || t.includes("cotizaci"))
    return "status-enviado";
  return "";
}

// ── Fetch del Sheet ──
async function cargarSheet(mostrarLoading) {
  if (mostrarLoading) {
    romaricoLoadingState && (romaricoLoadingState.style.display = "flex");
    romaricoErrorState && (romaricoErrorState.style.display = "none");
    romaricoTableContainer && (romaricoTableContainer.style.display = "none");
  }

  try {
    // Cache-bust para siempre obtener datos frescos
    const url = SHEET_CSV_URL + "&t=" + Date.now();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const csvText = await resp.text();
    procesarSheet(csvText);
  } catch (err) {
    console.error("Error cargando Sheet:", err);
    romaricoLoadingState && (romaricoLoadingState.style.display = "none");
    romaricoErrorState && (romaricoErrorState.style.display = "block");
    romaricoTableContainer && (romaricoTableContainer.style.display = "none");
  }
}

function procesarSheet(csvText) {
  const rows = parseCSV(csvText);
  if (!rows.length) return;

  // Primera fila = encabezados (índices 0-8)
  // 0: FECHA DE SOLICITUD
  // 1: NOMBRE DE PACIENTE
  // 2: PRUEBA
  // 3: COSTO CON IVA
  // 4: FORMA DE PAGO
  // 5: Columna 7 (notas/proceso)
  // 6: SEGUIMIENTO
  // 7: SE SOLICITA APOYO COI
  // 8: RESPONSABLE

  sheetRows = rows
    .slice(1) // saltar encabezado
    .filter(r => r.length >= 2 && r[1] && r[1].trim() && r[1].trim() !== "Collapse genes")
    .map(r => ({
      fecha:        (r[0] || "").trim(),
      paciente:     (r[1] || "").trim(),
      prueba:       (r[2] || "").trim(),
      costoIva:     (r[3] || "").trim(),
      formaPago:    (r[4] || "").trim(),
      seguimiento:  (r[5] || "").trim(),
      notas:        (r[6] || "").trim(),
      apoyoCoi:     (r[7] || "").trim(),
      responsable:  (r[8] || "").trim(),
      // cruce Firebase
      firebaseMatch: null
    }));

  // Rellenar selects de filtros
  poblarSelectFiltro(filtroRomaricoFormaPago, sheetRows.map(r => r.formaPago).filter(Boolean));
  poblarSelectFiltro(filtroRomaricoResponsable, sheetRows.map(r => r.responsable).filter(Boolean));

  // Cruzar con nomadRows (ya cargados desde Firebase)
  cruzarConNomad();

  // Actualizar timestamp
  const ahora = new Date();
  if (romaricoLastUpdateEl)
    romaricoLastUpdateEl.textContent = ahora.toLocaleTimeString("es-MX");

  // Mostrar tabla
  romaricoLoadingState && (romaricoLoadingState.style.display = "none");
  romaricoErrorState && (romaricoErrorState.style.display = "none");
  romaricoTableContainer && (romaricoTableContainer.style.display = "block");

  aplicarFiltrosRomarico();
}

function poblarSelectFiltro(selectEl, valores) {
  if (!selectEl) return;
  const unicos = [...new Set(valores.filter(v => v))].sort();
  const actual = selectEl.value;
  // Guardar opción "Todas"
  const primerOpt = selectEl.options[0];
  selectEl.innerHTML = "";
  selectEl.appendChild(primerOpt || (() => {
    const o = document.createElement("option"); o.value = ""; o.textContent = "Todas"; return o;
  })());
  unicos.forEach(v => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    selectEl.appendChild(o);
  });
  selectEl.value = actual;
}

// ── Cruzar Sheet con Firebase NOMAD ──
function cruzarConNomad() {
  // Construir mapa de nomadRows por nombre normalizado
  const nomadMap = new Map();
  nomadRows.forEach(row => {
    const clave = normalizarNombre(row.paciente);
    if (clave) {
      if (!nomadMap.has(clave)) nomadMap.set(clave, []);
      nomadMap.get(clave).push(row);
    }
  });

  sheetCruzadas = sheetRows.map(sr => {
    const claveSheet = normalizarNombre(sr.paciente);
    let match = null;

    if (claveSheet && nomadMap.has(claveSheet)) {
      match = nomadMap.get(claveSheet)[0];
    } else {
      // Búsqueda parcial: primer nombre + primer apellido
      const partes = claveSheet.split(" ").filter(Boolean);
      if (partes.length >= 2) {
        const parcial = partes.slice(0, 2).join(" ");
        for (const [clave, matches] of nomadMap) {
          if (clave.includes(parcial) || parcial.includes(clave.split(" ").slice(0, 2).join(" "))) {
            match = matches[0];
            break;
          }
        }
      }
    }

    return { ...sr, firebaseMatch: match };
  });

  // Actualizar badge de pestaña
  const sinMatch = sheetCruzadas.filter(r => !r.firebaseMatch).length;
  if (romaricoSinMatchBadge) {
    romaricoSinMatchBadge.textContent = sinMatch;
    romaricoSinMatchBadge.style.display = sinMatch > 0 ? "inline-flex" : "none";
  }
}

// recomputeAll ya fue extendido directamente en su declaración original

function parseFechaSheetIso(fechaStr) {
  if (!fechaStr) return null;
  let dateObj = new Date(fechaStr);
  if (isNaN(dateObj.getTime())) {
    if (fechaStr.includes("/")) {
      const p = fechaStr.split("/");
      if (p.length >= 3) {
        dateObj = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
      }
    }
  }
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  // Ajustar zona horaria a local
  dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
  return dateObj.toISOString().split("T")[0]; // YYYY-MM-DD
}

// ── Filtros Romarico ──
function aplicarFiltrosRomarico() {
  let filas = [...sheetCruzadas];

  const ini = filtroRomaricoFechaInicio ? filtroRomaricoFechaInicio.value : "";
  const fin = filtroRomaricoFechaFin ? filtroRomaricoFechaFin.value : "";
  if (ini || fin) {
    filas = filas.filter(r => {
      const dIso = parseFechaSheetIso(r.fecha);
      if (!dIso) return true; // Si no hay fecha o es inválida, se deja pasar o se filtra. Asumimos dejar pasar o no? Mejor ocultar si no coincide. 
      // Si piden fecha y no tiene, no lo mostramos a menos que no hayan puesto filtro.
      if (ini && dIso < ini) return false;
      if (fin && dIso > fin) return false;
      return true;
    });
  }

  const texto = filtroRomaricoTexto ? filtroRomaricoTexto.value.trim().toLowerCase() : "";
  if (texto) {
    filas = filas.filter(r =>
      normalizarNombre(r.paciente).includes(normalizarNombre(texto)) ||
      (r.prueba || "").toLowerCase().includes(texto) ||
      (r.seguimiento || "").toLowerCase().includes(texto) ||
      (r.notas || "").toLowerCase().includes(texto)
    );
  }

  const formaPago = filtroRomaricoFormaPago ? filtroRomaricoFormaPago.value : "";
  if (formaPago) filas = filas.filter(r => r.formaPago === formaPago);

  const responsable = filtroRomaricoResponsable ? filtroRomaricoResponsable.value : "";
  if (responsable) filas = filas.filter(r => r.responsable === responsable);

  const matchFiltro = filtroRomaricoMatch ? filtroRomaricoMatch.value : "";
  if (matchFiltro === "con") filas = filas.filter(r => r.firebaseMatch);
  if (matchFiltro === "sin") filas = filas.filter(r => !r.firebaseMatch);

  actualizarKpisRomarico(filas);
  actualizarGraficosRomarico(filas);
  renderTablaRomarico(filas);
}

function parseMonto(montoStr) {
  if (!montoStr) return 0;
  const num = parseFloat(montoStr.replace(/[^0-9.-]+/g,""));
  return isNaN(num) ? 0 : num;
}

function esDeEstaSemana(fechaStr) {
  if (!fechaStr) return false;
  // Intentar parseo nativo. JS procesa m/d/yyyy ("5/26/2025") correctamente
  let dateObj = new Date(fechaStr);
  
  if (isNaN(dateObj.getTime())) {
    // Fallback manual por si acaso
    if (fechaStr.includes("/")) {
      const p = fechaStr.split("/");
      if (p.length >= 3) {
        dateObj = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
      }
    }
  }
  
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  
  const now = new Date();
  // Obtener lunes de esta semana
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6: 1); // ajustar cuando es domingo
  const lunes = new Date(now.setDate(diff));
  lunes.setHours(0,0,0,0);
  
  return dateObj >= lunes;
}

function actualizarKpisRomarico(filas) {
  const total = filas.length;
  const conMatch = filas.filter(r => r.firebaseMatch).length;
  const sinMatch = total - conMatch;
  const completo = filas.filter(r => esCompletadoRow(r)).length;

  let montoTotal = 0;
  let deEstaSemana = 0;

  filas.forEach(r => {
    // "si dice completado (en seguimiento O en notas), es que ya se pagó"
    if (esCompletadoRow(r)) {
      montoTotal += parseMonto(r.costoIva);
    }

    // Contar cuántas se solicitaron esta semana
    if (esDeEstaSemana(r.fecha)) {
      deEstaSemana++;
    }
  });

  if (romaricoTotalEl) romaricoTotalEl.textContent = total;
  if (romaricoConMatchEl) romaricoConMatchEl.textContent = conMatch;
  if (romaricoSinMatchEl) romaricoSinMatchEl.textContent = sinMatch;
  if (romaricoCompletoEl) romaricoCompletoEl.textContent = completo;
  if (romaricoMontoTotalEl) romaricoMontoTotalEl.textContent = formatearMoneda(montoTotal);
    
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ROMARICO_UPDATE',
        payload: {
          completo: completo,
          montoTotal: montoTotal,
          totalCount: total
        }
      }, '*');
    }
  } catch(e) {}

  if (romaricoAlertSemana && romaricoTextoSemana) {
    if (deEstaSemana > 0) {
      romaricoAlertSemana.style.display = "flex";
      romaricoTextoSemana.textContent = `¡Excelente! Se han enviado ${deEstaSemana} pruebas en la semana actual.`;
    } else {
      romaricoAlertSemana.style.display = "flex";
      romaricoTextoSemana.textContent = "Aún no hay pruebas registradas con fecha de esta semana.";
    }
  }
}

// ── Gráficos Romarico ──
let chartRomaricoResponsable, chartRomaricoSeguimiento, chartRomaricoPruebas, chartRomaricoMeses;

function actualizarGraficosRomarico(filas) {
  // Responsable (Conteo)
  const porResp = {};
  filas.forEach(r => {
    const resp = r.responsable || "Sin responsable";
    porResp[resp] = (porResp[resp] || 0) + 1;
  });
  chartRomaricoResponsable = crearOActualizarChart(chartRomaricoResponsable, "chartRomaricoResponsable", "bar", {
    labels: Object.keys(porResp),
    datasets: [{ label: "Seguimientos por Responsable", data: Object.values(porResp), backgroundColor: "#6366f1" }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Seguimiento
  const porSeg = {};
  filas.forEach(r => {
    const seg = r.seguimiento || "Sin seguimiento";
    porSeg[seg] = (porSeg[seg] || 0) + 1;
  });
  chartRomaricoSeguimiento = crearOActualizarChart(chartRomaricoSeguimiento, "chartRomaricoSeguimiento", "bar", {
    labels: Object.keys(porSeg),
    datasets: [{ label: "Conteo por estado", data: Object.values(porSeg), backgroundColor: "#14b8a6" }]
  }, { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }}});

  // Pruebas
  const porPrueba = {};
  filas.forEach(r => {
    const pr = r.prueba || "Sin prueba";
    porPrueba[pr] = (porPrueba[pr] || 0) + 1;
  });
  chartRomaricoPruebas = crearOActualizarChart(chartRomaricoPruebas, "chartRomaricoPruebas", "bar", {
    labels: Object.keys(porPrueba),
    datasets: [{ label: "Conteo de Pruebas", data: Object.values(porPrueba), backgroundColor: "#f59e0b" }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});

  // Tendencia Mensual (Romarico)
  const porMes = {};
  filas.forEach(r => {
    // fecha ej. "2024-03-15" o formato de sheet, se asume dd/mm/yyyy o mm/dd/yyyy
    // Si viene del sheet y no normalizamos, tomemos el formato si es dd/mm/yyyy -> mm/yyyy
    let mes = "Sin fecha";
    if (r.fecha) {
      // Intentar extraer de "dd/mm/yyyy" o "yyyy-mm-dd"
      if (r.fecha.includes("/")) {
        const partes = r.fecha.split("/");
        if (partes.length >= 3) {
          // asumiendo dd/mm/yyyy
          mes = partes[2] + "-" + partes[1].padStart(2, '0');
        }
      } else if (r.fecha.includes("-")) {
        const partes = r.fecha.split("-");
        if (partes.length >= 2) {
          mes = partes[0] + "-" + partes[1].padStart(2, '0');
        }
      }
    }
    porMes[mes] = (porMes[mes] || 0) + 1;
  });
  const labelsMes = Object.keys(porMes).sort();
  chartRomaricoMeses = crearOActualizarChart(chartRomaricoMeses, "chartRomaricoMeses", "line", {
    labels: labelsMes,
    datasets: [{ label: "Solicitudes", data: labelsMes.map(l => porMes[l]), borderColor: "#ec4899", backgroundColor: "rgba(236,72,153,0.2)" }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }}});
}


// ── Renderizar tabla Romarico ──
function renderTablaRomarico(filas) {
  if (!tablaRomaricoBody) return;
  tablaRomaricoBody.innerHTML = "";

  filas.forEach(row => {
    const tr = document.createElement("tr");
    tr.className = row.firebaseMatch ? "tr-con-match" : "tr-sin-match";

    // 1. Match badge
    const tdMatch = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge-match " + (row.firebaseMatch ? "con-match" : "sin-match");
    badge.textContent = row.firebaseMatch ? "✅ Match" : "⚠️ Sin match";
    tdMatch.appendChild(badge);

    // 2. Fecha solicitud
    const tdFecha = document.createElement("td");
    tdFecha.textContent = row.fecha || "—";

    // 3. Paciente
    const tdPac = document.createElement("td");
    tdPac.textContent = row.paciente || "";
    tdPac.style.fontWeight = "500";

    // 4. Prueba
    const tdPrueba = document.createElement("td");
    tdPrueba.textContent = row.prueba || "";

    // 5. Costo
    const tdCosto = document.createElement("td");
    tdCosto.textContent = row.costoIva || "—";
    tdCosto.style.textAlign = "right";
    tdCosto.style.whiteSpace = "nowrap";

    // 6. Forma de pago
    const tdPago = document.createElement("td");
    tdPago.textContent = row.formaPago || "—";

    // 7. Seguimiento Romarico
    const tdSeg = document.createElement("td");
    tdSeg.textContent = row.seguimiento || "";
    // Color: primero revisa el texto de seguimiento, si no, revisa si la fila completa es completado
    const cls = classeEstado(row.seguimiento) || (esCompletadoRow(row) ? "status-completo" : "");
    if (cls) tdSeg.className = cls;
    tdSeg.style.maxWidth = "240px";
    tdSeg.style.whiteSpace = "normal";
    tdSeg.style.lineHeight = "1.3";

    // 8. Notas/Proceso
    const tdNotas = document.createElement("td");
    tdNotas.textContent = row.notas || "";
    tdNotas.style.maxWidth = "260px";
    tdNotas.style.whiteSpace = "normal";
    tdNotas.style.lineHeight = "1.3";
    tdNotas.style.fontSize = "0.73rem";
    tdNotas.style.color = "#9ca3af";

    // 9. Apoyo COI
    const tdCoi = document.createElement("td");
    tdCoi.textContent = row.apoyoCoi || "—";

    // 10. Responsable
    const tdResp = document.createElement("td");
    tdResp.textContent = row.responsable || "—";

    // 11. Separador Firebase (columna divisora)
    const tdSep = document.createElement("td");
    tdSep.textContent = "— Firebase —";

    // Datos Firebase (12-16)
    const fb = row.firebaseMatch;

    const tdFolio = document.createElement("td");
    tdFolio.textContent = fb ? (fb.folio || "—") : "";
    if (!fb) tdFolio.className = "celda-vacia";
    if (!fb) tdFolio.textContent = "sin registro";

    const tdKam = document.createElement("td");
    tdKam.textContent = fb ? (fb.kam || "—") : "";

    const tdSt1 = document.createElement("td");
    if (fb) {
      tdSt1.textContent = fb.status1 || "—";
      const cs = classeEstado(fb.status1);
      if (cs) tdSt1.className = cs;
    } else {
      tdSt1.className = "celda-vacia";
      tdSt1.textContent = "—";
    }

    const tdSt2 = document.createElement("td");
    if (fb) {
      tdSt2.textContent = fb.status2 || "—";
    } else {
      tdSt2.className = "celda-vacia";
      tdSt2.textContent = "—";
    }

    const tdMotivo = document.createElement("td");
    if (fb) {
      tdMotivo.textContent = fb.motivo || "—";
      tdMotivo.style.maxWidth = "220px";
      tdMotivo.style.whiteSpace = "normal";
      tdMotivo.style.fontSize = "0.73rem";
    } else {
      tdMotivo.className = "celda-vacia";
      tdMotivo.textContent = "—";
    }

    tr.append(tdMatch, tdFecha, tdPac, tdPrueba, tdCosto, tdPago,
              tdSeg, tdNotas, tdCoi, tdResp,
              tdSep, tdFolio, tdKam, tdSt1, tdSt2, tdMotivo);
    tablaRomaricoBody.appendChild(tr);
  });

  if (contadorRomaricoEl) contadorRomaricoEl.textContent = filas.length + " filas";
}

// ── Limpiar filtros Romarico ──
function limpiarFiltrosRomarico() {
  if (filtroRomaricoTexto) filtroRomaricoTexto.value = "";
  if (filtroRomaricoFormaPago) filtroRomaricoFormaPago.value = "";
  if (filtroRomaricoResponsable) filtroRomaricoResponsable.value = "";
  if (filtroRomaricoMatch) filtroRomaricoMatch.value = "";

  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  if (filtroRomaricoFechaInicio) filtroRomaricoFechaInicio.value = primerDia.toISOString().split("T")[0];
  if (filtroRomaricoFechaFin) filtroRomaricoFechaFin.value = ultimoDia.toISOString().split("T")[0];
  
  aplicarFiltrosRomarico();
}

// ── Exportar CSV Romarico ──
function exportarCsvRomarico() {
  if (!sheetCruzadas.length) { alert("No hay datos para exportar."); return; }

  const encabezados = [
    "match","fecha_solicitud","paciente","prueba","costo_iva","forma_pago",
    "seguimiento_romarico","notas","apoyo_coi","responsable",
    "folio_firebase","kam","status1","status2","comentario_firebase"
  ];

  const rows = sheetCruzadas.map(r => {
    const fb = r.firebaseMatch;
    return [
      fb ? "Con match" : "Sin match",
      r.fecha, r.paciente, r.prueba, r.costoIva, r.formaPago,
      r.seguimiento, r.notas, r.apoyoCoi, r.responsable,
      fb ? (fb.folio || "") : "",
      fb ? (fb.kam || "") : "",
      fb ? (fb.status1 || "") : "",
      fb ? (fb.status2 || "") : "",
      fb ? (fb.motivo || "") : ""
    ];
  });

  const sep = ";";
  let csv = "\uFEFF";
  csv += "sep=" + sep + "\n";
  csv += encabezados.join(sep) + "\n";
  rows.forEach(r => {
    csv += r.map(v => {
      const s = String(v === null || v === undefined ? "" : v).replace(/"/g, '""');
      return (s.includes(sep) || s.includes("\n")) ? `"${s}"` : s;
    }).join(sep) + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "seguimiento_romarico.csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
