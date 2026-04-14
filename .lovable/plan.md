

# Plan: Mejora integral de Wizr (end-to-end)

Este plan aborda las cuatro dimensiones que mencionaste, organizado en fases incrementales para mantener estabilidad.

---

## Fase 1: UX/UI y Navegacion (3-4 iteraciones)

### 1.1 Dashboard Home rediseñado
- Reemplazar el `WorkflowStatusLanding` actual (que es básicamente un checklist de pasos) por un **dashboard ejecutivo real** con:
  - KPIs principales en cards compactos (menciones hoy, sentimiento dominante, alertas activas)
  - Mini-gráfica sparkline de actividad de los últimos 7 días
  - Feed de actividad reciente (últimas 5 menciones guardadas)
  - Accesos directos contextuales basados en el estado del proyecto
- Mantener el `DailyIntelligenceSummary` pero hacerlo más compacto

### 1.2 Sidebar simplificado
- Reducir los 5 grupos actuales (Captura, Análisis, Salidas, Benchmarking, Gestión) a 3 grupos más claros:
  - **Monitor** (Fuentes, Panorama)
  - **Analizar** (Semántica, Comparativa, Influenciadores, Rankings)
  - **Producir** (Reportes, Configuración)
- Añadir indicadores visuales de estado en cada ítem (punto rojo = alertas, punto verde = datos nuevos)

### 1.3 FuentesPage: simplificar la UI
- La página actual tiene 1,432 líneas y 8 ViewModes. Reorganizar en:
  - Tab principal: **Hub de Menciones** (vista por defecto)
  - Tab secundario: **Buscar** (unifica manual + social + news en un solo flujo con selector de plataforma)
  - Tab terciario: **Automatización** (scheduled search + auto-save)
- Eliminar la fragmentación de tabs actuales

### 1.4 Responsive y micro-interacciones
- Verificar y corregir responsive en mobile (414px) para todas las páginas del dashboard
- Añadir transiciones suaves entre tabs y loading states más informativos

---

## Fase 2: Captura de datos (2-3 iteraciones)

### 2.1 YouTube API v3 - Validar la integración reciente
- La edge function `youtube-search` fue creada pero necesita testing real
- Verificar que el `YOUTUBE_API_KEY` funciona y los resultados se normalizan correctamente
- Añadir manejo de errores de cuota agotada con fallback informativo

### 2.2 TikTok con Bright Data - Scoring de relevancia
- Verificar que el scoring implementado en `brightdata-status` filtra efectivamente falsos positivos
- Añadir indicador visual de "relevancia" en los resultados de TikTok

### 2.3 Instagram - Priorizar actor rápido
- Confirmar que `microworlds/instagram-scraper` está como prioridad 1 en el pool
- Aumentar el límite de 20 resultados si el actor lo permite
- Añadir timeout más agresivo (90s en lugar de 180s) con mensaje claro al usuario

### 2.4 Monitoreo unificado mejorado
- En `UnifiedSearch`, mostrar un **resumen post-búsqueda** más claro: cuántos resultados por plataforma, cuántos duplicados eliminados, cuántos guardados
- Añadir retry automático para plataformas que fallaron

---

## Fase 3: Análisis e insights (2-3 iteraciones)

### 3.1 Análisis semántico automático
- Actualmente el usuario debe ir a Semántica y hacer click en "Analizar" manualmente
- Implementar **análisis automático** cuando se guardan nuevas menciones (batch de fondo)
- Usar la edge function `analyze-sentiment` automáticamente al guardar en Fuentes

### 3.2 Panorama/Insights mejorado
- Añadir **nube de palabras interactiva** directamente en la vista Panorama (actualmente solo está en Semántica)
- Mostrar **tendencias emergentes**: temas que están creciendo en frecuencia vs el período anterior
- Añadir comparación visual "esta semana vs semana anterior" en las métricas principales

### 3.3 Comparativa más útil
- Añadir **share of voice** automático basado en menciones por entidad
- Generar mini-insight de IA que explique las diferencias entre entidades

---

## Fase 4: Reportes y entregables (2 iteraciones)

### 4.1 Templates de reporte más específicos
- Añadir template de **Reporte de Crisis** con foco en menciones negativas y velocidad de propagación
- Añadir template de **Brief Diario** más compacto para envío rápido
- Mejorar el PDF generado con mejor diseño y branding Wizr

### 4.2 Canales de salida
- Añadir botón de **"Copiar como WhatsApp"** que genera texto formateado con emojis para pegar directamente
- Añadir **"Copiar como Markdown"** para uso en presentaciones o documentos
- Ambos ya están documentados en la memoria pero no implementados

---

## Orden de implementación sugerido

| Prioridad | Fase | Impacto |
|-----------|------|---------|
| 1 | 1.1 Dashboard Home | Alto - primera impresión |
| 2 | 1.3 FuentesPage simplificado | Alto - reduce fricción |
| 3 | 3.1 Análisis automático | Alto - elimina paso manual |
| 4 | 2.1-2.3 Validar capturas | Alto - fundacional |
| 5 | 1.2 Sidebar | Medio - claridad |
| 6 | 3.2 Panorama mejorado | Medio - valor analítico |
| 7 | 4.1-4.2 Reportes | Medio - entregables |

---

## Detalles tecnicos

- Todas las modificaciones son frontend (React/TypeScript) y edge functions (Deno)
- No se requieren migraciones de base de datos
- Se reutilizan los hooks existentes (`useMentions`, `useSemanticAnalysis`, `usePanoramaData`)
- El análisis automático de sentimiento usará la edge function `analyze-sentiment` existente

