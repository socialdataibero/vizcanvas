# Chart Gallery para Observable Canvases

Catálogo de gráficas construidas con **Observable Plot**, organizadas por categoría funcional y nivel de complejidad.

- **Básica** — Un solo mark, configuración mínima
- **Intermedia** — Combinación de marks, transforms, opciones de estilo
- **Avanzada** — Múltiples layers, transforms complejos, layouts especializados

---
---

# ★ Comparison

Gráficas para comparar valores entre categorías o grupos.

---

## Vertical Bar

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Comparison |
| **Complejidad** | Básica |
| **Marks** | `barY` (x: categórico, y: cuantitativo continuo), `ruleY` |
| **Descripción** | Compara valores entre categorías con barras verticales. Ideal cuando las etiquetas son cortas y hay menos de 12 categorías. |

```js run=false
Plot.plot({
  marks: [
    Plot.barY(data, {
      x: "category",
      y: "value",
      fill: "steelblue",
      sort: { x: "-y" }
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Grouped Bar

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Comparison |
| **Complejidad** | Intermedia |
| **Marks** | `barY` (x: categórico, y: cuantitativo continuo, fill: categórico nominal — series), `ruleY` |
| **Transforms** | `groupX` |
| **Descripción** | Compara múltiples series lado a lado dentro de cada categoría. Usa facetas (fx) para separar los grupos. |

```js run=false
Plot.plot({
  color: { legend: true },
  fx: { padding: 0.1 },
  marks: [
    Plot.barY(data, {
      x: "series",
      y: "value",
      fill: "series",
      fx: "category"
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Dot Comparison

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Comparison |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: categórico, y: cuantitativo continuo), `ruleY` |
| **Descripción** | Compara valores entre categorías usando puntos en lugar de barras. Reduce la tinta visual y enfatiza la posición sobre el área. |

```js run=false
Plot.plot({
  y: { grid: true },
  marks: [
    Plot.ruleY([0]),
    Plot.dot(data, {
      x: "category",
      y: "value",
      fill: "steelblue",
      r: 6
    })
  ]
})
```

---
---

# ★ Ranking

Gráficas para mostrar elementos ordenados por valor.

---

## Horizontal Bar

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Ranking |
| **Complejidad** | Básica |
| **Marks** | `barX` (x: cuantitativo continuo, y: categórico ordinal), `ruleX` |
| **Descripción** | Muestra un ranking de categorías con barras horizontales. Ideal para etiquetas largas y listas ordenadas de más de 8 categorías. |

```js run=false
Plot.plot({
  marginLeft: 120,
  marks: [
    Plot.barX(data, {
      x: "value",
      y: "category",
      fill: "steelblue",
      sort: { y: "-x" }
    }),
    Plot.ruleX([0])
  ]
})
```

---

## Lollipop

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Ranking |
| **Complejidad** | Intermedia |
| **Marks** | `ruleX` (x: cuantitativo continuo, y: categórico ordinal), `dot` (x: cuantitativo continuo, y: categórico ordinal) |
| **Descripción** | Alternativa moderna a las barras horizontales. Línea delgada + punto terminal con menor peso visual y mayor precisión. |

```js run=false
Plot.plot({
  marginLeft: 120,
  marks: [
    Plot.ruleX(data, {
      x: "value",
      y: "category",
      sort: { y: "-x" }
    }),
    Plot.dot(data, {
      x: "value",
      y: "category",
      fill: "steelblue",
      r: 5,
      sort: { y: "-x" }
    }),
    Plot.ruleX([0])
  ]
})
```

---

## Cleveland Dot Plot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Ranking |
| **Complejidad** | Básica |
| **Marks** | `dot` (x: cuantitativo continuo, y: categórico ordinal), `ruleX` |
| **Descripción** | Puntos posicionados en un eje compartido, ordenados por valor. Máxima precisión para comparar posiciones y detectar diferencias sutiles. |

```js run=false
Plot.plot({
  marginLeft: 120,
  marks: [
    Plot.ruleX([0]),
    Plot.dot(data, {
      x: "value",
      y: "category",
      fill: "steelblue",
      sort: { y: "-x" }
    })
  ]
})
```

---

## Bump Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Ranking |
| **Complejidad** | Avanzada |
| **Marks** | `line` (x: temporal discreto, y: ordinal — ranking, stroke: categórico nominal), `dot` (x: temporal discreto, y: ordinal, fill: categórico nominal), `text` (etiquetas) |
| **Descripción** | Muestra cómo cambian los rankings a lo largo del tiempo. Las líneas conectan posiciones entre períodos con curvas suaves. |

```js run=false
Plot.plot({
  y: { reverse: true, label: "Rank" },
  color: { legend: true },
  marks: [
    Plot.line(data, {
      x: "period",
      y: "rank",
      stroke: "entity",
      strokeWidth: 2.5,
      curve: "bump-x"
    }),
    Plot.dot(data, {
      x: "period",
      y: "rank",
      fill: "entity",
      r: 5
    }),
    Plot.text(data, {
      filter: d => d.period === lastPeriod,
      x: "period",
      y: "rank",
      text: "entity",
      textAnchor: "start",
      dx: 12,
      fontWeight: "bold"
    })
  ]
})
```

---
---

# ★ Distribution

Gráficas para mostrar cómo se distribuyen los datos a lo largo de un rango.

---

## Histogram

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Básica |
| **Marks** | `rectY` (x: cuantitativo continuo, y: conteo), `ruleY` |
| **Transforms** | `binX` — agrupa valores continuos en intervalos (bins) |
| **Descripción** | Distribución de frecuencias de una variable continua. Agrupa valores en intervalos y cuenta ocurrencias. |

```js run=false
Plot.plot({
  marks: [
    Plot.rectY(data, Plot.binX(
      { y: "count" },
      { x: "value", fill: "steelblue" }
    )),
    Plot.ruleY([0])
  ]
})
```

---

## Stacked Histogram

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Intermedia |
| **Marks** | `rectY` (x: cuantitativo continuo, y: conteo, fill: categórico nominal — grupo), `ruleY` |
| **Transforms** | `binX` — agrupa valores continuos en intervalos |
| **Descripción** | Histograma con segmentos de color por grupo. Muestra cómo cada grupo contribuye a la distribución total. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.rectY(data, Plot.binX(
      { y: "count" },
      {
        x: "value",
        fill: "group",
        fillOpacity: 0.8,
        stroke: "white",
        strokeWidth: 1
      }
    )),
    Plot.ruleY([0])
  ]
})
```

---

## Faceted Histogram

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Intermedia |
| **Marks** | `rectY` (x: cuantitativo continuo, y: conteo, fy: categórico nominal — faceta), `ruleY` |
| **Transforms** | `binX` — agrupa valores continuos en intervalos |
| **Descripción** | Histogramas separados en small multiples. Cada grupo tiene su propio panel para comparación limpia sin solapamiento. |

```js run=false
Plot.plot({
  fy: { label: null },
  marks: [
    Plot.rectY(data, Plot.binX(
      { y: "count" },
      {
        x: "value",
        fill: "group",
        fy: "group"
      }
    )),
    Plot.ruleY([0])
  ]
})
```

---

## Box Plot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Básica |
| **Marks** | `boxY` (x: categórico nominal, y: cuantitativo continuo) |
| **Descripción** | Resumen de 5 números: mínimo, Q1, mediana, Q3, máximo. Muestra centro, dispersión y outliers por grupo. |

```js run=false
Plot.plot({
  marks: [
    Plot.boxY(data, {
      x: "category",
      y: "value"
    })
  ]
})
```

---

## Barcode / Strip Plot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Básica |
| **Marks** | `tickX` (x: cuantitativo continuo) |
| **Descripción** | Cada observación como una línea vertical delgada. Visualización mínima de distribución que preserva todos los datos individuales. |

```js run=false
Plot.plot({
  height: 80,
  marks: [
    Plot.tickX(data, {
      x: "value",
      strokeOpacity: 0.3
    })
  ]
})
```

---

## Dot Strip

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Básica |
| **Marks** | `dot` (x: cuantitativo continuo, y: categórico nominal) |
| **Descripción** | Valores individuales por categoría en un eje horizontal. Cada punto es una observación. Alternativa a box plot con pocos datos. |

```js run=false
Plot.plot({
  marginLeft: 100,
  marks: [
    Plot.dot(data, {
      x: "value",
      y: "category",
      fill: "steelblue",
      fillOpacity: 0.5,
      r: 3
    })
  ]
})
```

---

## Beeswarm

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Avanzada |
| **Marks** | `dot` (x: cuantitativo continuo, fill: categórico nominal — opcional) |
| **Transforms** | `dodgeY` — desplaza puntos verticalmente para evitar solapamiento |
| **Descripción** | Puntos desplazados para evitar solapamiento. Muestra cada observación individual revelando la forma de la distribución. Menos de 500 puntos. |

```js run=false
Plot.plot({
  height: 200,
  marks: [
    Plot.dot(data, Plot.dodgeY({
      x: "value",
      fill: "category",
      r: 3
    }))
  ]
})
```

---

## Ridgeline

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Avanzada |
| **Marks** | `areaY` (x: cuantitativo continuo, y: conteo, fy: categórico nominal — grupo) |
| **Transforms** | `binX` — agrupa valores continuos en intervalos |
| **Descripción** | Densidades superpuestas apiladas verticalmente. Efecto dramático para comparar la forma de distribuciones de 5+ grupos. |

```js run=false
Plot.plot({
  height: 400,
  fy: { label: null, domain: groups },
  marks: [
    Plot.areaY(data, Plot.binX(
      { y: "count" },
      {
        x: "value",
        fy: "group",
        fill: "group",
        curve: "basis"
      }
    ))
  ]
})
```

---

## Violin Plot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Distribution |
| **Complejidad** | Avanzada |
| **Marks** | `areaX` (y: cuantitativo continuo, x: conteo, fy: categórico nominal — grupo) |
| **Transforms** | `binY` — agrupa valores continuos en intervalos verticales |
| **Descripción** | Distribución completa por grupo, espejada alrededor del eje central. Revela distribuciones bimodales o formas irregulares que el box plot oculta. |

```js run=false
Plot.plot({
  marks: [
    Plot.areaX(data, Plot.binY(
      { x: "count" },
      {
        y: "value",
        fill: "group",
        fy: "group",
        curve: "basis"
      }
    ))
  ]
})
```

---
---

# ★ Change over Time

Gráficas para mostrar cómo evolucionan los valores a lo largo del tiempo.

---

## Line Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Básica |
| **Marks** | `lineY` (x: temporal continuo, y: cuantitativo continuo), `ruleY` |
| **Descripción** | Tendencia a lo largo del tiempo conectando puntos con una línea continua. La gráfica más fundamental para series temporales. |

```js run=false
Plot.plot({
  y: { grid: true },
  marks: [
    Plot.lineY(data, {
      x: "date",
      y: "value",
      stroke: "steelblue",
      strokeWidth: 2
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Multi-Series Line

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Intermedia |
| **Marks** | `lineY` (x: temporal continuo, y: cuantitativo continuo, stroke: categórico nominal — serie), `ruleY` |
| **Descripción** | Compara tendencias de múltiples series con líneas de colores. Revela patrones divergentes o convergentes. Máximo 2-6 series. |

```js run=false
Plot.plot({
  color: { legend: true },
  y: { grid: true },
  marks: [
    Plot.lineY(data, {
      x: "date",
      y: "value",
      stroke: "series"
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Area Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Básica |
| **Marks** | `areaY` (x: temporal continuo, y: cuantitativo continuo), `lineY` (x: temporal continuo, y: cuantitativo continuo), `ruleY` |
| **Descripción** | Línea con el área inferior rellenada. Enfatiza el volumen o magnitud acumulada sobre el tiempo, no solo la tendencia. |

```js run=false
Plot.plot({
  y: { grid: true },
  marks: [
    Plot.areaY(data, {
      x: "date",
      y: "value",
      fill: "steelblue",
      fillOpacity: 0.2
    }),
    Plot.lineY(data, {
      x: "date",
      y: "value",
      stroke: "steelblue",
      strokeWidth: 2
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Stacked Area

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Intermedia |
| **Marks** | `areaY` (x: temporal continuo, y: cuantitativo continuo, fill: categórico nominal — serie), `ruleY` |
| **Transforms** | `stackY` — apila series verticalmente |
| **Descripción** | Múltiples series apiladas mostrando contribución individual y total acumulado a lo largo del tiempo. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.areaY(data, {
      x: "date",
      y: "value",
      fill: "series"
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Streamgraph

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Avanzada |
| **Marks** | `areaY` (x: temporal continuo, y: cuantitativo continuo, fill: categórico nominal — serie) |
| **Transforms** | `stackY` — apila series con offset centrado (wiggle) |
| **Descripción** | Área apilada centrada con curvas suaves. Forma fluida y orgánica que enfatiza proporciones relativas cambiantes sobre el tiempo. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.areaY(data, {
      x: "date",
      y: "value",
      fill: "series",
      offset: "wiggle",
      curve: "basis"
    })
  ]
})
```

---

## Temporal Histogram

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Básica |
| **Marks** | `rectY` (x: temporal continuo, y: conteo), `ruleY` |
| **Transforms** | `binX` — agrupa fechas en intervalos temporales (día, semana, mes) |
| **Descripción** | Conteo de eventos agrupados por intervalos de tiempo. Detecta estacionalidad y patrones de actividad. |

```js run=false
Plot.plot({
  marks: [
    Plot.rectY(data, Plot.binX(
      { y: "count" },
      {
        x: "date",
        interval: "month",
        fill: "steelblue"
      }
    )),
    Plot.ruleY([0])
  ]
})
```

---

## Slope Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Intermedia |
| **Marks** | `line` (x: temporal discreto — 2 puntos, y: cuantitativo continuo, stroke: categórico nominal), `dot` (x: temporal discreto, y: cuantitativo continuo, fill: categórico nominal), `text` (etiquetas) |
| **Descripción** | Compara valores entre exactamente dos puntos en el tiempo. La pendiente muestra la dirección y magnitud del cambio. |

```js run=false
Plot.plot({
  x: { type: "point", padding: 0.5 },
  marks: [
    Plot.line(data, {
      x: "period",
      y: "value",
      stroke: "category",
      strokeWidth: 2
    }),
    Plot.dot(data, {
      x: "period",
      y: "value",
      fill: "category",
      r: 5
    }),
    Plot.text(data, {
      filter: d => d.period === "After",
      x: "period",
      y: "value",
      text: "category",
      textAnchor: "start",
      dx: 10
    })
  ]
})
```

---

## Line + Rolling Average

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: temporal continuo, y: cuantitativo continuo), `lineY` (x: temporal continuo, y: cuantitativo continuo — suavizado) |
| **Transforms** | `windowY` — calcula promedio móvil de k observaciones |
| **Descripción** | Datos ruidosos con una línea suavizada superpuesta. El promedio móvil revela la tendencia subyacente. |

```js run=false
Plot.plot({
  marks: [
    Plot.dot(data, {
      x: "date",
      y: "value",
      fillOpacity: 0.15,
      r: 2
    }),
    Plot.lineY(data, Plot.windowY(
      { k: 7 },
      {
        x: "date",
        y: "value",
        stroke: "red",
        strokeWidth: 2
      }
    )),
    Plot.ruleY([0])
  ]
})
```

---

## Line + Confidence Band

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Intermedia |
| **Marks** | `areaY` (x: temporal continuo, y1: cuantitativo continuo — límite inferior, y2: cuantitativo continuo — límite superior), `lineY` (x: temporal continuo, y: cuantitativo continuo — valor central) |
| **Descripción** | Línea central con banda sombreada representando incertidumbre, intervalos de confianza o rango min/max. |

```js run=false
Plot.plot({
  y: { grid: true },
  marks: [
    Plot.areaY(data, {
      x: "date",
      y1: "lower",
      y2: "upper",
      fill: "steelblue",
      fillOpacity: 0.15
    }),
    Plot.lineY(data, {
      x: "date",
      y: "value",
      stroke: "steelblue",
      strokeWidth: 2
    })
  ]
})
```

---

## Difference Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Avanzada |
| **Marks** | `differenceY` (x: temporal continuo, y1: cuantitativo continuo — baseline, y2: cuantitativo continuo — actual) |
| **Descripción** | Muestra la diferencia entre dos series con coloreo positivo/negativo. Verde donde la actual excede al baseline, rojo donde no. |

```js run=false
Plot.plot({
  marks: [
    Plot.differenceY(data, {
      x: "date",
      y1: "baseline",
      y2: "actual",
      positiveFill: "#10b981",
      negativeFill: "#ef4444"
    })
  ]
})
```

---

## Calendar Heatmap

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Change over Time |
| **Complejidad** | Avanzada |
| **Marks** | `cell` (x: cuantitativo discreto — semana del año, y: cuantitativo discreto — día de la semana, fill: cuantitativo continuo) |
| **Descripción** | Valores diarios en una cuadrícula de calendario. El color codifica la intensidad del valor para cada día a lo largo del año. |

```js run=false
Plot.plot({
  padding: 0,
  color: { scheme: "PiYG", legend: true },
  marks: [
    Plot.cell(data, {
      x: d => d3.utcWeek.count(
        d3.utcYear(d.date), d.date
      ),
      y: d => d.date.getUTCDay(),
      fill: "value",
      inset: 0.5
    })
  ],
  facet: {
    data,
    y: d => d.date.getUTCFullYear()
  },
  fy: { reverse: true }
})
```

---
---

# ★ Part-to-Whole

Gráficas para mostrar cómo las partes componen un todo.

---

## Stacked Bar

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Intermedia |
| **Marks** | `barY` (x: categórico nominal, y: cuantitativo continuo, fill: categórico nominal — sub-grupo), `ruleY` |
| **Transforms** | `groupX` — agrupa por categoría, `stackY` — apila segmentos |
| **Descripción** | Barras con segmentos apilados mostrando contribución de sub-grupos al total de cada categoría. Mejor con 2-6 sub-grupos. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.barY(data, Plot.groupX(
      { y: "sum" },
      {
        x: "category",
        y: "value",
        fill: "subgroup"
      }
    )),
    Plot.ruleY([0])
  ]
})
```

---

## 100% Stacked Bar

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Intermedia |
| **Marks** | `barX` (x: cuantitativo continuo — normalizado, y: categórico nominal, fill: categórico nominal — sub-grupo), `ruleX` |
| **Transforms** | `groupY` — agrupa por categoría, `normalize` — normaliza cada barra a 100% |
| **Descripción** | Cada barra normalizada a 100%. Compara proporciones entre categorías sin que los totales diferentes distorsionen. |

```js run=false
Plot.plot({
  x: { percent: true },
  color: { legend: true },
  marks: [
    Plot.barX(data, Plot.groupY(
      { x: "count" },
      {
        y: "category",
        fill: "subgroup",
        offset: "normalize"
      }
    )),
    Plot.ruleX([0])
  ]
})
```

---

## Waffle Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Básica |
| **Marks** | `waffleY` (x: categórico nominal, y: cuantitativo discreto — conteo, fill: categórico nominal) |
| **Descripción** | Proporciones como cuadrícula de cuadrados. Cada cuadrado = 1 unidad tangible. Alternativa accesible a pie charts. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.waffleY(data, {
      x: "category",
      y: "value",
      fill: "category"
    })
  ]
})
```

---

## Stacked Waffle

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Intermedia |
| **Marks** | `waffleY` (y: cuantitativo discreto — conteo, fill: categórico nominal — sub-grupo) |
| **Transforms** | `groupX` — agrupa por categoría |
| **Descripción** | Waffle con sub-grupos apilados. Composición visual donde cada cuadrado mantiene su significado unitario. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.waffleY(data, Plot.groupX(
      { y: "sum" },
      {
        x: "category",
        y: "value",
        fill: "subgroup"
      }
    ))
  ]
})
```

---

## Isotype (Pictogram)

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Intermedia |
| **Marks** | `waffleY` (y: cuantitativo discreto — conteo de unidades, fill: categórico nominal) |
| **Descripción** | Waffle donde cada símbolo representa una unidad real (persona, objeto). Hace los datos tangibles para audiencias no técnicas. |

```js run=false
Plot.plot({
  color: { legend: true },
  marks: [
    Plot.waffleY(data, {
      y: "count",
      fill: "category",
      unit: 1
    })
  ]
})
```

---

## Waterfall Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Avanzada |
| **Marks** | `barY` (x: categórico ordinal — pasos secuenciales, y1: cuantitativo continuo — inicio, y2: cuantitativo continuo — fin), `text` (etiquetas de cambio), `ruleY` |
| **Descripción** | Muestra cómo un valor inicial se modifica por incrementos y decrementos secuenciales hasta el total final. Revenue bridges, P&L. |

```js run=false
// Requiere datos pre-calculados con start/end/change
Plot.plot({
  x: { padding: 0.3 },
  marks: [
    Plot.barY(data, {
      x: "step",
      y1: "start",
      y2: "end",
      fill: d => d.end >= d.start
        ? "#10b981"
        : "#ef4444"
    }),
    Plot.text(data, {
      x: "step",
      y: "end",
      text: d => d.change > 0
        ? `+${d.change}`
        : d.change,
      dy: -8,
      fontWeight: "bold"
    }),
    Plot.ruleY([0])
  ]
})
```

---

## Marimekko / Mosaic

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Avanzada |
| **Marks** | `rect` (x1/x2: cuantitativo continuo — proporción horizontal, y1/y2: cuantitativo continuo — proporción vertical, fill: categórico nominal), `text` (etiquetas) |
| **Transforms** | `stack` — calcula posiciones apiladas bidimensionalmente |
| **Descripción** | Ancho y alto codifican datos simultáneamente. Proporciones bidimensionales donde el área total representa el 100%. |

```js run=false
// Requiere datos pre-calculados con x0, x1, y0, y1
Plot.plot({
  x: { percent: true },
  y: { percent: true },
  color: { legend: true },
  marks: [
    Plot.rect(data, {
      x1: "x0", x2: "x1",
      y1: "y0", y2: "y1",
      fill: "category",
      inset: 1
    }),
    Plot.text(data, {
      x: d => (d.x0 + d.x1) / 2,
      y: d => (d.y0 + d.y1) / 2,
      text: "label",
      fontSize: 10
    })
  ]
})
```

---

## Treemap
 
| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Part-to-Whole |
| **Complejidad** | Avanzado |
| **Marks** | `rect` — rectángulos anidados donde el área codifica un valor cuantitativo · `text` — etiqueta de valor dentro de cada celda |
| **Datos** | x1/x2/y1/y2: cuantitativo continuo (coordenadas calculadas por `d3.treemap`) · fill: categórico (grupo padre) · requiere pre-cálculo con `d3-hierarchy` |
 
```js run=false
// Requiere pre-cálculo con d3.treemap()
// const root = d3.treemap().size([width, height])
//   .padding(1)(d3.hierarchy(data).sum(d => d.value));
// const leaves = root.leaves();

Plot.plot({
  marks: [
    Plot.rect(leaves, {
      x1: "x0",
      x2: "x1",
      y1: "y0",
      y2: "y1",
      fill: (d) => d.parent.data.name,
      title: (d) => `${d.parent.data.name}: ${d.data.name}`
    }),
    Plot.text(leaves, {
      x: "x0",
      y: "y1",
      dx: 10,
      dy: 10,
      text: (d) => {
        const v = d.value?.toFixed(1);
        const width = (v.length - 1) * 8 + 5;
        const height = 15;
        return d.x1 - d.x0 > width && d.y1 - d.y0 > height ? v : "";
      },
      fill: "#fff"
    })
  ],
  x: { axis: null },
  y: { axis: null },
  width: width,
  height: height,
  marginTop: 20
})
```

---

# ★ Correlation

Gráficas para mostrar relaciones entre dos o más variables.

---

## Scatterplot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Básica |
| **Marks** | `dot` (x: cuantitativo continuo, y: cuantitativo continuo) |
| **Descripción** | Relación entre dos variables cuantitativas. Cada punto es una observación posicionada por sus valores X e Y. Menos de 1000 puntos. |

```js run=false
Plot.plot({
  grid: true,
  marks: [
    Plot.dot(data, {
      x: "variable_x",
      y: "variable_y",
      fill: "steelblue",
      fillOpacity: 0.6
    })
  ]
})
```

---

## Color Scatterplot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: cuantitativo continuo, y: cuantitativo continuo, fill: categórico nominal — grupo) |
| **Descripción** | Scatter con una tercera variable codificada como color. Revela si los patrones de correlación difieren entre grupos. |

```js run=false
Plot.plot({
  grid: true,
  color: { legend: true },
  marks: [
    Plot.dot(data, {
      x: "variable_x",
      y: "variable_y",
      fill: "category",
      r: 4
    })
  ]
})
```

---

## Bubble Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: cuantitativo continuo, y: cuantitativo continuo, r: cuantitativo continuo — tamaño, fill: categórico nominal — opcional) |
| **Descripción** | Scatter donde el tamaño del punto codifica una tercera variable cuantitativa. Tres dimensiones en un plano 2D. |

```js run=false
Plot.plot({
  grid: true,
  color: { legend: true },
  r: { range: [2, 20] },
  marks: [
    Plot.dot(data, {
      x: "var_x",
      y: "var_y",
      r: "size_var",
      fill: "category",
      fillOpacity: 0.7,
      stroke: "white"
    })
  ]
})
```

---

## Scatter + Regression

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: cuantitativo continuo, y: cuantitativo continuo), `linearRegressionY` (x: cuantitativo continuo, y: cuantitativo continuo) |
| **Descripción** | Scatter con línea de regresión superpuesta para cuantificar y visualizar la tendencia lineal entre dos variables. |

```js run=false
Plot.plot({
  grid: true,
  marks: [
    Plot.dot(data, {
      x: "var_x",
      y: "var_y",
      fill: "steelblue",
      fillOpacity: 0.5
    }),
    Plot.linearRegressionY(data, {
      x: "var_x",
      y: "var_y",
      stroke: "red",
      strokeWidth: 2
    })
  ]
})
```

---

## Heatmap

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Intermedia |
| **Marks** | `cell` (x: categórico nominal o temporal discreto, y: categórico nominal, fill: cuantitativo continuo) |
| **Descripción** | Matriz coloreada por intensidad. Dos variables en los ejes, color representa el valor de la intersección. |

```js run=false
Plot.plot({
  color: {
    scheme: "YlGnBu",
    legend: true
  },
  marks: [
    Plot.cell(data, {
      x: "column_x",
      y: "column_y",
      fill: "value",
      inset: 0.5
    })
  ]
})
```

---

## Faceted Scatterplot

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: cuantitativo continuo, y: cuantitativo continuo, fy: categórico nominal — faceta), `frame` |
| **Descripción** | Scatterplots en small multiples. Cada panel muestra la misma correlación para un subgrupo diferente. Más limpio que color para muchos grupos. |

```js run=false
Plot.plot({
  grid: true,
  facet: { marginRight: 80 },
  marks: [
    Plot.frame(),
    Plot.dot(data, {
      x: "var_x",
      y: "var_y",
      fill: "group",
      fy: "group"
    })
  ]
})
```

---

## Parallel Coordinates

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Avanzada |
| **Marks** | `line` (x: categórico nominal — nombre de variable, y: cuantitativo continuo — valor normalizado, z: identificador único, stroke: categórico nominal — grupo), `ruleX` |
| **Transforms** | `normalizeY` — escala cada variable al rango [0, 1] para comparación |
| **Descripción** | Datos multivariados como líneas que cruzan ejes paralelos verticales. Cada eje es una variable. Revela clusters y outliers. Requiere datos en formato long. |

```js run=false
// Requiere datos en formato long
Plot.plot({
  marginLeft: 80,
  x: { type: "point", padding: 0.5 },
  marks: [
    Plot.line(longData, Plot.normalizeY({
      x: "variable",
      y: "value",
      z: "id",
      stroke: "category",
      strokeOpacity: 0.3
    })),
    Plot.ruleX(variables)
  ]
})
```

---

## Bubble Matrix

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Correlation |
| **Complejidad** | Avanzada |
| **Marks** | `dot` (x: categórico nominal, y: categórico nominal, r: cuantitativo continuo — tamaño, fill: cuantitativo continuo — color) |
| **Descripción** | Matriz donde tamaño y color de cada punto codifican dos medidas diferentes. Alternativa rica a heatmap cuando se necesitan dos dimensiones de valor. |

```js run=false
Plot.plot({
  r: { range: [0, 14] },
  color: {
    scheme: "RdYlGn",
    legend: true
  },
  marks: [
    Plot.dot(data, {
      x: "col_x",
      y: "col_y",
      r: "size_value",
      fill: "color_value"
    })
  ]
})
```

---
---

# ★ Spatial / Geo

Gráficas para mostrar datos sobre mapas o distribuciones geográficas.

---

## US Choropleth

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Intermedia |
| **Marks** | `geo` (geometry: GeoJSON — estados/condados de EE.UU., fill: cuantitativo continuo) |
| **Descripción** | Datos mapeados a estados o condados de EE.UU. usando relleno de color sobre geometrías geográficas. |

```js run=false
Plot.plot({
  projection: "albers-usa",
  color: {
    scheme: "Blues",
    legend: true
  },
  marks: [
    Plot.geo(states, {
      fill: d => dataMap.get(
        d.properties.name
      ),
      stroke: "white",
      strokeWidth: 0.5
    })
  ]
})
```

---

## World Choropleth

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Intermedia |
| **Marks** | `geo` (geometry: GeoJSON — fronteras de países, fill: cuantitativo continuo) |
| **Descripción** | Datos mapeados a países del mundo con proyección global. Comparaciones internacionales de una sola métrica. |

```js run=false
Plot.plot({
  projection: "equal-earth",
  color: {
    scheme: "YlGnBu",
    legend: true
  },
  marks: [
    Plot.geo(countries, {
      fill: d => dataMap.get(
        d.properties.name
      ),
      stroke: "#ccc"
    }),
    Plot.sphere()
  ]
})
```

---

## Dot Map

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Intermedia |
| **Marks** | `dot` (x: cuantitativo continuo — longitud, y: cuantitativo continuo — latitud), `geo` (geometría base) |
| **Descripción** | Puntos sobre un mapa geográfico. Cada punto representa una ubicación específica (ciudad, evento, instalación). |

```js run=false
Plot.plot({
  projection: "albers-usa",
  marks: [
    Plot.geo(statesMesh, {
      stroke: "#ddd"
    }),
    Plot.dot(data, {
      x: "longitude",
      y: "latitude",
      r: 2,
      fill: "steelblue",
      fillOpacity: 0.5
    })
  ]
})
```

---

## Spike Map

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Avanzada |
| **Marks** | `vector` (x: cuantitativo continuo — longitud, y: cuantitativo continuo — latitud, length: cuantitativo continuo — magnitud), `geo` (geometría base) |
| **Descripción** | Espigas verticales sobre un mapa mostrando magnitud en ubicaciones geográficas. Alternativa a bubble map que evita solapamiento. |

```js run=false
Plot.plot({
  projection: "albers-usa",
  marks: [
    Plot.geo(statesMesh, {
      stroke: "#ddd"
    }),
    Plot.vector(data, {
      x: "longitude",
      y: "latitude",
      length: "value",
      rotate: 180,
      anchor: "start",
      stroke: "steelblue"
    })
  ]
})
```

---

## Interpolated Raster

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Avanzada |
| **Marks** | `raster` (x: cuantitativo continuo, y: cuantitativo continuo, fill: cuantitativo continuo — interpolado), `dot` (puntos de referencia) |
| **Descripción** | Superficie continua generada por interpolación espacial de puntos dispersos. Mapas de elevación, temperatura o densidad. |

```js run=false
Plot.plot({
  color: {
    scheme: "Magma",
    legend: true
  },
  marks: [
    Plot.raster(data, {
      x: "x",
      y: "y",
      fill: "value",
      interpolate: "barycentric"
    }),
    Plot.dot(data, {
      x: "x",
      y: "y",
      fill: "white",
      r: 2,
      stroke: "black"
    })
  ]
})
```

---

## Grid Cartogram

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Avanzada |
| **Marks** | `cell` (x: cuantitativo discreto — columna, y: cuantitativo discreto — fila, fill: cuantitativo continuo), `text` (etiquetas de abreviatura) |
| **Descripción** | Unidades geográficas como celdas iguales en cuadrícula que preserva la disposición espacial. Cada unidad recibe peso visual igualitario. |

```js run=false
Plot.plot({
  axis: null,
  color: {
    scheme: "RdBu",
    legend: true
  },
  marks: [
    Plot.cell(gridData, {
      x: "col",
      y: "row",
      fill: "value",
      inset: 2
    }),
    Plot.text(gridData, {
      x: "col",
      y: "row",
      text: "abbr",
      fontSize: 10
    })
  ]
})
```

---

## Vector / Flow Field

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Spatial |
| **Complejidad** | Avanzada |
| **Marks** | `vector` (x: cuantitativo continuo — posición, y: cuantitativo continuo — posición, rotate: cuantitativo continuo — ángulo en grados, length: cuantitativo continuo — magnitud) |
| **Descripción** | Dirección y magnitud representadas como flechas. Para datos de viento, corrientes oceánicas, migración o campos de gradientes. |

```js run=false
Plot.plot({
  marks: [
    Plot.vector(data, {
      x: "longitude",
      y: "latitude",
      rotate: d => 180 + d.direction
        * 180 / Math.PI,
      length: "speed",
      stroke: "speed"
    })
  ]
})
```

---
---

# ★ Flow

Gráficas para mostrar conexiones, flujos o relaciones entre entidades.

---

## Arc Map

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Flow |
| **Complejidad** | Avanzada |
| **Marks** | `arrow` (x1/y1: cuantitativo continuo — coordenadas origen, x2/y2: cuantitativo continuo — coordenadas destino), `geo` (geometría base), `dot` (ubicaciones de referencia) |
| **Descripción** | Arcos curvos conectando ubicaciones geográficas mostrando flujos, rutas o relaciones. Migración, comercio, vuelos, logística. |

```js run=false
Plot.plot({
  projection: "albers-usa",
  marks: [
    Plot.geo(statesMesh, {
      stroke: "#ddd"
    }),
    Plot.arrow(flows, {
      x1: "origin_lon",
      y1: "origin_lat",
      x2: "dest_lon",
      y2: "dest_lat",
      bend: true,
      stroke: "steelblue",
      strokeOpacity: 0.5,
      strokeWidth: d => d.value
    }),
    Plot.dot(locations, {
      x: "longitude",
      y: "latitude",
      fill: "red",
      r: 3
    })
  ]
})
```

---

## Link Chart

| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Flow |
| **Complejidad** | Intermedia |
| **Marks** | `link` (x1/y1: cuantitativo continuo — punto origen, x2/y2: cuantitativo continuo — punto destino), `dot` (x: cuantitativo continuo, y: cuantitativo continuo), `text` (etiquetas) |
| **Descripción** | Conexiones origen-destino sin mapa geográfico. Cambio entre dos estados o relaciones entre pares de puntos. |

```js run=false
Plot.plot({
  marks: [
    Plot.link(data, {
      x1: "x_start",
      y1: "y_start",
      x2: "x_end",
      y2: "y_end",
      stroke: "#999",
      strokeWidth: 1
    }),
    Plot.dot(data, {
      x: "x_end",
      y: "y_end",
      fill: "steelblue",
      r: 4
    }),
    Plot.text(data, {
      x: "x_end",
      y: "y_end",
      text: "label",
      dx: 8
    })
  ]
})
```

---


## Sankey Diagram
 
| | |
|---|---|
| **Librería** | Plot |
| **Categoría** | Flow |
| **Complejidad** | Avanzado |
| **Marks** | `areaY` — bandas curvadas representando flujo entre nodos (una por enlace) · `rect` — rectángulos representando nodos · `text` — etiqueta de cada nodo |
| **Datos** | nodos: categórico (nombre) con x0/x1/y0/y1 cuantitativo continuo (posiciones calculadas) · enlaces: cuantitativo continuo (x, y0, y1 por punto de la curva) · requiere pre-cálculo con `d3-sankey` |
 

```js run=false
// Requiere pre-cálculo con d3.sankey()
// sankeyData contiene .nodes y .links procesados
// links es un array de arrays de puntos por enlace
//sankeyModule = require("d3-sankey@0.12.3/dist/d3-sankey.min.js")

Plot.plot({
  marks: [
    links.map((link) =>
      Plot.areaY(link, {
        x: "x",
        y1: "y0",
        y2: "y1",
        curve: "bump-x",
        fill: "#000",
        fillOpacity: 0.1,
        order: "value"
      })
    ),
    Plot.rect(sankeyData.nodes, {
      x1: "x0",
      x2: "x1",
      y1: "y0",
      y2: "y1",
      fill: "name"
    }),
    Plot.text(sankeyData.nodes, {
      x: "x1",
      dx: 5,
      y: (d) => (d.y1 + d.y0) / 2,
      text: "name",
      textAnchor: "start"
    })
  ],
  x: { axis: null },
  y: { axis: null },
  width: width,
  height: height,
  marginTop: 20,
  marginRight: 40
})
```