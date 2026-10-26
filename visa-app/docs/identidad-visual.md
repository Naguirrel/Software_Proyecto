# Identidad visual de VisaGuide

La identidad oficial usa el símbolo de mapa plegado con ruta de verificación y el nombre `VisaGuide`. No se utiliza un eslogan dentro del logotipo de producto. La navegación del cliente muestra únicamente la marca; los subtítulos se reservan para contextos de personal (`Asesor`, `Administrador`) o para identificar la organización.

## Marca

- `VisaGuideLogo.jsx` es el único componente autorizado para componer símbolo, nombre y subtítulo.
- `VisaGuideMark` conserva un `viewBox` de 64 × 64 para renderizarse sin pérdida desde favicon hasta encabezados.
- El símbolo utiliza el gradiente coral `#ff476f` → `#d91545` y una ruta blanca.
- El texto `Guide` utiliza `--vg-red` para mantener el acento en superficies claras y oscuras.
- `favicon.svg` y `visaguide-favicon.svg` comparten el mismo símbolo sobre una superficie `#121212` de alto contraste.

## Iconografía

Los iconos propios viven en `frontend/src/components/icons/VisaGuideIcons.jsx`. Todos comparten cuadrícula 24 × 24, extremos redondeados, color heredado con `currentColor` y grosor configurable. Esto permite que estados activo, hover, bloqueado y modo oscuro dependan del componente de navegación, no del archivo SVG.

Los paneles usan el mismo significado visual:

- cuadrícula: inicio;
- documento con verificación: DS-160;
- línea de nodos: cronología;
- carpeta o documento: archivos;
- tarjeta: pagos;
- calendario: citas y recordatorios;
- personas: entrevistas, usuarios o solicitudes;
- globo de conversación: chat;
- lista verificada: tareas;
- libro abierto: banco de preguntas;
- lentes circulares: modo senior.

La selección inicial de perfil asigna un símbolo específico a cada caso:

- maletín: turismo o negocios B1/B2;
- birrete: estudiante F/M;
- documento con ciclo de actualización: renovación B1/B2;
- grupo de tres personas: grupo familiar;
- lentes circulares: adulto mayor con asistencia accesible.

Las acciones globales utilizan el círculo de información y la campana propios del sistema. Ambos mantienen un área interactiva mínima de 42 px, distintivo numérico independiente del icono y nombre accesible en el control contenedor.

Los iconos decorativos se ocultan de lectores de pantalla. El nombre accesible pertenece al enlace o botón que los contiene.

## Cambio de asesor

El cambio de asesor no se representa en la navegación ni mediante un icono. En `Mi perfil`, la sección de acompañamiento muestra la pregunta `¿Algún problema con tu asesor?` y la acción textual `Contar mi caso`. El formulario explica la revisión confidencial, solicita motivo y descripción, y muestra el estado `Solicitud en revisión` mientras administración evalúa el caso.

