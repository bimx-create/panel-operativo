const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const folder of ['sai', path.join('panel-operativo-corregido', 'sai')]) {
  const source = fs.readFileSync(path.join(__dirname, folder, 'dashboard.js'), 'utf8');
  const detail = { innerHTML: '' };
  const table = { querySelector: () => ({ children: [1] }) };
  const workbook = { sheets: {} };
  const context = {
    document: { documentElement: { getAttribute: () => 'dark' }, addEventListener: () => {} },
    window: { addEventListener: () => {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    normalizarTexto: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''),
    escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    $: id => id === 'apartadoDetalle' ? detail : id === 'apartadoTabla' ? table : null,
    XLSX: { utils: {
      table_to_sheet: () => ({ summary: true }),
      aoa_to_sheet: rows => ({ rows }),
      book_new: () => workbook,
      book_append_sheet: (book, sheet, name) => { book.sheets[name] = sheet; }
    }, writeFile: (book, name) => { book.name = name; } },
    showToast: () => {}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext(`
    execUltimaData = [
      { paciente: 'Ana Pérez', sexo: 'F', tratamiento: 'R-CHOP', medicos: 'Dra. López' },
      { paciente: 'Luis Ruiz', sexo: 'M', tratamiento: 'QT', medicos: 'Dr. García' },
      { paciente: 'Eva Solís', sexo: 'F', tratamiento: '', medicos: '' }
    ];
    apartadoActivo = 'sexo';
    apartadoDetBuscarTexto = 'f';
    renderDetalleApartado();
    exportarApartadoAExcel({ key: 'sexo', label: 'Sexo', tipo: 'categorica' });
  `, context);
  assert.match(detail.innerHTML, /Detalle por paciente/);
  assert.match(detail.innerHTML, /Ana Pérez/);
  assert.match(detail.innerHTML, /R-CHOP/);
  assert.match(detail.innerHTML, /Dra\. López/);
  assert.doesNotMatch(detail.innerHTML, /Luis Ruiz/);
  assert.deepEqual(Object.keys(workbook.sheets), ['Resumen', 'Pacientes']);
  assert.deepEqual(JSON.parse(JSON.stringify(workbook.sheets.Pacientes.rows)), [
    ['Sexo', 'Paciente', 'Tratamiento', 'Médico encargado'],
    ['F', 'Ana Pérez', 'R-CHOP', 'Dra. López'],
    ['F', 'Eva Solís', '', '']
  ]);
  console.log(`Vista y exportación correctas: ${folder}`);
}
