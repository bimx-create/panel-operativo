const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const dashboard = fs.readFileSync(path.join(__dirname, "dashboard.js"), "utf8");
const estadistico = fs.readFileSync(path.join(__dirname, "estadistico-casos.js"), "utf8");
const context = {
  normalizarTexto: value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  document: { addEventListener() {} }
};
vm.createContext(context);
vm.runInContext(dashboard.slice(dashboard.indexOf("function apartadoValorCelda"), dashboard.indexOf("function estadisticasNumericas")), context);
vm.runInContext(estadistico, context);

const registros = [
  { marca: "SANARÉ", sede: "Morelia", fechaInfusion: "2025-01-05", paciente: "Ana Pérez", diagnostico: "CÁNCER DE MAMA" },
  { marca: "SANARÉ", sede: "Morelia", fechaInfusion: "2025-04-12", paciente: " ANA  PEREZ ", diagnostico: "CA DE MAMA" },
  { marca: "SANARÉ", sede: "Toluca", fechaInfusion: "2025-06-10", paciente: "Ana Pérez", diagnostico: "CÁNCER DE MAMA" },
  { marca: "SANARÉ", sede: "Toluca", fechaInfusion: "2025-03-02", paciente: "Luis", diagnostico: "CÁNCER DE OVARIO" },
  { marca: "SANARÉ", sede: "Morelia", fechaInfusion: "2024-02-01", paciente: "Ana Pérez", diagnostico: "CÁNCER DE MAMA" },
  { marca: "NOMAD", sede: "Morelia", fechaInfusion: "2025-02-01", paciente: "Otro", diagnostico: "CÁNCER DE MAMA" },
  { marca: "SANARÉ", sede: "Toluca", fechaInfusion: "2025-08-01", paciente: "Mario", diagnostico: "DIABETES TIPO 2" },
  { marca: "SANARÉ", sede: "Toluca", fechaInfusion: "", paciente: "Eva", diagnostico: "CÁNCER DE MAMA" },
  { marca: "SANARÉ", sede: "Toluca", fechaInfusion: "2025-08-01", paciente: "", diagnostico: "CÁNCER DE MAMA" }
];
const todos = context.construirEstadisticoCasos(registros);
assert.deepEqual(Array.from(todos.filas, f => [f.anio, f.total]), [["2025", 2], ["2024", 1]]);
assert.equal(todos.filas[0].sedes.morelia, 1);
assert.equal(todos.filas[0].sedes.toluca, 2);
assert.equal(todos.totalPeriodo, 2);
assert.equal(todos.sinFecha, 1);
assert.equal(todos.sinPaciente, 1);
const mama = context.construirEstadisticoCasos(registros, "Cáncer / Neoplasia de Mama");
assert.equal(mama.filas[0].total, 1);
assert.equal(mama.filas[0].sedes.toluca, 1);
assert.equal(mama.totalPeriodo, 1);
assert.equal(mama.columnasSede.length, 2);
assert.equal(context.homologarDiagnostico("CA EPIDERMOIDE DE PENE"), "CÁNCER DE PENE");
assert.equal(context.homologarDiagnostico("CÁNCER DE PRÓSTATA"), "CÁNCER DE PRÓSTATA");
assert.notEqual(context.homologarDiagnostico("CA EPIDERMOIDE DE PENE"), context.homologarDiagnostico("CÁNCER DE PRÓSTATA"));
const genitalMasculino = "Cáncer Genitourinario Masculino (Próstata / Pene / Testículo)";
assert.equal(context.categoriaCancer("CA EPIDERMOIDE DE PENE"), genitalMasculino);
assert.equal(context.categoriaCancer("CÁNCER DE PRÓSTATA"), genitalMasculino);
const agrupados = context.construirEstadisticoCasos([
  { marca: "SANARÉ", sede: "Morelia", fechaInfusion: "2025-01-01", paciente: "Pedro", diagnostico: "CÁNCER DE PRÓSTATA" },
  { marca: "SANARÉ", sede: "Morelia", fechaInfusion: "2025-02-01", paciente: "Juan", diagnostico: "CA EPIDERMOIDE DE PENE" }
], genitalMasculino);
assert.equal(agrupados.filas[0].total, 2);
const equivalencias = [
  ["CÁNCER DE COLON", "Cáncer / Neoplasia de Colón"],
  ["CÁNCER DE RECTO", "Cáncer / Neoplasia de Recto / Colorrectal"],
  ["CÁNCER DE COLON Y RECTO", "Cáncer / Neoplasia de Recto / Colorrectal"],
  ["CÁNCER DE MAMA CON METÁSTASIS PULMONAR", "Cáncer / Neoplasia de Mama"],
  ["CÁNCER DE OVARIO", "Cáncer / Neoplasia de Ovario"],
  ["CÁNCER CERVICOUTERINO", "Cáncer Ginecológico (Endometrio / Cérvix / Vagina / Vulva)"],
  ["COLANGIOCARCINOMA", "Colangiocarcinoma / Vías Biliares / Vesícula"],
  ["OSTEOSARCOMA", "Sarcomas / Tejidos Blandos / Óseo"],
  ["LEUCEMIA", "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)"],
  ["CÁNCER RENAL", "Cáncer / Neoplasia Renal"],
  ["CÁNCER DE VEJIGA", "Cáncer de Vías Urinarias / Vejiga / Urotelio"],
  ["CÁNCER DE HÍGADO", "Cáncer de Hígado"],
  ["CÁNCER DE PULMÓN", "Cáncer / Neoplasia de Pulmón"],
  ["CÁNCER DE PÁNCREAS", "Cáncer / Neoplasia de Páncreas"],
  ["CÁNCER DE TIROIDES", "Cáncer / Neoplasia de Tiroides"],
  ["CÁNCER DE ESTÓMAGO", "Cáncer / Neoplasia Gástrica / Esófago"],
  ["CÁNCER DE TESTÍCULO", genitalMasculino],
  ["SARCOMA DE ÚTERO", "Sarcomas / Tejidos Blandos / Óseo"],
  ["LINFOMA CUTÁNEO", "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)"],
  ["MELANOMA OCULAR", "Cáncer de Ojo"],
  ["COLANGIOCARCINOMA HEPÁTICO", "Colangiocarcinoma / Vías Biliares / Vesícula"],
  ["CÁNCER DE PELVIS RENAL", "Cáncer de Vías Urinarias / Vejiga / Urotelio"],
  ["CÁNCER DE SENO PARANASAL", "Cáncer de Cabeza y Cuello"]
];
for (const [diagnostico, esperado] of equivalencias) {
  assert.equal(context.categoriaCancer(diagnostico), esperado, diagnostico);
}
assert.equal(context.categoriaCancer("DIABETES TIPO 2"), "");
assert.equal(context.categoriaCancer("NEOPLASIA BENIGNA DE MAMA"), "");
assert.equal(context.categoriaCancer("CÁNCER DE MAMA Y OVARIO"), "Otros cánceres / Sitios múltiples");
console.log("Estadístico anual, filtro, sedes y deduplicación correctos.");
