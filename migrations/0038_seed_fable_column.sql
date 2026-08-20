INSERT INTO columns (slug, title, subtitle, body_html, published_at) VALUES (
  'mis-aventuras-con-fable',
  'Mis aventuras con Fable',
  'Cómo gasté $845 dólares en 48 horas para resolver problemas que no existían',
  '<p>Mucho se ha hablado recientemente de Fable, el nuevo súper modelo de IA. Los foros debaten acaloradamente sobre sus implicaciones en ciberseguridad, los legisladores discuten su impacto político y los analistas financieros se llevan las manos a la cabeza por sus costos operativos.</p>
<p>Para ponerlo en perspectiva, el precio de Fable es prohibitivo. Estamos hablando de que acceder a su API es aproximadamente 10 veces más caro que usar Opus 4.8, asombrosamente 50 veces más costoso que Sonnet 5, y unas 15 veces más caro que la generación anterior de GPT (antes de la salida de Sol).</p>
<p>A pesar de este &ldquo;impuesto al genio&rdquo;, decidí probarlo sin sesgos. Mi ambición era la misma de cualquier director de tecnología: hacer más, con menos, y más rápido. Quería ver si el costo se justificaba con un retorno de inversión brutal.</p>
<p>Así que mi equipo y yo conectamos a Fable directamente a nuestros flujos de trabajo y análisis diarios. Lo que ocurrió en las siguientes 48 horas fue una lección magistral de brillantez técnica y absurdo comercial.</p>
<h2>El genio proactivo y la vulnerabilidad de GitLab</h2>
<p>A los pocos minutos de escanear nuestra infraestructura, Fable levantó la mano. Había encontrado que nuestro entorno de GitLab tenía unas librerías open-source que eran vulnerables.</p>
<p>Para quienes no sean del área técnica, GitLab es la plataforma de desarrollo colaborativo y control de versiones por excelencia, utilizada por más de 100,000 organizaciones en el mundo para guardar su código fuente y automatizar sus despliegues. Es, literalmente, el corazón de las operaciones de software.</p>
<p>Fable no solo nos avisó del problema. Por iniciativa propia (y consumiendo tokens a la velocidad de la luz), salió a buscar el código fuente de las librerías, analizó los parches y nos entregó el proceso de remediación completo. Es increíble pensar que GitLab ha convivido con estos detalles durante años sin que casi nadie los notara, y Fable lo desmenuzó en minutos.</p>
<h2>La base de datos intocable</h2>
<p>Poco después, lo soltamos sobre un problema histórico que teníamos: una deuda técnica en una base de datos MySQL muy antigua. Durante años nos habíamos negado a tocarla argumentando que, por problemas de retrocompatibilidad con sistemas viejos, si la actualizábamos, romperíamos la operación.</p>
<p>Al pedirle a Fable que analizara por qué no podíamos migrarla, el modelo simplemente ignoró nuestra premisa humana derrotista. Decidió que sí se podía. En cuestión de horas, creó un script maestro que actualizó completamente el motor de MySQL y, además, programó todo el proceso intermedio (un middleware) para garantizar la retrocompatibilidad. Resolvió un problema que nosotros habíamos archivado en el cajón de &ldquo;algún día&rdquo;.</p>
<h2>El choque con la realidad (y con la factura)</h2>
<p>Visto desde la ingeniería pura, Fable es magia. Pero desde la dirección de negocios, la historia es muy distinta. ¿Qué tanto impactó esta proactividad a nuestra operación real? Absolutamente nada.</p>
<p>Confieso que no implementamos el parche de GitLab. ¿Por qué? Porque tras analizar la vulnerabilidad, nos dimos cuenta de que en nuestro contexto específico, ese fallo no ponía en riesgo mis datos, ni los de mis clientes, ni nuestros proyectos internos. Podíamos vivir perfectamente así.</p>
<p>Por otro lado, la base de datos MySQL que Fable arregló majestuosamente es un sistema legacy (heredado) que ya va de salida. Arreglarlo no aporta valor a los objetivos de este trimestre, porque el sistema entero será dado de baja pronto.</p>
<p>Y entonces llegó el golpe: las primeras 48 horas de uso autónomo de Fable nos arrojaron una factura de API de $845 dólares. Gastamos casi mil dólares para que una supercomputadora resolviera brillantemente dos problemas que, operativamente, no existían.</p>
<h2>Una golondrina no hace verano</h2>
<p>A la fecha, Fable no nos ha encontrado otras cosas operativas que justifiquen su tarifa diaria. De hecho, nuestro caballo de batalla actual, Sonnet 5, está encontrando el 95% de los mismos problemas con un costo increíblemente menor.</p>
<p>No dudo de la potencia de Fable. Estoy seguro de que en empresas de ciberseguridad ofensiva o en laboratorios de biotecnología podrían sacarle provecho a cada centavo. Pero no tengo evidencia de que para la gran mayoría de las empresas tradicionales valga la pena hoy en día.</p>
<p>Por supuesto, estos son casos anecdóticos. Mi equipo y yo no desecharemos Fable, pero lo relegaremos al estante de &ldquo;romper el cristal en caso de emergencia&rdquo;. Se usará solo para proyectos imposibles.</p>
<h2>El verdadero orquestador</h2>
<p>Hoy nuestra estrategia es mucho más pragmática. Estamos usando Sonnet 5 para el trabajo pesado y migrando cargas complejas a GPT Sol (el nuevo modelo insignia de OpenAI que reemplazó a la numeración tradicional, enfocado en razonamiento continuo y agentes de muy alta fiabilidad).</p>
<p>Pero la verdadera apuesta a futuro la tenemos en la IA local. Estamos siguiendo muy de cerca a Kimi K3, el poderoso modelo chino. Nuestro objetivo es ponerlo on-premise (en nuestros propios servidores). El reto actual de Kimi K3 es la cantidad grosera de GPUs y memoria VRAM que exige para correr, pero esperamos que con una destilación y cuantización bien realizada en los próximos meses, Kimi pueda convertirse en el gran orquestador interno de nuestros agentes de IA, gratuito y privado.</p>
<p>En el 2026, la inteligencia ya no escasea; lo que escasea es el sentido común para saber cuándo comprar un Ferrari para ir a la esquina, y cuándo es mejor ir a pie.</p>
<p>Me encantaría leer sus experiencias. ¿Están pagando el impuesto de Fable o prefieren optimizar? Los leo.</p>',
  '2026-07-27'
);
