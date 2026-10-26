# Requisitos por tipo de visa

Actualizado: 24 de octubre de 2026.

Esta guía describe cómo VisaGuide adapta el expediente. No sustituye las instrucciones del portal oficial ni la decisión de un oficial consular. Los requisitos pueden cambiar y el usuario debe seguir la hoja de instrucciones generada para su cita.

## Reglas comunes

Todos los solicitantes necesitan una solicitud individual, incluso cuando viajan como familia:

1. Pasaporte vigente.
2. Formulario DS-160 individual y su página de confirmación.
3. Fotografía que cumpla los requisitos oficiales; debe llevarse impresa si la carga digital falla.
4. Tarifa de solicitud correspondiente por persona.
5. Confirmación e instrucciones de la cita o de entrega de documentos.

La aplicación separa tres niveles para no presentar respaldos opcionales como requisitos universales:

- **Obligatorio:** documento requerido para el expediente o para una etapa concreta.
- **Si aplica:** depende de las instrucciones oficiales o de la situación del solicitante.
- **Puede solicitarse:** evidencia de respaldo que el oficial consular puede pedir.

## Turismo y negocios B1/B2

Documentos base en VisaGuide:

- Pasaporte y fotografía.
- Evidencia del propósito del viaje, fondos y vínculos con Guatemala como respaldo recomendado.
- Página de confirmación DS-160 y confirmación de cita en sus etapas correspondientes.

La categoría B1/B2 no autoriza empleo en Estados Unidos. No se debe comprar un boleto no reembolsable basándose únicamente en haber iniciado el trámite.

## Estudiante F-1 o M-1

Documentos y datos específicos:

- Formulario I-20 emitido por una institución autorizada y firmado por la institución y el estudiante.
- Número SEVIS y código SEVIS de la institución.
- Comprobante de pago I-901 SEVIS. Es independiente de la tarifa de solicitud de visa.
- Carta de admisión.
- Evidencia académica: certificados, diplomas, notas o resultados de exámenes relevantes.
- Evidencia de fondos para matrícula, manutención y viaje, incluidos patrocinio o beca cuando correspondan.

VisaGuide agrega una sección específica al DS-160 interno para clase F-1/M-1, número SEVIS, institución, programa, fecha de inicio y fuente de financiamiento. La carta de admisión y los respaldos académicos/financieros se muestran como evidencia recomendada porque el oficial puede solicitarlos según el caso; I-20 y comprobante SEVIS se tratan como documentos obligatorios del flujo estudiantil.

## Renovación B1/B2

Una renovación sigue requiriendo un DS-160 nuevo y una tarifa nueva. VisaGuide solicita:

- Pasaporte vigente.
- Visa B1/B2 anterior y el pasaporte que la contiene, si es distinto.
- Datos de emisión, vencimiento, categoría, vigencia completa, denegaciones y posibles causas de inadmisibilidad.
- Carta o instrucciones de entrega de documentos únicamente si el sistema oficial confirma que aplica.

La evaluación de VisaGuide es preliminar. No promete una exención de entrevista: el sistema oficial y el consulado deciden si corresponde entrega de documentos o entrevista, y pueden solicitar una entrevista en cualquier momento.

## Grupo familiar B1/B2

El grupo familiar comparte organización y seguimiento, pero no una sola solicitud. La implementación usa un expediente principal con integrantes adicionales:

- Cada integrante tiene nombre, parentesco y fecha de nacimiento.
- Cada integrante necesita pasaporte, fotografía, DS-160 y tarifa propios.
- La confirmación DS-160 se registra de forma individual.
- Los documentos se guardan con una clave vinculada al integrante para evitar mezclarlos.
- El total del paquete se calcula multiplicando el precio por el número de solicitantes.

No se implementa una “visa familiar” porque esa categoría no existe para este flujo; cada persona es evaluada individualmente.

## Adulto mayor

El perfil de adulto mayor usa el flujo B1/B2 y activa Modo Senior desde la selección del perfil y en cada inicio de sesión. La edad, por sí sola, no elimina automáticamente la entrevista. Los documentos son los de B1/B2 y las instrucciones oficiales determinan cualquier excepción aplicable.

## Fuentes oficiales

- [Visa de visitante B1/B2 — Departamento de Estado](https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html)
- [Visa de estudiante — Departamento de Estado](https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html)
- [DS-160 — Departamento de Estado](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/forms/ds-160-online-nonimmigrant-visa-application.html)
- [Tarifas de servicios de visa — Departamento de Estado](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html)
- [Pago I-901 SEVIS — ICE](https://www.ice.gov/sevis/i901)
- [Requisitos de fotografía — Departamento de Estado](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html)

## Correspondencia técnica

- Configuración central: `backend/config/visaProfiles.js`.
- API de requisitos: `GET /visa-profile/requirements`.
- Detalles de renovación: `PUT /visa-profile/details`.
- Integrantes familiares: `/visa-profile/family-members`.
- Formulario dinámico: `frontend/src/data/ds160Sections.js`.
- Pantalla de documentos: `frontend/src/pages/Documents.jsx`.
- Cálculo de pago por persona: `backend/services/consularPaymentService.js`.

Al agregar un nuevo perfil se debe actualizar primero la configuración central y después añadir pruebas de documentos obligatorios, compuertas del flujo, pago y renderizado.
