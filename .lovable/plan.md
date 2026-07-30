## Auditoría: por qué se siente complicado

Lo que encontré revisando la estructura actual:

1. **La navegación no refleja el trabajo real.** El sidebar agrupa por concepto interno (Performance / Listening / Producir) con 8 destinos. Un usuario no piensa "voy a Semántica", piensa "quiero ver de qué se habla". Y `Configuración` (donde viven las entidades, el paso 1 del proceso) está al final, después de Reportes.
2. **No hay sensación de progreso.** Existe `WorkflowProgressBar` (Definir → Capturar → Analizar → Reportar) pero solo aparece como 4 puntitos de 24px en el header, escondida en `md:` y sin texto. El motor de estado (`useWorkflowState`) ya está bien hecho — está desperdiciado.
3. **Fuentes es un laberinto.** 3 pestañas principales + 5 sub-pestañas + 4 tarjetas de configuración en "Automatización". `SocialMediaSearch.tsx` tiene 2 393 líneas y `MentionsHubTab.tsx` 1 011. Hay 3 buscadores distintos (unificado, social, news) donde el unificado ya cubre casi todo.
4. **Análisis fragmentado.** Panorama (9 pestañas), Semántica, Comparativa e Influenciadores son 4 destinos que se leen sobre el mismo universo de menciones con distintos cortes. Se siente repetido porque lo es.
5. **El Home no conecta con nada.** 4 tarjetas (dos de ellas apuntan al mismo destino: Performance) y una nota al pie diciendo "selecciona un proyecto arriba". No dice en qué estado están tus proyectos ni qué sigue.
6. **Sin proyecto seleccionado, media app es un muro vacío.** Cada página repite su propio empty state "Sin proyecto seleccionado".
7. **Deuda visual.** Hay tokens semánticos pero también colores crudos (`bg-amber-100`, `dark:text-amber-400`) en el layout; densidad y tamaños de título inconsistentes entre pantallas.

## Plan de rediseño

### Fase 1 — Estructura y orientación
- **Sidebar reorganizado en 2 contextos claros**: `Listening` (por proyecto) y `Benchmarking` (global), más `Inicio`.
- Dentro de Listening el orden pasa a ser el ciclo real: **Definir → Capturar → Analizar → Reportar**. `Configuración/Entidades` sube a "Definir".
- **Barra de flujo real** debajo del header: 4 pasos con etiqueta, conteo y CTA "qué sigue" (reusa `useWorkflowState`, sin cambiar su lógica). Visible también en móvil.
- **Home rediseñado**: lista de proyectos con su estado de flujo (entidades / menciones / analizadas / reportes) y un CTA directo al siguiente paso de cada uno. Benchmarking pasa a una tarjeta secundaria.
- **Empty state único y guiado** cuando no hay proyecto, en lugar de uno distinto por página.

### Fase 2 — Captura simplificada
- Fuentes se convierte en **2 pestañas**: `Menciones` (el hub) y `Capturar`.
- Dentro de `Capturar`: la búsqueda unificada como único formulario visible; social/news/comentarios pasan a ser modos avanzados dentro de ese formulario, no pestañas hermanas.
- Automatización (programadas, autoguardado, enriquecimiento de fechas, ingesta manual de URLs) sale de las pestañas a un **panel lateral "Automatización"** que se abre desde el header de Fuentes.
- Sin cambios en edge functions ni en la lógica de captura: solo reorganización de UI.

### Fase 3 — Análisis consolidado y capa visual
- **Un solo destino "Analizar"** con 4 vistas (Panorama, Semántica, Comparativa, Influenciadores) como secciones de una misma página con navegación interna y filtro de fechas compartido arriba. Las rutas viejas siguen funcionando con redirect.
- Panorama baja de 9 pestañas a los bloques que realmente se usan; el resto queda accesible pero no en primer plano.
- **Sistema visual unificado**: escala tipográfica y de densidad consistente, un solo patrón de encabezado de página, tarjetas KPI homogéneas, eliminación de colores crudos en favor de tokens. Se respeta la identidad actual (tema claro, Space Grotesk / Inter, violeta y naranja Wizr, colores de sentimiento).
- **Modo presentable para clientes**: las vistas de análisis y el visor de reportes quedan limpias y sin controles de operación, aptas para mostrar en pantalla.

## Notas técnicas

- Cero cambios de esquema, RLS o edge functions. Todo es frontend y presentación.
- `useWorkflowState`, `useMentions`, `usePanoramaData`, `useSmartReport` y los sanitizadores del reporte se conservan tal cual; solo cambia quién los consume.
- Los archivos gigantes (`SocialMediaSearch` 2.4k líneas, `MentionsHubTab` 1k) se dividen en subcomponentes al moverlos, sin reescribir su comportamiento.
- Todas las rutas actuales se mantienen vía `Navigate` para no romper enlaces guardados.

Sugiero ejecutar por fases y validar cada una en preview antes de seguir, empezando por la Fase 1 (es la que ataca directo el "no sé dónde estoy").
