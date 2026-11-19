// Calcula utilidad solo cuando cada registro tiene una cotización y costos identificables.
// Una coincidencia por nombre de paciente no basta para repartir una cotización entre varios servicios.
(() => {
  let cotizaciones = [];
  let cotizacionesRecibidas = false;
  let filasActuales = [];
  let reporteUrl = null;

  const normalizar = value => String(value ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

  function numero(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const clean = String(value ?? "").replace(/[$,\s]/g, "");
    return clean ? Number(clean) : NaN;
  }

  function nombrePaciente(quote) {
    return normalizar(quote.paciente || quote.PACIENTE || quote.nombrePaciente || quote.form?.paciente);
  }

  function nombreConcepto(item) {
    const nested = item.bio || item.innovador || item.patente || item.generico || item.serv || {};
    return item.nombre || item.name || item.descripcion || item.concepto ||
      nested.DESCRIPCION || nested.descripcion || nested.nombre || nested.name ||
      nested["NOMBRE COMERCIAL"] || nested.PA || item.ESQUEMA || item.esquema ||
      item.pa || item.servicio || "";
  }

  function conceptos(quote) {
    let items = quote.state?.items;
    if (!Array.isArray(items) || !items.length) {
      items = [...(Array.isArray(quote.servicios) ? quote.servicios : []),
        ...(Array.isArray(quote.medicamentos) ? quote.medicamentos : [])];
    }
    if (!items.length && Array.isArray(quote.items)) items = quote.items;
    return items.map(item => ({
      nombre: nombreConcepto(item),
      cantidad: numero(item.qty ?? item.cantidad ?? item.cant ?? 1)
    }));
  }

  function catalogo() {
    return (window.COSTOS_DATA?.catalogo || []).map(row => ({
      nombre: normalizar(row.__EMPTY_1),
      costo: numero(row.__EMPTY_2)
    })).filter(row => row.nombre && Number.isFinite(row.costo) && row.costo > 0);
  }

  function buscarCosto(nombre, precios) {
    const key = normalizar(nombre);
    if (key.length < 3) return { motivo: "Concepto sin nombre" };
    const exactos = precios.filter(row => row.nombre === key);
    // Solo se permite un nombre más largo cuando hay una única presentación posible.
    const posibles = exactos.length ? exactos : precios.filter(row => row.nombre.startsWith(key + " "));
    const costos = [...new Set(posibles.map(row => row.costo))];
    if (costos.length === 1) return { costo: costos[0] };
    return { motivo: posibles.length ? `Precio o presentación ambigua: ${nombre}` : `Sin costo en catálogo: ${nombre}` };
  }

  function calcular(rows, quotes, precios) {
    const porPaciente = new Map();
    for (const quote of quotes) {
      const key = nombrePaciente(quote);
      if (!key) continue;
      if (!porPaciente.has(key)) porPaciente.set(key, []);
      porPaciente.get(key).push(quote);
    }
    const vecesPaciente = new Map();
    for (const row of rows) {
      const key = normalizar(row.paciente);
      if (key) vecesPaciente.set(key, (vecesPaciente.get(key) || 0) + 1);
    }

    const detalle = [];
    let utilidad = 0;
    let completos = 0;
    for (const row of rows) {
      const monto = numero(row.montoServicio);
      const key = normalizar(row.paciente);
      const base = { paciente: row.paciente || "", sede: row.sede || "", monto, costo: null, utilidad: null, estado: "", conceptos: "" };
      const matches = porPaciente.get(key) || [];
      if (!key || !Number.isFinite(monto) || monto <= 0) base.estado = "Sin paciente o monto válido";
      else if (vecesPaciente.get(key) > 1) base.estado = "Paciente con varios servicios: falta vincular cotización por servicio";
      else if (matches.length === 0) base.estado = "Sin cotización";
      else if (matches.length > 1) base.estado = "Varias cotizaciones: falta identificar la de este servicio";
      else {
        const items = conceptos(matches[0]);
        if (!items.length) base.estado = "Cotización sin conceptos detallados";
        else {
          let costo = 0;
          const lineas = [];
          for (const item of items) {
            if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
              base.estado = `Cantidad inválida: ${item.nombre || "sin nombre"}`;
              break;
            }
            const resultado = buscarCosto(item.nombre, precios);
            if (!Number.isFinite(resultado.costo)) {
              base.estado = resultado.motivo;
              break;
            }
            costo += resultado.costo * item.cantidad;
            lineas.push(`${item.nombre}: ${item.cantidad} × ${resultado.costo.toFixed(2)}`);
          }
          base.conceptos = lineas.join(" | ");
          if (!base.estado) {
            base.costo = costo;
            base.utilidad = monto - costo;
            base.estado = "Calculado";
            utilidad += base.utilidad;
            completos++;
          }
        }
      }
      detalle.push(base);
    }
    return { utilidad, completos, total: rows.length, detalle };
  }

  function exportar(resultado) {
    const total = document.getElementById("execUtilidadTotal");
    const card = total?.closest("article");
    if (!card) return;
    card.querySelector("#btnDescargarUtilidad")?.remove();
    if (reporteUrl) URL.revokeObjectURL(reporteUrl);
    const columnas = ["Paciente", "Sede", "Monto Servicio", "Costo Verificado", "Utilidad Verificada", "Estado", "Conceptos"];
    const escapar = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [columnas, ...resultado.detalle.map(row => [
      row.paciente, row.sede, Number.isFinite(row.monto) ? row.monto.toFixed(2) : "",
      row.costo === null ? "" : row.costo.toFixed(2),
      row.utilidad === null ? "" : row.utilidad.toFixed(2), row.estado, row.conceptos
    ])].map(row => row.map(escapar).join(","));
    reporteUrl = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.id = "btnDescargarUtilidad";
    link.href = reporteUrl;
    link.download = "Justificacion_Utilidad.csv";
    link.textContent = "📥 Descargar reporte de cálculo";
    link.style.cssText = "display:block;margin-top:8px;font-size:12px;color:#3b82f6;text-decoration:underline";
    total.insertAdjacentElement("afterend", link);
  }

  function pintar() {
    const total = document.getElementById("execUtilidadTotal");
    const nota = document.getElementById("execUtilidadSedes");
    if (!total || !nota) return;
    if (!cotizacionesRecibidas) {
      total.textContent = "—";
      nota.textContent = "Esperando cotizaciones...";
      return;
    }
    const resultado = calcular(filasActuales, cotizaciones, catalogo());
    if (resultado.completos === resultado.total) {
      total.textContent = formatearMoneda(resultado.utilidad);
      total.style.color = resultado.utilidad < 0 ? "#ef4444" : "#22c55e";
      nota.textContent = `${resultado.total} registros con costos verificados`;
    } else {
      total.textContent = "—";
      total.style.color = "";
      nota.textContent = `No calculable: ${resultado.total - resultado.completos} de ${resultado.total} registros sin costo verificable. Subtotal verificado: ${formatearMoneda(resultado.utilidad)}`;
    }
    exportar(resultado);
  }

  window.calcularUtilidadGlobal = rows => {
    filasActuales = rows || [];
    pintar();
  };
  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.data?.type !== "INNVIDA_COTIZACIONES") return;
    cotizaciones = Array.isArray(event.data.cotizaciones) ? event.data.cotizaciones : [];
    cotizacionesRecibidas = true;
    pintar();
  });
  window.calcularUtilidadVerificada = calcular;
})();
