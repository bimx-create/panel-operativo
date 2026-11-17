const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "main.js"), "utf8");
const start = source.indexOf("function seleccionarMesActual()");
const end = source.indexOf("// 5) KPIs", start);
assert.ok(start >= 0 && end > start);

const fields = Object.fromEntries(
  ["filtroSede", "filtroFechaInicio", "filtroFechaFin", "filtroTexto"].map(id => [id, { value: "" }])
);
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
let dashboardRows;
const context = {
  $, SEDES: ["", "Morelia"], currentUser: { role: "admin" },
  allRows: [
    { fechaInfusion: `${previousMonth}-15`, marca: "SANARÉ", sede: "Morelia", paciente: "Anterior" },
    { fechaInfusion: `${month}-15`, marca: "SANARÉ", sede: "Morelia", paciente: "Actual" }
  ],
  filteredRows: [],
  document: { querySelectorAll: () => [{ checked: true, value: "SANARÉ" }] },
  normalizarTexto: value => String(value || "").toLowerCase(),
  renderKPIs() {}, renderTable() {},
  renderExecutiveDashboard: rows => { dashboardRows = rows; },
  Date
};
function $(id) { return fields[id]; }
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
vm.runInContext("initFilters(); applyFilters();", context);

assert.equal(fields.filtroFechaInicio.value, `${month}-01`);
assert.equal(fields.filtroFechaFin.value, `${month}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
assert.deepEqual(Array.from(context.filteredRows, row => row.paciente), ["Actual"]);
assert.deepEqual(Array.from(dashboardRows, row => row.paciente), ["Actual"]);
console.log("El SAI abre con el mes actual en la tabla y el resumen ejecutivo.");
