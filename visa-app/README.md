# VisaGuide

[![CI](https://github.com/dquan123/Software_Proyecto/actions/workflows/ci.yml/badge.svg)](https://github.com/dquan123/Software_Proyecto/actions/workflows/ci.yml)

Aplicacion web para acompanar procesos de visa estadounidense.

## Panel de administracion

El panel administrador vive bajo `/admin` y reutiliza `AdminLayout` para Sidebar,
Header y contenido principal. La vista `/admin/interviews` usa el componente
`InterviewReviewPanel` con estilos integrados al panel administrador, incluyendo
resumen de entrevistas, seleccion de sesiones, reproduccion de audios y guardado
de retroalimentacion.

Los audios de entrevistas se guardan mediante la abstraccion `storage.js`: en
desarrollo/Docker usan fallback local y en produccion pueden usar R2. El panel
admin reproduce los audios desde `GET /interview-sessions/:id/audio/:questionId`,
por lo que no depende de URLs publicas del bucket. Ese endpoint esta pensado
para reproductores HTML (`<audio>`), por eso puede cargarse directamente como
`src` tanto desde cliente como desde administrador..

## Pago y cita consular

La pantalla `/pagos` muestra el paquete fijo de Q2,300 por persona. Incluye el
pago de USD 185 ante la embajada, llenado y confirmación del DS-160, confirmación
de cita, asesoramiento y hasta dos acercamientos sujetos a disponibilidad. El
cliente deposita o transfiere a la cuenta de la empresa y sube
el comprobante con su referencia. El asesor valida o rechaza la transferencia
desde `/gestion-consular`; solo después de confirmarla puede registrar el pago
realizado ante el consulado y la cita oficial. `/citas` permite al cliente seguir
esos estados y consultar los comprobantes. Los acercamientos solo pueden mover
la cita a una fecha anterior y el sistema limita cada expediente a dos. No se
simula disponibilidad consular.

Los datos bancarios se configuran mediante variables de entorno para evitar
publicar información sensible en el repositorio:

```env
PAYMENT_BANK_NAME=Nombre del banco
PAYMENT_ACCOUNT_NAME=Titular de la cuenta
PAYMENT_ACCOUNT_NUMBER=Numero de cuenta
PAYMENT_ACCOUNT_TYPE=Monetaria
PAYMENT_BANK_INSTRUCTIONS=Instrucciones adicionales para el cliente
```

Si faltan esos datos, la interfaz indica al cliente que debe solicitarlos a su
asesor, pero permite registrar un comprobante de una transferencia ya realizada.
Las migraciones se ejecutan al arrancar, por lo que bases existentes no necesitan
recrear el volumen de Docker.

## Usuarios de prueba

Estas cuentas son unicamente para desarrollo y pruebas.

| Rol | Correo | Contrasena |
| --- | --- | --- |
| Cliente | norman@prueba.cliente | 123456 |
| Cliente | juanfri@prueba.cliente | 123456 |
| Cliente | yaya@prueba.cliente | 123456 |
| Cliente | quan@prueba.cliente | 123456 |
| Cliente | usuario@prueba.com | 123456 |
| Asesor | asesor.dev@visaguide.test | VisaGuide-Dev-2026! |
| Admin | admin.norman@prueba.com | 123456 |
| Admin | admin.juanfri@prueba.com | 123456 |
| Admin | admin.yaya@prueba.com | 123456 |
| Admin | admin.quan@prueba.com | 123456 |
| Admin | admin@prueba.com | 123456 |
