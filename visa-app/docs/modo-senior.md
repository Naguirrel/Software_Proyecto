# Modo senior

El modo senior es una capa de accesibilidad y simplificación exclusiva del cliente. Se activa desde su navegación o selección de perfil; no se muestra en las pantallas públicas ni en los paneles del asesor y administrador. La preferencia se conserva en `localStorage`, se sincroniza entre pestañas y solo se aplica si la sesión activa tiene rol `cliente`.

## Comportamiento

- Texto base de 24 px y texto auxiliar de al menos 20 px.
- Controles de formulario de al menos 64 px de alto.
- Foco visible de alto contraste y reducción de movimiento cuando el sistema lo solicita.
- Navegación lateral expandida en escritorio para evitar depender únicamente de iconos.
- Navegación simplificada: conserva las áreas autónomas del cliente, el paso actual y los pasos que ya están permitidos por el flujo.
- Guía contextual visible en cada vista con una instrucción breve y la siguiente acción recomendada.
- Tableros, formularios y flujos principales pasan a una sola columna cuando mejora la lectura.
- Contenido secundario oculto para conservar acciones, estado, errores, instrucciones necesarias y datos del trámite.
- Diseño adaptable: en móvil se mantiene la navegación mediante menú y las cuadrículas pasan a una columna.

## Clasificación de contenido

Los componentes que solo aportan contexto promocional, métricas no accionables o información repetida usan:

```html
data-senior-priority="secondary"
```

Ese contenido se oculta únicamente cuando el modo senior está activo. No debe aplicarse a:

- errores, alertas o confirmaciones;
- requisitos, bloqueos o dependencias del flujo;
- etiquetas y ayuda necesaria para completar formularios;
- acciones principales o alternativas de recuperación;
- estado de documentos, pagos, citas, tareas o mensajes.

## Componentes y estado global

- `SeniorModeToggle.jsx` concentra interacción, estado accesible y anuncios para lectores de pantalla del cliente.
- `SeniorGuidance.jsx` presenta instrucciones específicas de cada página y contempla el estado sin asesor asignado.
- `modoSenior.js` valida el rol, persiste la preferencia, refleja el estado en `<html>` y emite el evento global.
- `senior-mode.css` contiene las reglas transversales. Los estilos específicos de una vista solo deben añadirse cuando el patrón global no sea suficiente.

## Criterios de validación

1. Solo una sesión con rol `cliente` puede activar y conservar el modo senior.
2. La navegación y las acciones esenciales siguen disponibles con teclado y lector de pantalla.
3. No hay texto funcional menor de 20 px ni controles principales menores de 64 px.
4. No se ocultan errores, estados del trámite ni pasos obligatorios.
5. Los pasos futuros bloqueados no se presentan como acciones disponibles.
6. Las vistas funcionan sin desplazamiento horizontal, excepto tablas extensas dentro de su contenedor desplazable.
