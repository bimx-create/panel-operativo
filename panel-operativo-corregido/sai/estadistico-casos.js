// Estadístico de pacientes únicos de Sanaré por año, diagnóstico y sede.
// Se alimenta de todos los registros cargados, sin depender de los filtros
// operativos de la tabla principal.
function esDiagnosticoOncologico(diagnostico) {
  const texto = normalizarTexto(diagnostico);
  return /\b(cancer|leucemia|linfoma|mieloma|melanoma|sarcoma|carcinoma|adenocarcinoma|colangiocarcinoma|glioblastoma|mesotelioma|hepatocarcinoma|osteosarcoma|gist)\b|\b(neoplasia|tumor) malign[ao]\b|^ca\b/.test(texto);
}

// Categorías de reporte basadas en sitio primario. La referencia mantiene
// separados colon/recto, ovario/otros ginecológicos y riñón/vías urinarias.
// Los grupos amplios son deliberados: no sustituyen el diagnóstico clínico.
const CATEGORIAS_CANCER = [
  { nombre: "Cáncer / Neoplasia de Mama", patron: /\b(mama|mamari[ao]|seno|senos)\b/ },
  { nombre: "Cáncer / Neoplasia de Recto / Colorrectal", patron: /\b(recto|rectal|colorrectal|colorectal)\b/ },
  { nombre: "Cáncer / Neoplasia de Colón", patron: /\b(colon|colonico|colonica)\b/ },
  { nombre: "Cáncer / Neoplasia de Pulmón", patron: /\b(pulmon|pulmonar|bronquio|bronquial|traqueobronquial)\b/ },
  { nombre: "Cáncer / Neoplasia de Páncreas", patron: /\b(pancreas|pancreatic[ao])\b/ },
  { nombre: "Cáncer / Neoplasia de Ovario", patron: /\b(ovario|ovaric[ao])\b/ },
  { nombre: "Sarcomas / Tejidos Blandos / Óseo", patron: /\b(sarcoma|osteosarcoma|rabdomiosarcoma|ewing|tejidos? blandos?|oseo|osea|hueso)\b/ },
  { nombre: "Colangiocarcinoma / Vías Biliares / Vesícula", patron: /\b(colangiocarcinoma|vias? biliares?|conductos? biliares?|vesicula biliar)\b/ },
  { nombre: "Cáncer / Neoplasia de Tiroides", patron: /\b(tiroides|tiroide[ao])\b/ },
  { nombre: "Cáncer / Neoplasia Gástrica / Esófago", patron: /\b(gastric[ao]|estomago|esofago|esofagic[ao])\b/ },
  { nombre: "Cáncer Ginecológico (Endometrio / Cérvix / Vagina / Vulva)", patron: /\b(cervicouterino|cervical|cervix|cuello uterino|utero|uterin[ao]|endometrio|endometrial|vagina|vaginal|vulva|trompa de falopio|trompas de falopio)\b/ },
  { nombre: "Cáncer Genitourinario Masculino (Próstata / Pene / Testículo)", patron: /\b(prostata|prostatic[ao]|pene|penian[ao]|testiculo|testicular)\b/ },
  { nombre: "Sistema Nervioso Central / Cerebro", patron: /\b(cerebro|cerebral|encefalo|sistema nervioso central|medula espinal|glioblastoma|astrocitoma|meduloblastoma)\b/ },
  { nombre: "Cáncer / Neoplasia Renal", patron: /\b(renal|rinon|rinones|nefroblastoma|tumor de wilms)\b/ },
  { nombre: "Cáncer de Cabeza y Cuello", patron: /\b(cabeza y cuello|orofaringe|nasofaringe|hipofaringe|faringe|laringe|lengua|boca|cavidad oral|labio|glandulas? salivales?|seno paranasal|cavidad nasal)\b/ },
  { nombre: "Cáncer de Vías Urinarias / Vejiga / Urotelio", patron: /\b(vejiga|vesical|vias? urinarias?|urotelio|urotelial|ureter|uretra|pelvis renal)\b/ },
  { nombre: "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)", patron: /\b(leucemia|linfoma|mieloma|hodgkin)\b/ },
  { nombre: "Cáncer de Piel / Melanoma", patron: /\b(melanoma|piel|cutane[ao]|basocelular|celulas de merkel)\b/ },
  { nombre: "Cáncer de Hígado", patron: /\b(higado|hepatic[ao]|hepatocarcinoma|hepatocelular)\b/ },
  { nombre: "Cáncer Digestivo (Intestino Delgado / Ano / Apéndice)", patron: /\b(intestino delgado|duodeno|yeyuno|ileon|ano|anal|apendice|peritoneo)\b/ },
  { nombre: "Cáncer de Tórax / Pleura / Mediastino", patron: /\b(pleura|pleural|mesotelioma|mediastino|timo|timoma)\b/ },
  { nombre: "Cáncer Endocrino / Suprarrenal", patron: /\b(suprarrenal|adrenal|paratiroides|hipofisis|feocromocitoma)\b/ },
  { nombre: "Cáncer de Ojo", patron: /\b(ojo|ocular|retina|retinoblastoma|uveal)\b/ }
];

function categoriaCancer(diagnostico) {
  const homologado = homologarDiagnostico(diagnostico);
  const texto = normalizarTexto(diagnostico);
  if (!esDiagnosticoOncologico(texto) && !esDiagnosticoOncologico(homologado)) return "";
  // Las metástasis no cambian el sitio del tumor primario. Ante una frase
  // explícita de diseminación, se ignora el destino después de esa frase.
  const primario = texto.replace(/\b(?:con )?(?:metastasis|metastasico|metastasica|mts)\b.*$/, "").trim() || texto;
  if (/\bcolon\b/.test(primario) && /\brecto\b/.test(primario)) return "Cáncer / Neoplasia de Recto / Colorrectal";
  // Algunas familias tienen prioridad sobre el órgano mencionado, como en
  // "sarcoma de útero", "linfoma cutáneo" y "melanoma ocular".
  if (/\b(sarcoma|osteosarcoma|rabdomiosarcoma|ewing)\b/.test(primario)) return "Sarcomas / Tejidos Blandos / Óseo";
  if (/\b(leucemia|linfoma|mieloma|hodgkin)\b/.test(primario)) return "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)";
  if (/\bmelanoma\b/.test(primario) && /\b(ocular|ojo|uveal|retina)\b/.test(primario)) return "Cáncer de Ojo";
  if (/\bseno paranasal\b/.test(primario)) return "Cáncer de Cabeza y Cuello";
  if (/\b(colangiocarcinoma|vias? biliares?|conductos? biliares?)\b/.test(primario)) return "Colangiocarcinoma / Vías Biliares / Vesícula";
  if (/\bpelvis renal\b/.test(primario)) return "Cáncer de Vías Urinarias / Vejiga / Urotelio";
  const encontrados = CATEGORIAS_CANCER.filter(({ patron }) => patron.test(primario));
  if (encontrados.length === 1) return encontrados[0].nombre;
  if (encontrados.length > 1) return "Otros cánceres / Sitios múltiples";
  return "Otros cánceres / Sitio no especificado";
}

function construirEstadisticoCasos(registros, tipo = "") {
  const pacientesPorAnio = new Map();
  const pacientesPorSede = new Map();
  const pacientesPeriodo = new Set();
  const sedes = new Map();
  const tipos = new Set();
  let sinFecha = 0;
  let sinPaciente = 0;

  for (const registro of registros) {
    if (normalizarTexto(registro.marca) !== "sanare") continue;
    const sede = String(registro.sede || "").trim() || "Sin sede";
    const claveSede = normalizarTexto(sede);
    if (!sedes.has(claveSede)) sedes.set(claveSede, sede);
    const categoria = categoriaCancer(registro.diagnostico);
    if (!categoria) continue;
    tipos.add(categoria);
    if (tipo && categoria !== tipo) continue;

    const fecha = String(registro.fechaInfusion || "");
    const partesFecha = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(fecha);
    const fechaUTC = partesFecha && new Date(Date.UTC(+partesFecha[1], +partesFecha[2] - 1, +partesFecha[3]));
    const anio = fechaUTC && fechaUTC.getUTCFullYear() === +partesFecha[1] &&
      fechaUTC.getUTCMonth() + 1 === +partesFecha[2] && fechaUTC.getUTCDate() === +partesFecha[3]
      ? partesFecha[1] : "";
    if (!anio) { sinFecha++; continue; }
    const paciente = clavePaciente(registro.paciente);
    if (!paciente) { sinPaciente++; continue; }

    if (!pacientesPorAnio.has(anio)) pacientesPorAnio.set(anio, new Set());
    pacientesPorAnio.get(anio).add(paciente);
    if (!pacientesPorSede.has(anio)) pacientesPorSede.set(anio, new Map());
    const mapaSedes = pacientesPorSede.get(anio);
    if (!mapaSedes.has(claveSede)) mapaSedes.set(claveSede, new Set());
    mapaSedes.get(claveSede).add(paciente);
    pacientesPeriodo.add(paciente);
  }

  const columnasSede = Array.from(sedes, ([clave, nombre]) => ({ clave, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const anios = Array.from(pacientesPorAnio.keys()).sort((a, b) => b.localeCompare(a));
  const filas = anios.map(anio => ({
    anio,
    total: pacientesPorAnio.get(anio).size,
    sedes: Object.fromEntries(columnasSede.map(({ clave }) => [
      clave, pacientesPorSede.get(anio).get(clave)?.size || 0
    ]))
  }));
  const totalesSede = Object.fromEntries(columnasSede.map(({ clave }) => {
    const pacientes = new Set();
    for (const mapa of pacientesPorSede.values()) {
      for (const paciente of mapa.get(clave) || []) pacientes.add(paciente);
    }
    return [clave, pacientes.size];
  }));
  return {
    tipos: Array.from(tipos).sort((a, b) => a.localeCompare(b, "es")),
    columnasSede, filas, totalPeriodo: pacientesPeriodo.size,
    totalesSede, sinFecha, sinPaciente
  };
}

function renderEstadisticoCasos() {
  const panel = document.getElementById("execTabCasos");
  if (!panel || !currentUser || currentUser.role !== "admin") return;
  const select = document.getElementById("casosTipo");
  const tipo = select.value;
  const resumen = construirEstadisticoCasos(allRows || [], tipo);
  select.replaceChildren(new Option("Todas las categorías", ""));
  for (const nombre of resumen.tipos) select.add(new Option(nombre, nombre));
  select.value = tipo;

  const tabla = document.getElementById("casosTabla");
  tabla.querySelector("thead").innerHTML = `<tr><th scope="col">Año</th><th scope="col">Sanaré general</th>${resumen.columnasSede.map(s => `<th scope="col">${escapeHtml(s.nombre)}</th>`).join("")}</tr>`;
  tabla.querySelector("tbody").innerHTML = resumen.filas.length
    ? resumen.filas.map(f => `<tr><th scope="row">${f.anio}</th><td>${f.total}</td>${resumen.columnasSede.map(s => `<td>${f.sedes[s.clave]}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${2 + resumen.columnasSede.length}">No hay casos con año, paciente y diagnóstico para este filtro.</td></tr>`;
  tabla.querySelector("tfoot").innerHTML = `<tr><th scope="row">Pacientes únicos en el período</th><td>${resumen.totalPeriodo}</td>${resumen.columnasSede.map(s => `<td>${resumen.totalesSede[s.clave]}</td>`).join("")}</tr>`;
  document.getElementById("casosResumen").textContent = `${resumen.totalPeriodo.toLocaleString("es-MX")} pacientes únicos · ${resumen.filas.length} año(s) · ${resumen.columnasSede.length} sede(s)`;
  document.getElementById("casosNota").textContent = `El año corresponde a la fecha de infusión, no a la fecha de diagnóstico. Se agrupa por sitio primario; los diagnósticos con varios sitios o sin sitio claro quedan en Otros cánceres. Las cifras por sede pueden superar el total general si una persona acudió a varias sedes. Se excluyeron ${resumen.sinFecha} registro(s) sin fecha válida y ${resumen.sinPaciente} sin nombre de paciente.`;
}

function exportarEstadisticoCasos() {
  if (typeof XLSX === "undefined") {
    showToast("No se pudo cargar la herramienta de Excel.", "error");
    return;
  }
  const tipo = document.getElementById("casosTipo").value;
  const resumen = construirEstadisticoCasos(allRows || [], tipo);
  const encabezados = ["Año", "Sanaré general", ...resumen.columnasSede.map(s => s.nombre)];
  const datos = [
    ["Casos de Sanaré por año y sede"],
    ["Categoría de diagnóstico", tipo || "Todas las categorías"],
    ["Criterio", "Pacientes únicos por año de fecha de infusión"],
    [], encabezados,
    ...resumen.filas.map(f => [f.anio, f.total, ...resumen.columnasSede.map(s => f.sedes[s.clave])]),
    ["Pacientes únicos en el período", resumen.totalPeriodo, ...resumen.columnasSede.map(s => resumen.totalesSede[s.clave])],
    [], ["Nota", "Una persona atendida en varias sedes cuenta una vez en Sanaré general."],
    ["Registros excluidos sin fecha", resumen.sinFecha],
    ["Registros excluidos sin paciente", resumen.sinPaciente]
  ];
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(datos);
  hoja["!cols"] = encabezados.map((_, i) => ({ wch: i === 0 ? 34 : 20 }));
  XLSX.utils.book_append_sheet(libro, hoja, "Casos por año");
  XLSX.writeFile(libro, `sanare_casos_por_anio_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("casosTipo")?.addEventListener("change", renderEstadisticoCasos);
  document.getElementById("casosExportar")?.addEventListener("click", exportarEstadisticoCasos);
});
