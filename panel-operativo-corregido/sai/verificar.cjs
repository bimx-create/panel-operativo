const fs = require('fs');
const vm = require('vm');
const root = __dirname + '/Llenado-SAI-main/';
const source = fs.readFileSync(root + 'dashboard.js', 'utf8');
const context = {
  normalizarTexto: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function apartadoValorCelda'), source.indexOf('function estadisticasNumericas')), context);
const cases = [
  ['CANCER DE MAMA TRIPLE NEGATIVO', 'CÁNCER DE MAMA'],
  ['CÁNCER DE MAMA IZQUIERDO', 'CÁNCER DE MAMA'],
  ['CANCER DE MAMA METASTASICO', 'CÁNCER DE MAMA'],
  ['CA DE MAMA', 'CÁNCER DE MAMA'],
  ['CÁNCER DE MAMA RECURRENTE Y METASTÁSICO', 'CÁNCER DE MAMA'],
  ['CÁNCER DE OVARIO', 'CÁNCER DE OVARIO'],
  ['CÁNCER DE MAMA Y OVARIO', 'CÁNCER DE MAMA Y OVARIO'],
  ['CÁNCER DE CUELLO UTERINO', 'CÁNCER CERVICOUTERINO'],
  ['DIABETES TIPO 2', 'DIABETES MELLITUS TIPO 2'],
  ['DM2', 'DIABETES MELLITUS TIPO 2'],
  ['', 'SIN DATO']
];
for (const [input, expected] of cases) {
  const actual = context.homologarDiagnostico(input);
  if (actual !== expected) throw Error(`${input}: ${actual} != ${expected}`);
}
const distribution = context.distribucionCategorica(cases.slice(0, 5).map(([diagnostico]) => ({ diagnostico })), 'diagnostico');
if (distribution.length !== 1 || distribution[0][1] !== 5) throw Error('El conteo de cáncer de mama no se consolidó');
const montos = context.montosPorDiagnostico([
  { diagnostico: 'CÁNCER DE MAMA', montoServicio: 100 },
  { diagnostico: 'CANCER DE MAMA TRIPLE NEGATIVO', montoServicio: '200' },
  { diagnostico: 'CA DE MAMA', montoServicio: 0 },
  { diagnostico: 'CÁNCER DE MAMA IZQUIERDO', montoServicio: null },
  { diagnostico: 'CÁNCER DE OVARIO', montoServicio: 50 },
  { diagnostico: 'LEUCEMIA', montoServicio: 'sin dato' }
]);
const mama = montos.get('CÁNCER DE MAMA');
if (mama.montoTotal !== 300 || mama.registrosConMonto !== 3 || mama.montoTotal / mama.registrosConMonto !== 100) throw Error('Monto o ticket de mama incorrecto');
if (montos.get('CÁNCER DE OVARIO').montoTotal !== 50 || montos.get('LEUCEMIA').registrosConMonto !== 0) throw Error('Montos de otros diagnósticos incorrectos');
console.log(`${cases.length} casos, distribución, montos y ticket promedio correctos`);
