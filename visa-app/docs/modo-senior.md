# Modo senior

El modo senior es una capa global de accesibilidad y simplificación. Se activa desde las pantallas públicas, el panel del cliente, el panel del asesor y el panel administrativo. La preferencia se conserva en `localStorage` y se sincroniza entre pestañas.

## Comportamiento

- Texto base de 20 px y texto auxiliar de al menos 18 px.
- Controles de formulario de 56 px de alto y objetivos táctiles de al menos 52 px.
- Foco visible de alto contraste y reducción de movimiento cuando el sistema lo solicita.
- Navegación lateral expandida en escritorio para evitar depender únicamente de iconos.
- Tableros con un máximo de dos columnas; formularios y flujos principales pasan a una sola columna cuando mejora la lectura.
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

- `SeniorModeToggle.jsx` concentra interacción, estado accesible y anuncios para lectores de pantalla.
- `modoSenior.js` persiste la preferencia, refleja el estado en `<html>` y emite el evento global.
- `senior-mode.css` contiene las reglas transversales. Los estilos específicos de una vista solo deben añadirse cuando el patrón global no sea suficiente.

## Criterios de validación

1. Activar el modo desde cualquier layout actualiza todas las vistas y otra pestaña abierta.
2. La navegación y las acciones esenciales siguen disponibles con teclado y lector de pantalla.
3. No hay texto funcional menor de 18 px ni controles principales menores de 52 px.
4. No se ocultan errores, estados del trámite ni pasos obligatorios.
5. Las vistas funcionan sin desplazamiento horizontal, excepto tablas extensas dentro de su contenedor desplazable.
