// ============================================================
// logica_cuentas.js  -  Cuentas por cobrar (fiados de personas y tiendas sin cobro)
// ------------------------------------------------------------
// SOLO hace cuentas, igual que logica.js. Necesita que logica.js
// y logica_rancho.js estén cargados antes.
//
// Reglas:
//  - Cada fiado vale: kg x precio de ESE día (importe).
//  - La cuenta es un SALDO EN DINERO: cada fiado suma y cada cobro
//    resta del total. Los cobros NO se asignan a kilos ni a fiados
//    concretos.
//  - Saldo pendiente = total fiado - total cobrado.
//  - Movimientos: fiados y cobros en orden de fecha (el mismo día, primero
//    lo fiado y luego lo cobrado), con el saldo que queda después de cada uno.
//  - SOLO para medir la antigüedad de la deuda se usa una convención:
//    se considera que lo pagado cubre primero lo más antiguo. La
//    antigüedad cuenta desde el fiado más antiguo que, bajo esa
//    convención, todavía no queda cubierto. No cambia el saldo.
//  - Segmentos por antigüedad (días): hasta 7, 8-15, 16-30, más de 30.
//    Esos límites son una sugerencia y se pueden cambiar en LIMITES.
//  - Los dineros se calculan en centavos enteros para no arrastrar
//    errores de decimales.
// ============================================================

const LogicaCuentas = {

  LIMITES: { reciente: 7, medio: 15, atrasado: 30 },

  ETIQUETAS_SEGMENTO: {
    sin_saldo: "Sin saldo",
    reciente: "Hasta 7 días",
    medio: "8 a 15 días",
    atrasado: "16 a 30 días",
    muy_atrasado: "Más de 30 días"
  },

  ORDEN_SEGMENTOS: ["reciente", "medio", "atrasado", "muy_atrasado"],

  NOMBRES_PRODUCTO: { caliente: "Caliente", fria: "Fría", masa: "Masa" },

  _centavos(n) { return Math.round((n + Number.EPSILON) * 100); },
  _pesos(c) { return c / 100; },

  // Días completos entre dos fechas "AAAA-MM-DD" (nunca negativo)
  diasEntre(desde, hasta) {
    const a = desde.split("-").map(Number);
    const b = hasta.split("-").map(Number);
    const ms = Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2]);
    return Math.max(0, Math.round(ms / 86400000));
  },

  segmentoPorDias(dias) {
    if (dias <= this.LIMITES.reciente) return "reciente";
    if (dias <= this.LIMITES.medio) return "medio";
    if (dias <= this.LIMITES.atrasado) return "atrasado";
    return "muy_atrasado";
  },

  // fiados: [{ fecha, producto, kg, precio, id? }]   (solo fiados válidos y confirmados)
  // cobros: [{ id?, fecha?, monto, nota? }]            hoy: "AAAA-MM-DD"
  estadoDeCuenta(fiados, cobros, hoy) {
    const self = this;
    const ordenados = fiados.map(function (f, i) {
      return { f: f, i: i };
    }).sort(function (a, b) {
      if (a.f.fecha !== b.f.fecha) return a.f.fecha < b.f.fecha ? -1 : 1;
      const ia = typeof a.f.id === "number" ? a.f.id : 0;
      const ib = typeof b.f.id === "number" ? b.f.id : 0;
      if (ia !== ib) return ia - ib;
      return a.i - b.i;
    });

    const totalCobradoC = cobros.reduce(function (t, c) { return t + self._centavos(Logica.aNumero(c.monto)); }, 0);
    let restante = totalCobradoC;      // solo para medir la antigüedad
    let totalFiadoC = 0;
    const kgFiadoPorProducto = { caliente: 0, fria: 0, masa: 0 };
    let fechaMasAntigua = null;

    const lineas = ordenados.map(function (o) {
      const kg = Logica.aNumero(o.f.kg);
      const precio = Logica.aNumero(o.f.precio);
      const importeC = self._centavos(kg * precio);
      const cubiertoC = Math.min(importeC, Math.max(0, restante));
      restante -= cubiertoC;
      totalFiadoC += importeC;
      if (kgFiadoPorProducto[o.f.producto] !== undefined) kgFiadoPorProducto[o.f.producto] += kg;
      if (importeC - cubiertoC > 0 && fechaMasAntigua === null) fechaMasAntigua = o.f.fecha;
      return { fecha: o.f.fecha, producto: o.f.producto, kg: kg, precio: precio, importe: self._pesos(importeC), detalle: o.f.detalle };
    });

    // Movimientos: lo fiado suma, lo cobrado resta, con el saldo después de cada uno
    const movs = [];
    lineas.forEach(function (l, i) {
      movs.push({ tipo: "fiado", fecha: l.fecha, orden: 0, seq: i, producto: l.producto, kg: l.kg, precio: l.precio, monto: l.importe, detalle: l.detalle });
    });
    cobros.forEach(function (c, i) {
      movs.push({
        tipo: "cobro", fecha: c.fecha || hoy, orden: 1, seq: typeof c.id === "number" ? c.id : i,
        id: c.id, nota: c.nota || "", monto: self._pesos(self._centavos(Logica.aNumero(c.monto)))
      });
    });
    movs.sort(function (a, b) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      return (a.orden - b.orden) || (a.seq - b.seq);
    });
    let corridoC = 0;
    movs.forEach(function (m) {
      corridoC += (m.tipo === "fiado" ? 1 : -1) * self._centavos(m.monto);
      m.saldoDespues = self._pesos(corridoC);
      delete m.orden; delete m.seq;
    });

    Object.keys(kgFiadoPorProducto).forEach(function (k) { kgFiadoPorProducto[k] = Logica.redondear(kgFiadoPorProducto[k], 4); });
    const saldoC = totalFiadoC - totalCobradoC;
    const diasAntiguedad = (saldoC > 0 && fechaMasAntigua !== null) ? this.diasEntre(fechaMasAntigua, hoy) : null;

    return {
      lineas: lineas,
      movimientos: movs,
      totalFiado: this._pesos(totalFiadoC),
      totalCobrado: this._pesos(totalCobradoC),
      saldo: this._pesos(saldoC),
      aFavor: saldoC < 0 ? this._pesos(-saldoC) : 0,
      fechaMasAntigua: saldoC > 0 ? fechaMasAntigua : null,
      diasAntiguedad: diasAntiguedad,
      segmento: saldoC > 0 && diasAntiguedad !== null ? this.segmentoPorDias(diasAntiguedad) : "sin_saldo",
      kgFiadoPorProducto: kgFiadoPorProducto
    };
  },

  // Revisa un cobro antes de guardarlo. "saldo" es lo que debe hoy la persona.
  validarCobro(monto, saldo) {
    if (!Logica.esNumero(monto)) return "Monto no válido";
    const m = Logica.aNumero(monto);
    if (m <= 0) return "El monto debe ser mayor que 0";
    if (saldo <= 0) return "No hay saldo pendiente";
    if (this._centavos(m) > this._centavos(saldo)) return "El cobro supera el saldo pendiente";
    return "OK";
  },

  // personas: [{ personaId, nombre, cuenta }]   orden: "saldo" | "antiguedad" | "nombre"
  resumenDeudores(personas, orden) {
    const self = this;
    const conSaldo = personas.filter(function (p) { return p.cuenta.saldo > 0; });
    const sinSaldo = personas.filter(function (p) { return p.cuenta.saldo <= 0; });
    const porSegmento = {};
    this.ORDEN_SEGMENTOS.forEach(function (s) { porSegmento[s] = { cantidad: 0, monto: 0 }; });
    let totalC = 0;
    conSaldo.forEach(function (p) {
      porSegmento[p.cuenta.segmento].cantidad += 1;
      porSegmento[p.cuenta.segmento].monto += self._centavos(p.cuenta.saldo);
      totalC += self._centavos(p.cuenta.saldo);
    });
    this.ORDEN_SEGMENTOS.forEach(function (s) { porSegmento[s].monto = self._pesos(porSegmento[s].monto); });

    const comparar = {
      saldo: function (a, b) { return b.cuenta.saldo - a.cuenta.saldo || a.nombre.localeCompare(b.nombre, "es"); },
      antiguedad: function (a, b) { return (b.cuenta.diasAntiguedad - a.cuenta.diasAntiguedad) || (b.cuenta.saldo - a.cuenta.saldo); },
      nombre: function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); }
    };
    conSaldo.sort(comparar[orden] || comparar.saldo);
    sinSaldo.sort(comparar.nombre);
    return { deudores: conSaldo, sinSaldo: sinSaldo, totalPorCobrar: this._pesos(totalC), porSegmento: porSegmento };
  },

  // Texto listo para copiar y mandar (por ejemplo por mensaje) a quien debe.
  // opciones.tienda = true: cuenta de una tienda (entregas sin cobrar) en lugar de una persona.
  textoEstadoDeCuenta(nombre, cuenta, hoy, opciones) {
    const esTienda = !!(opciones && opciones.tienda);
    const dinero = function (n) {
      return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
    const fecha = function (f) { const p = f.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
    const kg = function (n) { return String(Logica.redondear(n, 2)); };
    const saldoTxt = function (n) {
      if (n > 0) return "debe " + dinero(n);
      if (n < 0) return "a su favor " + dinero(-n);
      return "sin deuda";
    };
    const self = this;
    const l = [];
    l.push("ESTADO DE CUENTA - " + nombre);
    l.push("Al " + fecha(hoy));
    l.push("");
    l.push(esTienda ? "MOVIMIENTOS (lo entregado sin cobrar suma, lo pagado resta)" : "MOVIMIENTOS (lo fiado suma, lo pagado resta)");
    cuenta.movimientos.forEach(function (m) {
      if (m.tipo === "fiado" && esTienda) {
        const d = m.detalle;
        const partes = d
          ? "mañana " + kg(d.manana) + " + extras " + kg(d.extras) + " - devoluciones " + kg(d.devoluciones) + " - fría " + kg(d.frios) + " = "
          : "";
        l.push(fecha(m.fecha) + " - Entrega: " + partes + kg(m.kg) + " kg x " + dinero(m.precio) + " = " + dinero(m.monto) + " | " + saldoTxt(m.saldoDespues));
      } else if (m.tipo === "fiado") {
        l.push(fecha(m.fecha) + " - Fió " + self.NOMBRES_PRODUCTO[m.producto] + " " + kg(m.kg) + " kg x " + dinero(m.precio) +
          " = " + dinero(m.monto) + " | " + saldoTxt(m.saldoDespues));
      } else {
        l.push(fecha(m.fecha) + " - Pago de " + dinero(m.monto) + (m.nota ? " (" + m.nota + ")" : "") + " | " + saldoTxt(m.saldoDespues));
      }
    });
    l.push("");
    l.push((esTienda ? "Total sin cobrar: " : "Total fiado: ") + dinero(cuenta.totalFiado));
    l.push("Total pagado: " + dinero(cuenta.totalCobrado));
    if (cuenta.saldo > 0) l.push("SALDO PENDIENTE: " + dinero(cuenta.saldo));
    else if (cuenta.saldo < 0) l.push("SALDO A SU FAVOR: " + dinero(cuenta.aFavor));
    else l.push("SALDO PENDIENTE: $0.00 (al corriente)");
    return l.join("\n");
  }
};
