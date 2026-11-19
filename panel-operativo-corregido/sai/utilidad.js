// Resta costos de compra de las cotizaciones vinculadas a pacientes del SAI.
// El catálogo puede tener varios precios por artículo; por eso es una estimación.
(() => {
  let cotizaciones = [];
  let filas = [];
  let recibidas = false;

  const normalizar = value => String(value ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

  function numero(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const cleaned = String(value ?? "").replace(/[$,\s]/g, "");
    return cleaned ? Number(cleaned) : NaN;
  }

  function nombreItem(item) {
    const base = item.innovador || item.patente || item.generico || item.bio || item;
    return item.nombre || item.name || item.descripcion || item.concepto ||
      item.ESQUEMA || item.esquema || item.pa || item.servicio ||
      base.nombre || base.name || base.descripcion || base.PA || base["NOMBRE COMERCIAL"] || "";
  }

  function conceptos(quote) {
    const items = quote?.state?.items;
    if (Array.isArray(items) && items.length) return items.map(item => ({
      nombre: nombreItem(item), cantidad: numero(item.qty ?? item.cant ?? item.cantidad ?? 1)
    }));
    const separados = [...(Array.isArray(quote?.servicios) ? quote.servicios : []),
      ...(Array.isArray(quote?.medicamentos) ? quote.medicamentos : [])];
    if (separados.length) return separados.map(item => ({
      nombre: nombreItem(item) || item.prueba || "",
      cantidad: numero(item.cantidad ?? item.cant ?? 1)
    }));
    if (Array.isArray(quote?.items)) return quote.items.map(item => ({
      nombre: nombreItem(item), cantidad: numero(item.cantidad ?? item.qty ?? item.cant ?? 1)
    }));
    return [];
  }

  function catalogoCostos() {
    const rows = window.COSTOS_DATA?.catalogo || [];
    return rows.map(row => ({
      nombre: normalizar(row.__EMPTY_1), costo: numero(row.__EMPTY_2)
    })).filter(row => row.nombre && Number.isFinite(row.costo) && row.costo > 0);
  }

  function costoUnitario(nombre, catalogo) {
    const key = normalizar(nombre);
    if (key.length < 3) return null;
    // Se conserva el primer costo del catálogo, como en el cálculo original.
    const exacto = catalogo.find(row => row.nombre === key);
    const parcial = exacto || catalogo.find(row => row.nombre.includes(key) || key.includes(row.nombre));
    return parcial ? parcial.costo : null;
  }

  function cotizacionParaPaciente(nombre, lista) {
    const key = normalizar(nombre);
    if (!key) return null;
    let matches = lista.filter(quote => normalizar(quote.paciente || quote.PACIENTE || quote.nombrePaciente || quote.form?.paciente) === key);
    if (!matches.length) {
      const tokens = key.split(" ").filter(token => token.length > 2);
      if (tokens.length < 2) return null;
      matches = lista.filter(quote => {
        const quoteName = normalizar(quote.paciente || quote.PACIENTE || quote.nombrePaciente || quote.form?.paciente);
        return quoteName && tokens.every(token => quoteName.split(" ").includes(token));
      });
      if (new Set(matches.map(quote => normalizar(quote.paciente || quote.PACIENTE || quote.nombrePaciente || quote.form?.paciente))).size !== 1) return null;
    }
    return matches.find(quote => conceptos(quote).length > 0) || null;
  }

  function calcular(rows, quotes, catalogo) {
    let utilidad = 0;
    let completos = 0;
    let sinCotizacion = 0;
    let sinCosto = 0;
    for (const row of rows) {
      const monto = numero(row.montoServicio);
      if (!Number.isFinite(monto) || monto <= 0) continue;
      const quote = cotizacionParaPaciente(row.paciente, quotes);
      if (!quote) { sinCotizacion++; continue; }
      const items = conceptos(quote);
      if (!items.length) { sinCotizacion++; continue; }
      let costoTotal = 0;
      let completo = true;
      for (const item of items) {
        const costo = costoUnitario(item.nombre, catalogo);
        if (costo === null || !Number.isFinite(item.cantidad) || item.cantidad <= 0) {
          completo = false;
          break;
        }
        costoTotal += costo * item.cantidad;
      }
      if (!completo) { sinCosto++; continue; }
      utilidad += monto - costoTotal;
      completos++;
    }
    return { utilidad, completos, sinCotizacion, sinCosto };
  }

  function pintar() {
    const totalEl = document.getElementById("execUtilidadTotal");
    const detalleEl = document.getElementById("execUtilidadSedes");
    if (!totalEl || !detalleEl) return;
    if (!recibidas) {
      totalEl.textContent = "—";
      detalleEl.textContent = "Esperando cotizaciones...";
      return;
    }
    const resultado = calcular(filas, cotizaciones, catalogoCostos());
    totalEl.textContent = resultado.completos ? formatearMoneda(resultado.utilidad) : "—";
    totalEl.style.color = resultado.completos ? (resultado.utilidad >= 0 ? "#22c55e" : "#ef4444") : "";
    detalleEl.textContent = `${resultado.completos} de ${filas.length} registros con costo completo` +
      (resultado.sinCotizacion || resultado.sinCosto
        ? ` · ${resultado.sinCotizacion} sin cotización · ${resultado.sinCosto} sin costo en catálogo` : "");
  }

  window.actualizarUtilidadSAI = rows => {
    filas = rows || [];
    pintar();
  };
  window.addEventListener("message", event => {
    if (event.source !== window.parent || event.data?.type !== "INNVIDA_COTIZACIONES") return;
    cotizaciones = Array.isArray(event.data.cotizaciones) ? event.data.cotizaciones : [];
    recibidas = true;
    pintar();
  });
  // Expuesto solo para pruebas de la regla de cálculo.
  window.calcularUtilidadSAI = calcular;
})();
