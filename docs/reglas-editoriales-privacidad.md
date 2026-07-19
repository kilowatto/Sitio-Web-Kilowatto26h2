# Reglas editoriales inquebrantables — kilowatto.com

> Privacidad primero. Ante cualquier duda entre "presumir algo" y proteger la privacidad, gana la privacidad. Estas reglas aplican a: el sitio público, el chatbot RAG, cualquier traducción a los 12 locales, y cualquier contenido generado automáticamente por los Workflows de ingesta.

## Regla 1 — Vida familiar / hijos

- **Nunca** confirmar ni negar si Esteban tiene hijos, cuántos, sus nombres, edades, escuelas, o cualquier dato identificable de menores en su círculo familiar.
- Esto aplica en todas partes: bio, timeline, redes, y **especialmente** en el chatbot RAG — si un visitante pregunta directa o indirectamente, la respuesta estándar (en todos los idiomas) es una variante de: *"Esteban valora profundamente la privacidad de su vida familiar y prefiere no compartir esos detalles."* Nunca inventar, nunca insinuar, nunca decir "no tiene hijos" ni "sí tiene hijos" — ninguna de las dos.
- **Sí se puede comunicar** libremente: que es una persona muy familiar, que valora la familia como pilar de su filosofía de vida, que está casado con Rocío desde el 20 de junio de 2013. Estos son datos que él mismo ha compartido y no requieren protección.
- El pipeline de generación de contenido (Workflows + LLM) debe tener esta regla como instrucción de sistema explícita, no solo como nota editorial — es decir, el prompt del generador de timeline/bio y el prompt del chatbot RAG deben incluir esta restricción de forma dura (hard constraint), no como sugerencia.

## Regla 2 — Fotografías: cero tolerancia con menores de edad

- **Prohibición absoluta**: ninguna fotografía que incluya a una persona menor de edad se publica en el sitio, ni siquiera de forma incidental o en segundo plano (fondo de una foto de evento, por ejemplo).
- Dado que la detección automática de edad por IA **no es 100% confiable**, el pipeline de fotos debe funcionar así:
  1. IA (modelo de visión en Workers AI) genera automáticamente: descripción/caption de la foto + un flag de "posible menor detectado" (sí/no/incierto).
  2. **Ninguna foto se publica automáticamente.** Toda foto pasa por una cola de revisión y requiere aprobación manual explícita de Esteban antes de ir a producción — la IA asiste (caption + flag), pero no decide sola en algo de esta magnitud.
  3. Si el flag de IA marca "posible menor" o "incierto", la foto queda bloqueada por defecto y requiere una segunda confirmación explícita para desbloquear (doble candado), no solo el approve normal.

## Regla 3 — Geolocalización de fotos

- Ninguna foto se publica con metadata de geolocalización (coordenadas EXIF GPS).
- **Antes** de eliminar el EXIF, el pipeline extrae y conserva solo dos datos derivados: **ciudad aproximada** (vía reverse geocoding de las coordenadas) y **fecha de captura**. Las coordenadas exactas, número de serie de cámara, y cualquier otro metadato identificable se eliminan por completo del archivo antes de que toque R2/publicación.
- La ciudad + fecha derivadas se guardan como metadata estructurada (D1), no como EXIF embebido en la imagen.

## Regla 4 — Tío Rogelio

- El tío Rogelio (hermano de Ricardo Rey, papá de Esteban) se menciona **una sola vez**, únicamente como referencia de árbol genealógico dentro de la bio de "Tito" (Manuel Rey García) — ejemplo: "tuvo entre sus hijos a Ricardo y Rogelio Rey". Fuera de ese único dato, no se habla de él: nada de anécdotas, actividades, ni contexto adicional. Esteban fue explícito: "de él en lo particular no quiero hablar."

## Regla 5 — Principio general

- Toda la trayectoria profesional, empresarial y de inversión de Esteban (Ignia Cloud, OnCloud/Octapus, DeSiCi, Prochemex, Orange Rhino, Yucatech Festival, Frida Café, etc.) es material público y se puede desarrollar con el mayor detalle posible.
- La vida personal/familiar se trata con el criterio opuesto: mínimo detalle, solo lo que él ha compartido explícitamente, nunca inferencia ni relleno generativo.
- Cualquier fuente de prensa o red social que mencione detalles familiares no compartidos por él debe excluirse del pipeline de ingesta (no solo del sitio final — ni siquiera debe entrar a Vectorize/D1, para que el chatbot RAG no tenga de dónde "alucinar" una respuesta).

## Pendiente de definir (preguntar a Esteban)

Categorías que suelen requerir la misma protección y que aún no se han confirmado explícitamente:
- Dirección exacta de domicilio(s)
- Datos de salud/médicos
- Cifras patrimoniales/financieras exactas (patrimonio neto, montos de inversión personal)
- Nombres de otros familiares directos (padres, hermanos) más allá de lo ya público en prensa
- Opiniones políticas partidistas (más allá de comparecencias públicas ante el Senado sobre política tecnológica/STEM, que sí son públicas)
