# El negocio de las VPN: lo que cuestan, lo que prometen y lo que de verdad hacen

### Pagué $2.19 al mes por mi VPN. Al renovar, la misma empresa me cobró casi cuatro veces más — y no fui el único

**2026-08-15 · Por Esteban Rey ([@Kilowatto](https://x.com/kilowatto)) · Tiempo estimado de lectura: 22 min**

---

## Resumen ejecutivo

Investigué a fondo la industria de las VPN de consumo —NordVPN, ExpressVPN, Surfshark, CyberGhost, Proton VPN, Mullvad, las gratuitas y el "VPN" integrado de Opera— para separar el marketing de la realidad técnica y legal. Encontré un patrón: varias de las VPN más patrocinadas pertenecen a los mismos dos o tres grupos corporativos que también son dueños de sitios que las "comparan de forma independiente". Las auditorías de no-registro de datos son hoy más rigurosas que hace cinco años, pero el precio que ves el primer mes casi nunca es el que pagarás al renovar, y NordVPN enfrenta demandas por eso mismo en EE.UU. Las VPN gratuitas, con pocas excepciones auditadas, siguen siendo el negocio inverso: tú eres el producto. Y mitos como "te vuelves invisible" o "es obligatorio usarla en el aeropuerto" resisten poco al escrutinio técnico.

---

Hace unas semanas revisé el estado de cuenta de mi tarjeta y encontré un cargo que no reconocí: $107 dólares de una VPN que hace dos años contraté por $2.19 al mes. Por un momento pensé que se trataba de un error de facturación. No lo era. Era el precio de "renovación automática" — el que la misma empresa que me vendió la privacidad de mi tráfico nunca puso en letras grandes.

No fui el único sorprendido. Un análisis de casi 30,000 reseñas de Android de los cuatro proveedores más grandes —NordVPN, ExpressVPN, Surfshark y Proton VPN— encontró que las quejas sobre renovaciones automáticas y disparos de precio dominan las reseñas negativas [🟡](https://www.techradar.com/vpn/vpn-privacy-security/they-will-renew-your-subscription-even-if-you-turn-off-the-auto-renewal-which-vpn-has-the-most-price-complaints-on-the-play-store) (TechRadar, 2026). Y NordVPN específicamente enfrenta ya cuatro demandas en cortes federales de EE.UU. por prácticas de renovación que los demandantes califican de "engañosas" [🟢](https://www.techradar.com/vpn/vpn-services/a-us-law-firm-is-taking-nordvpn-to-court-over-deceptive-auto-renewal-pricing-heres-what-we-know) (TechRadar, 2026).

Ese fue el gancho que me hizo abrir la caja completa: ¿qué tan cierto es todo lo demás que promete esta industria de $70 a $80 mil millones de dólares al año [🟡](https://vpnpro.com/blog/vpn-market-size-and-share-2026/) (VPNpro, 2026)? Pasé varias semanas revisando auditorías, demandas, papers académicos y hasta el código fuente de apps gratuitas. Esto fue lo que encontré.

## El dueño de tu VPN también es dueño de quien te dice cuál comprar

Empecemos por donde casi nadie mira: quién es el dueño real de la marca que ves patrocinada en YouTube.

ExpressVPN, CyberGhost, Private Internet Access (PIA) y ZenMate pertenecen todas al mismo grupo: Kape Technologies, una empresa que cotiza en Londres y que hoy controla el israelí-británico Teddy Sagi [🟢](https://en.wikipedia.org/wiki/Kape_Technologies) (Wikipedia/registros corporativos, 2026). Kape se llamaba Crossrider hasta 2018, cuando se renombró tras años de operar como distribuidora de software publicitario (adware) [🟢](https://cyberinsider.com/kape-technologies-owns-expressvpn-cyberghost-pia-zenmate-vpn-review-sites/) (CyberInsider, 2024). El propio CEO de Kape ha reconocido en entrevistas que el cambio de nombre buscaba distanciarse de "actividades pasadas" [🟢](https://cyberinsider.com/kape-technologies-owns-expressvpn-cyberghost-pia-zenmate-vpn-review-sites/) (CyberInsider, 2024).

Eso ya sería una nota de pie de página incómoda. Lo que la vuelve relevante para ti como consumidor es lo segundo: varias investigaciones de medios especializados documentan que Kape también controla sitios de "reseñas independientes" de VPN que, sistemáticamente, colocan a sus propias marcas en el primer lugar de sus rankings [🟡](https://privacyproof.online/blog/who-owns-your-vpn-corporate-ownership-2026) (PrivacyProof, 2026) [🟡](https://vpntesting.com/ownership/kape-technologies/) (VPN Testing Research Lab, 2026). No es ilegal —ninguna ley obliga a un sitio de reseñas a declarar quién es su dueño— pero sí es la razón por la que, cuando un YouTuber dice "comparé todas las VPN y esta ganó", vale la pena preguntar quién financió la comparación.

NordVPN y Surfshark tienen un problema de transparencia distinto, aunque menos grave: desde la fusión de 2022 pertenecen al mismo grupo, Nord Security, con sede operativa en Lituania y estructura corporativa que incluye entidades en Panamá [🟡](https://jazod.com/ownership/) (Jazod, 2026). Nord Security reporta ingresos recurrentes anuales de alrededor de $357 millones de dólares y una valuación cercana a los $3,000 millones [🟡](https://getlatka.com/companies/nordsecurity.com) (Latka, 2025), y sus fundadores —a diferencia de Kape— son públicos y verificables: Tomas Okmanas y Eimantas Sabaliauskas, quienes construyeron la empresa sin capital externo durante una década antes de recibir sus primeras rondas de inversión en 2022 [🟢](https://sifted.eu/articles/nord-security-bootstrap-ipo) (Sifted, 2024).

En el otro extremo están Proton VPN, ligada a la fundación suiza detrás de Proton Mail, y Mullvad, sueca, cuyos fundadores son públicos y que se niega deliberadamente a pedirte un correo electrónico para registrarte [🟢](https://shieldedbrowsing.com/mullvad-review/) (Shielded Browsing, 2026). Sobre esto volveré más adelante, porque es la comparación más honesta que se puede hacer en esta industria.

**Gráfica 1 · Mapa de propiedad**

| Grupo | Marcas | Sede |
|---|---|---|
| Kape Technologies | ExpressVPN, CyberGhost, PIA, ZenMate | Londres (Teddy Sagi) |
| Nord Security | NordVPN, Surfshark | Lituania |
| Independientes | Proton VPN, Mullvad | Suiza / Suecia |

*(La versión HTML/PDF muestra esta comparación como tarjeta visual con chips de color.)*

## Cuánto paga una VPN por un YouTuber (y por qué algunos ya no aceptan el cheque)

Antes de entrar a la parte técnica, vale la pena entender por qué ves tantos anuncios de VPN en el mismo video: el nicho de tecnología paga entre $30 y $60 de CPM (costo por cada mil vistas), uno de los más altos de la plataforma después de finanzas [🟡](https://sponsorradar.com/insights/youtube-sponsorship-rates-what-brands-should-pay) (SponsorRadar, 2026). Un canal mediano de 200,000 vistas por video puede cobrar entre $6,000 y $12,000 dólares por una sola integración patrocinada de VPN; canales grandes negocian cifras de cinco dígitos por video [🟡](https://sponsorradar.com/insights/how-much-do-youtubers-make-from-sponsorships) (SponsorRadar, 2026).

**Gráfica 2 · CPM de YouTube por nicho (dólares por cada mil vistas)**

| Nicho | Rango de CPM |
|---|---|
| Finanzas y negocios | $40 – $80 |
| Tecnología (incl. VPN) | $30 – $60 |
| Salud y bienestar | $25 – $45 |
| Gaming | $10 – $25 |

Ese dinero ha generado, dentro de la propia comunidad tech, un debate incómodo. El divulgador británico Tom Scott publicó un video —convertido en referencia obligada— desmontando las afirmaciones típicas de los guiones de patrocinio de VPN, empezando por la más repetida: que sin VPN un atacante puede robarte la contraseña en cualquier red pública, algo que el cifrado HTTPS ya hace innecesario en la inmensa mayoría de sitios desde hace años [🟢](https://linustechtips.com/topic/1118228-tom-scott-on-common-vpn-sponsorship-claims/) (Linus Tech Tips forum citando a Tom Scott, 2019). Linus Tech Tips, el canal de tecnología más grande en su categoría, dejó de aceptar patrocinios de VPN durante años por las mismas razones antes de anunciar en 2024 que reconsideraría hacerlo caso por caso [🟡](https://thetvdb.com/series/linus-tech-tips/episodes/10515747) (registro de episodio, LTT, 2024). Es una señal reveladora: si los propios creadores que cobran por promocionar VPN dudan de los guiones que les entregan, el consumidor final tiene motivos de sobra para revisar la letra pequeña.

## Las auditorías "sin registros": lo que sí cambió (y lo que sigue sin poder probarse)

Aquí viene la parte donde la industria realmente mejoró. Hace diez años, "no guardamos registros" era una frase de marketing sin nada detrás. Hoy, NordVPN, ExpressVPN, Surfshark, Proton VPN, Mullvad y PIA han pasado por auditorías repetidas de firmas serias: PwC, Deloitte, KPMG y la firma alemana de pruebas de penetración Cure53 [🟢](https://www.vpnvertex.com/vpn-independent-audits/) (VPN Vertex, 2026). ExpressVPN, por ejemplo, publicó en 2025 su tercera auditoría consecutiva de KPMG sobre su arquitectura TrustedServer, que corre enteramente en RAM y se borra en cada reinicio [🟢](https://www.expressvpn.com/blog/kpmg-2025-no-logs-policy-audit/) (ExpressVPN, blog oficial, 2025). Proton VPN, al ser de código abierto, suma a sus auditorías anuales de Securitum una revisión pública continua de su código por parte de la comunidad [🟢](https://www.vpnvertex.com/vpn-independent-audits/) (VPN Vertex, 2026).

Pero "auditado" no significa "infalible", y aquí es donde el escepticismo del lector tiene toda la razón. Estas auditorías certifican una arquitectura y un punto en el tiempo, no un juramento eterno. El ejemplo de manual es PureVPN: en 2017 su política de privacidad decía textualmente que no guardaba ningún registro. Cuando el FBI investigó un caso de ciberacoso, PureVPN entregó marcas de tiempo de conexión que, cruzadas con otros datos, ayudaron a identificar al sospechoso [🟢](https://cyberinsider.com/vpn-logs-lies/) (documento judicial del FBI, citado por CyberInsider, 2026). No entregaron historial de navegación —eso técnicamente era cierto que no lo guardaban— pero sí guardaban más de lo que su propia política prometía. Casos similares se han documentado con HideMyAss [🟡](https://cyberinsider.com/vpn-logs-lies/) (CyberInsider, 2026).

NordVPN tuvo su propio momento de prueba en 2018, cuando un atacante comprometió uno de sus más de 3,000 servidores en un centro de datos en Finlandia, aprovechando un sistema de administración remota que el propio proveedor del centro de datos había dejado inseguro [🟢](https://nordvpn.com/blog/official-response-datacenter-breach/) (comunicado oficial de NordVPN, 2019). La empresa tardó más de un año en revelarlo públicamente después de descubrirlo, lo cual generó críticas legítimas sobre transparencia, aunque investigadores externos coincidieron en que no había evidencia de que se hubiera filtrado actividad de usuarios [🟡](https://www.itpro.com/data-insights/34675/nordvpn-confirms-2018-data-centre-breach) (IT Pro, 2019). Tras el incidente, NordVPN migró toda su infraestructura a servidores que operan exclusivamente en RAM y multiplicó sus auditorías anuales [🟢](https://nordvpn.com/blog/official-response-datacenter-breach/) (NordVPN, 2019).

La lección honesta aquí no es "no confíes en ninguna VPN auditada". Es que una auditoría reduce el riesgo de mentira deliberada, pero no elimina el riesgo de una implementación técnica fallida ni el de una filtración por un tercero mal asegurado. Las auditorías de 2026 son un piso mínimo razonable para elegir proveedor — no una garantía de invulnerabilidad.

**Gráfica 3 · Cronología: escándalos, arreglos y demandas**

| Año | Evento | Tipo |
|---|---|---|
| 2015 | Hola VPN vende ancho de banda (Luminati) | Escándalo |
| 2017 | FTC recibe queja vs. Hotspot Shield / PureVPN entrega datos al FBI | Escándalo |
| 2018 | Brecha en un servidor de NordVPN (Finlandia) | Escándalo |
| 2019 | Facebook cierra Onavo tras presión de Apple | Corrección/regulación |
| 2021 | Kape compra ExpressVPN por $936M | Propiedad |
| 2025 | Rondas de auditoría KPMG/Deloitte más rigurosas | Corrección/regulación |
| 2026 | Demandas por renovación automática contra NordVPN | Legal |

## Las gratuitas: el negocio en el que tú eres el inventario

Si pagar $2 al mes por una VPN auditada ya tiene letra pequeña, las gratuitas son harina de otro costal. Un estudio académico presentado en el simposio NDSS 2026 por investigadores de la Universidad de Michigan, la Universidad de Nuevo México y el IIT Delhi analizó 281 apps de VPN gratuitas para Android y encontró fugas de tráfico, configuraciones sin cifrar y bibliotecas de rastreo activas en una porción significativa de ellas [🟢](https://thehackernews.com/2026/07/study-of-281-free-android-vpn-apps.html) (The Hacker News citando el paper NDSS, 2026). Una investigación separada de Top10VPN sobre 100 apps gratuitas de Android encontró que la mitad enviaba datos a terceros como ByteDance y Yandex, y que un porcentaje mayoritario solicitaba permisos —como escanear qué otras apps tienes instaladas o acceder a tu ubicación— que no tienen ninguna función legítima dentro de una VPN [🟢](https://axis-intelligence.com/are-free-vpns-safe/) (Top10VPN, citado por Axis Intelligence, 2026).

**Gráfica 4 · Lo que encontró la auditoría de 100 VPN gratuitas**

| Hallazgo | % de apps gratuitas |
|---|---|
| Filtran algún dato del usuario | 90% |
| Piden permisos sin función legítima | 70% |
| Comparten datos con terceros externos | 50% |
| Usan cifrado más débil que el estándar | 33% |

El caso más citado de "modelo de negocio inverso" es Hola VPN: su versión gratuita convertía el dispositivo de cada usuario en un nodo de salida de una red de proxies residenciales comercial, llamada Luminati (hoy Bright Data), que la misma empresa vendía a terceros [🟢](https://www.newsweek.com/hola-holavpn-luminati-cybersecurity-trend-micro-virtual-private-network-1264639) (Newsweek citando investigación de Trend Micro, 2018). En la práctica, tu conexión a internet podía ser usada por un cliente de Luminati en cualquier parte del mundo —incluyendo, según documentó la investigación de Trend Micro, actores que abusaban de la red para intentar acceder a cuentas de correo robadas [🟢](https://social.cyware.com/news/researchers-warn-hola-vpn-users-of-weak-encryption-and-ip-address-leaks-ca9daa39) (Trend Micro, citado por Cyware, 2020). El fundador de Hola, cuando le preguntaron si sus usuarios sabían cómo se usaba su ancho de banda, respondió que la mayoría "no le importa" [🟢](https://cisomag.com/free-vpn/) (CISO Mag, 2019).

Ni Facebook se salvó de este patrón. Su app Onavo Protect se vendía como una VPN para proteger datos personales, pero en realidad alimentaba a Facebook con métricas de qué apps usabas, cuánto tiempo y qué sitios visitabas — información que la empresa usó, entre otras cosas, para detectar el crecimiento de WhatsApp antes de comprarlo [🟢](https://techcrunch.com/2019/02/21/facebook-removes-onavo/) (TechCrunch, 2019). Apple expulsó la versión de "investigación" de Onavo de su tienda por violar las reglas de certificados empresariales, y Facebook terminó por cerrar el servicio por completo en 2019 [🟢](https://techcrunch.com/2019/02/21/facebook-removes-onavo/) (TechCrunch, 2019).

Y luego está Hotspot Shield, cuyo caso ilustra el mecanismo regulatorio que sí existe (aunque sea lento): en 2017, el Center for Democracy and Technology presentó una queja formal ante la Comisión Federal de Comercio de EE.UU. (FTC) documentando que la versión gratuita de Hotspot Shield redirigía tráfico de comercio electrónico a dominios socios y compartía identificadores de dispositivo con redes publicitarias, pese a anunciar "privacidad garantizada" [🟢](https://cdt.org/press/cdt-files-complaint-with-the-ftc-on-hotspot-shield-vpn/) (queja formal de CDT ante la FTC, documento primario, 2017).

No todas las gratuitas son un fraude. Proton VPN Free —sin límite de datos, aunque con menos servidores— y Windscribe Free operan bajo la misma infraestructura auditada que sus versiones de paga, y son la excepción documentada dentro de un mercado que, en conjunto, sigue siendo un terreno minado [🟡](https://trustmyip.com/blog/free-vpn-vs-paid-vpn) (TrustMyIP, 2026).

## Opera: el "VPN gratis" que en realidad es un proxy de navegador

Aquí hay un mito que probablemente te afecta directamente si usas Opera o Opera GX: su "VPN gratis integrada" no es, técnicamente, una VPN.

Lo que Opera llama "Free VPN" es un proxy que cifra únicamente el tráfico que pasa por el navegador Opera, usando el protocolo estándar HTTPS/TLS — el mismo que ya usa cualquier sitio web seguro — en lugar de un protocolo real de túnel VPN como OpenVPN o WireGuard [🟢](https://www.top10vpn.com/guides/is-opera-vpn-safe/) (Top10VPN, 2026). Eso significa que tu cliente de correo, tus apps de escritorio, tu cliente de torrents o incluso otro navegador que tengas abierto simultáneamente no reciben ninguna protección — solo lo que ocurre dentro de la ventana de Opera [🟢](https://privacysavvy.com/reviews/vpn/opera-vpn/) (PrivacySavvy, 2026). Múltiples revisores técnicos coinciden en llamarlo, literalmente, "una VPN solo de nombre" [🟢](https://cybernews.com/best-vpn/opera-vpn-review/) (Cybernews, 2024). El propio Opera sí es transparente en su descripción técnica si lees la letra pequeña — el problema es que la etiqueta "Free VPN" en la interfaz no lo es [🟡](https://www.opera.com/features/free-vpn) (Opera, página oficial, 2026).

Vale la pena añadir contexto sobre quién es dueño de Opera: desde 2016 el navegador pertenece a un consorcio encabezado por la china Kunlun Tech y Qihoo 360 [🟢](https://grokipedia.com/page/Opera_(company)) (registro corporativo, 2026). En 2020, la firma de investigación bursátil Hindenburg Research acusó a Opera de operar aplicaciones de préstamos de corto plazo en Kenia, Nigeria e India con tasas efectivas de entre 365% y 876% anual, muy por encima de lo que anunciaban públicamente [🟡](https://www.theregister.com/2020/01/21/opera_accused_predatory_loans/) (The Register citando el reporte de Hindenburg, 2020). Opera calificó el reporte como lleno de errores y lo rechazó públicamente [🟡](https://www.theregister.com/2020/01/21/opera_accused_predatory_loans/) (The Register, 2020) — el caso quedó, en los hechos, como una disputa no resuelta entre ambas partes, sin que yo haya encontrado una resolución judicial posterior que zanje la discusión. Ninguno de estos dos temas —ni la naturaleza de proxy del "VPN gratis", ni la disputa sobre las apps de préstamos— tiene relación técnica directa con la seguridad de tu navegación, pero sí son relevantes si tu razón para usar Opera es "privacidad".

## Los mitos que hay que enterrar: invisibilidad, Google y el antivirus de regalo

Vamos ahora a las preguntas que probablemente te trajeron hasta aquí.

**¿Te vuelve invisible?** No. Una VPN oculta tu dirección IP real y cifra el tráfico entre tu dispositivo y el servidor del proveedor. Eso es real y es valioso. Pero no te hace anónimo: el llamado "fingerprinting" de navegador —una combinación de resolución de pantalla, fuentes instaladas, zona horaria, versión de navegador y decenas de variables más— puede identificar tu dispositivo con precisión casi única entre cientos de usuarios, y sobrevive a que cambies de servidor VPN, borres cookies o uses modo incógnito [🟢](https://hackaday.com/2025/11/19/browser-fingerprinting-and-why-vpns-wont-make-you-anonymous/) (Hackaday, 2025). Y si inicias sesión en tu cuenta de Google, Facebook o Netflix mientras usas la VPN, esa empresa sabe exactamente quién eres, sin importar qué IP estés usando ese día [🟢](https://nordvpn.com/blog/can-you-be-tracked-with-a-vpn/) (NordVPN, blog propio reconociendo la limitación, 2026).

**¿Google ya no puede rastrearte?** Solo parcialmente. Una VPN le oculta tu ubicación de red a Google, pero no a Google-el-servicio si usas una cuenta de Google activa, ni a las cookies y píxeles de rastreo que la mayoría de sitios siguen usando pase lo que pase con tu IP [🟢](https://www.ghostery.com/blog/can-you-be-tracked-if-you-use-a-vpn) (Ghostery, 2026).

**¿El "antivirus incluido" sirve o es relleno de marketing?** Aquí, sorprendentemente, la respuesta es más matizada de lo que esperaba. El motor de bloqueo de amenazas de NordVPN (Threat Protection Pro) fue certificado por AV-TEST, un laboratorio alemán independiente, con una tasa de detección de enlaces maliciosos de 83.4% frente a un 47% del segundo mejor competidor evaluado en la misma prueba [🟢](https://www.techradar.com/pro/vpn/two-independent-audits-confirm-nordvpn-as-top-tool-for-blocking-malicious-sites) (TechRadar citando resultados de AV-TEST, 2025). En pruebas de AV-Comparatives de 2026 bloqueó hasta 96% de URLs de phishing activas sin falsos positivos [🟢](https://nordvpn.com/blog/nordvpn-anti-phishing-test-results/) (NordVPN citando AV-Comparatives, 2026). Dicho esto, es importante entender qué es realmente: un bloqueador de dominios y enlaces maliciosos a nivel de red, no un antivirus tradicional que escanea archivos ya descargados en tu disco en busca de comportamiento malicioso. Es una capa útil, con evidencia independiente real detrás — no un sustituto completo de un antivirus dedicado.

**Gráfica 5 · "Antivirus incluido": los números detrás del bloqueo de amenazas**

| Prueba | Resultado |
|---|---|
| NordVPN — detección de malware (AV-TEST) | 83.4% |
| Resto evaluado — detección de malware (AV-TEST) | 47% |
| NordVPN — detección de phishing (AV-Comparatives) | 96% |

**¿No hay registros (logs), entonces?** Ya lo cubrimos arriba: depende enteramente del proveedor, de si fue auditado recientemente y de si esa auditoría cubrió lo que a ti te importa (no solo el marketing).

## ¿De verdad necesitas una VPN en el Starbucks o el aeropuerto?

Esta es, probablemente, la afirmación de venta más repetida en cualquier patrocinio: "nunca te conectes a wifi público sin VPN, te pueden robar todo." La realidad es más aburrida y más tranquilizadora de lo que el guion de marketing sugiere.

La Comisión Federal de Comercio de EE.UU. (FTC) actualizó su postura pública para reconocer que la adopción masiva de HTTPS —el candado que ves en la barra de direcciones— ha hecho que el wifi público sea considerablemente más seguro de lo que era hace una década, porque cifra el contenido de la conexión independientemente de si usas VPN o no [🟢](https://travlfi.com/blogs/travlsync/is-public-wi-fi-safe) (FTC, citada por TravlFi, 2025). Un análisis de MakeUseOf lo resume sin rodeos: puedes estar seguro en el wifi de la cafetería sin pagar por una VPN, siempre que verifiques que el sitio use HTTPS antes de meter datos sensibles [🟢](https://www.makeuseof.com/please-stop-paying-for-a-vpn-to-be-safe-on-coffee-shop-wi-fi/) (MakeUseOf, 2026).

Eso no significa que el riesgo sea cero. La agencia de ciberseguridad de EE.UU. (CISA) sigue recomendando usar VPN en redes que no controlas cuando esté disponible, y los llamados ataques de "gemelo malvado" —un punto de acceso falso que imita el nombre de una red legítima— siguen siendo reales y no los detiene el HTTPS por sí solo [🟡](https://www.le-vpn.com/public-wifi-dangers-2026/) (Le VPN, 2026). Mi lectura honesta, después de revisar ambos lados: si vas a hacer trámites bancarios o meter información sensible en una red pública, una VPN es una capa extra razonable; si solo vas a revisar redes sociales o leer noticias, el riesgo real hoy es mucho menor de lo que el marketing de VPN quiere hacerte creer.

## Netflix, Disney+, HBO Max: la guerra silenciosa contra las VPN

Aquí la mecánica es puramente de negocio, no de seguridad. Netflix y las demás plataformas de streaming licencian contenido por país o región: un estudio puede vender los derechos de una serie a un distribuidor distinto en cada mercado, y el contrato exige que la plataforma bloquee el acceso desde fuera de esa región [🟡](https://browvopetshop.com/netflix-vpn-ban/) (guía técnica sobre bloqueo geográfico, 2026). Cuando usas una VPN para "aparecer" en otro país, técnicamente no cometes un delito en la gran mayoría de jurisdicciones, pero sí violas los términos de servicio de la plataforma — lo cual puede resultar en advertencias o, en casos repetidos, suspensión de cuenta, dependiendo de la política de cada servicio [🟡](https://www.techtimes.com/articles/312125/20251001/how-stay-safe-public-wi-fi-2025-practical-lessons-real-world-scenarios.htm) (nota legal recogida por TechTimes, 2025).

En la práctica, algunas VPN premium siguen ganando la carrera técnica contra la detección de IP de estas plataformas —NordVPN, ExpressVPN y Surfshark documentan compatibilidad activa con Netflix, Disney+, Amazon Prime Video y HBO Max en pruebas recientes de terceros [🟡](https://www.gbnews.com/tech/best-vpns-for-streaming-netflix-hbo-max-bbc-iplayer-disney) (GB News, 2026)— mientras que las gratuitas casi nunca lo logran de forma consistente, salvo excepciones limitadas como Proton VPN Free o Windscribe en un puñado de servidores [🟡](https://www.top10vpn.com/guides/how-to-watch-hbo-max-outside-the-us/) (Top10VPN, 2026). Ten en cuenta que estas fuentes provienen mayormente de sitios de reseñas con modelo de afiliados —el mismo problema de incentivos que expliqué en la sección de propiedad corporativa— así que trátalas como una guía general, no como garantía.

¿Y te banean por usarla? En la práctica, el peor escenario habitual es un mensaje de error o una pantalla de "proxy detectado" que te obliga a cambiar de servidor — las suspensiones permanentes de cuenta por este motivo específico son, según la documentación disponible, extremadamente raras [🟡](https://ipdrop.io/en/are-vpns-legal) (ipdrop.io, 2026). Donde sí hay consecuencias legales reales de otro tipo es en un puñado de países: China, Rusia, Irán y los Emiratos Árabes Unidos restringen o prohíben el uso de VPN no autorizadas, con multas que en el caso emiratí pueden llegar a los dos millones de dirhams [🟡](https://www.le-vpn.com/vpn-legality-guide-2026/) (Le VPN, 2026). Para el resto del mundo —incluyendo México y prácticamente toda América Latina— usar una VPN es completamente legal; lo único que sigue siendo ilegal es lo que hagas con ella, VPN de por medio o no [🟢](https://nordvpn.com/blog/are-vpns-legal/) (NordVPN, citando consenso legal general, 2026).

## ¿Boletos de avión más baratos con VPN? El mito que resultó ser mito a medias

Esta es, de todas las promesas que investigué, la que tiene la evidencia más contradictoria — y por eso vale la pena explicarla con cuidado en lugar de darte un sí o un no falso.

Del lado del escepticismo: Business Insider hizo la prueba reservando vuelos con cinco VPN distintas en múltiples rutas y no encontró ni un centavo de diferencia [🟡](https://www.thetraveler.org/the-risky-side-of-using-vpn-for-flight-prices/) (Business Insider, citado por The Traveler, 2025). Un economista de Yale que estudió los algoritmos de tarificación de aerolíneas concluyó que los precios responden a demanda, disponibilidad de asientos y tiempo hasta la salida — no a cookies ni a tu dirección IP [🟡](https://devrunners.com/blog/vpn-cheaper-flights-hotels/) (investigación citada por DevRunners, 2026). Consumer Reports encontró en su propio análisis que 88% de los vuelos mostraban el mismo precio en modo incógnito que en modo normal [🟡](https://devrunners.com/blog/vpn-cheaper-flights-hotels/) (Consumer Reports, citado por DevRunners, 2026).

Del otro lado: sí existe un fenómeno real y distinto, que no tiene que ver con "rastreo" sino con discriminación de precios por punto de venta (point of sale). Algunas aerolíneas y plataformas de reservación fijan precios distintos según el país desde el que se hace la compra, por razones de poder adquisitivo local y competencia regional — y ahí una VPN sí puede, en algunas rutas específicas, mostrar una tarifa distinta [🟡](https://dollarflightclub.com/articles/vpn-for-cheaper-flights/) (Dollar Flight Club, 2025). Una prueba independiente encontró ahorros reales pero inconsistentes al comparar tarifas desde distintos países, con México y Vietnam entre los orígenes más baratos en ese experimento puntual, aunque los propios autores advierten que los resultados varían por ruta y por momento [🟡](https://www.goodreads.com/author_blog_posts/19561399-how-to-get-cheap-flights-with-vpn?tab=book) (blog de viajes, muestra puntual de diciembre, sin repetirse en el tiempo). Además, varias aerolíneas ya detectan y bloquean intentos de reserva vía VPN, y hay reportes de reservaciones canceladas por sistemas antifraude cuando detectan una discrepancia entre el país de la tarjeta y el punto de venta [🟡](https://www.thetraveler.org/the-risky-side-of-using-vpn-for-flight-prices/) (The Traveler, 2025).

Mi conclusión honesta: el mito de "Google te sube el precio porque te vio buscar el vuelo dos veces" está bastante bien desmentido. El fenómeno de precios distintos por país sí existe, pero es inconsistente, depende de la ruta, y viene con riesgo real de que te cancelen la reserva. No es la mina de oro que promete el marketing, pero tampoco es pura fantasía.

## El precio real: lo que pagas primero y lo que pagas después

Volvamos a donde empezó esta columna. El patrón de "precio de entrada bajísimo en plan de dos años, luego renovación silenciosa a precio de lista" no es exclusivo de una marca — es prácticamente el modelo estándar de la industria. NordVPN, por ejemplo, ofrece planes promocionales de $2.19 a $3.09 mensuales en compromisos de dos años, pero su tarifa mensual regular sin descuento ronda los $11.95 al mes [🟡](https://www.tomsguide.com/news/save-83-over-two-years-with-this-massive-surfshark-black-friday-vpn-deal) (TomsGuide, histórico de precios, 2026). Si dejas la renovación automática activada, pagas ese precio de lista completo, no el promocional — una diferencia de hasta cuatro veces, según documentó el propio TechRadar en su cobertura de las demandas contra NordVPN [🟢](https://www.techradar.com/vpn/vpn-services/a-us-law-firm-is-taking-nordvpn-to-court-over-deceptive-auto-renewal-pricing-heres-what-we-know) (TechRadar, 2026).

**Gráfica 6 · Precio anunciado vs. precio real de renovación (mensual)**

| Proveedor | Precio promocional (2 años) | Precio regular al renovar |
|---|---|---|
| NordVPN | $2.19 | $11.95 |
| Surfshark | $2.21 | $12.95 |
| CyberGhost | $2.19 | $12.99 |

Para el lector en México, esto importa doblemente: la mayoría de estos precios se cotizan y cobran en dólares, así que la variación del tipo de cambio se suma al golpe de la renovación. Y en la práctica, casi ningún comparador de precios en español que revisé —VPNExperto, ClavesLADA y similares— es independiente: funcionan con enlaces de afiliado que solo generan comisión si compras, el mismo conflicto de interés de fondo que ya vimos con las reseñas en inglés [🟡](https://vpnexperto.com/precio-de-nordvpn) (VPNExperto, nota de transparencia propia, 2026).

Mullvad es la excepción notable a todo este patrón: cobra una tarifa plana de 5 euros al mes, sin escalones promocionales, sin trampa de renovación, y sin siquiera pedirte un correo electrónico — te da un número de cuenta generado al azar y acepta pago en efectivo por correo postal para quien quiera anonimato máximo [🟢](https://shattered.io/mullvad-vs-protonvpn/) (Shattered.io, 2026). Es, literalmente, el modelo de precios más honesto de todo el sector que documenté.

## Entonces, ¿cuáles valen la pena?

Después de todo esto, mi resumen práctico:

Si quieres el balance entre facilidad de uso, desbloqueo de streaming y seguridad auditada, **NordVPN, ExpressVPN, Surfshark y Proton VPN** cumplen razonablemente lo que prometen en la parte técnica —pero cancela la renovación automática el día que te suscribas y ponte una alarma para decidir manualmente cada año. Si tu prioridad es el anonimato real por encima de todo lo demás y no te importa sacrificar el streaming, **Mullvad** es hoy la opción más honesta del mercado, con precio fijo y registro verdaderamente anónimo [🟢](https://ifeeltech.com/blog/mullvad-vs-nordvpn-vs-proton-vpn) (iFeelTech, comparación técnica, 2026). Si tu presupuesto es cero, **Proton VPN Free o Windscribe Free** son las únicas gratuitas que corren sobre la misma infraestructura auditada que sus versiones de paga [🟡](https://trustmyip.com/blog/free-vpn-vs-paid-vpn) (TrustMyIP, 2026) — evita cualquier otra VPN gratuita sin auditoría pública, sin excepción. Y si usas Opera esperando privacidad de verdad, entiende que su "VPN gratis" solo protege el navegador, no tu dispositivo completo.

Una nota final sobre las que definitivamente no valen la pena: cualquier VPN gratuita sin nombre reconocible, sin política de privacidad clara y sin auditoría pública verificable —el tipo que aparece en la primera página de una tienda de apps prometiendo "velocidad ilimitada gratis para siempre" sin explicar cómo pagan sus servidores— debe tratarse como sospechosa por definición. Si no te cobra dinero, alguien más está pagando por acceder a algo tuyo, y en esta industria ese "algo" casi siempre es tu tráfico, tus metadatos o tu ancho de banda.

Ninguna VPN te vuelve invisible, ninguna sustituye el sentido común en redes públicas, y ninguna te va a conseguir sistemáticamente vuelos más baratos. Pero elegida bien, sí cifra tu tráfico frente a tu proveedor de internet, sí te da control real sobre tu ubicación aparente, y sí vale su precio — el de lista, no el de la oferta de bienvenida.

## La comparación en números

Para cerrar, esto es lo que documenté en seis ejes que —según lo que encontré a lo largo de esta investigación— son los que más pesan en una decisión informada: qué tan transparente es la estructura de propiedad, si las auditorías independientes son reales y recientes, cómo se ha manejado cada proveedor cuando algo salió mal, qué tan honesto es su precio de renovación, qué tan anónimo es en verdad el registro, y qué tan bien desbloquea streaming. Elegí estos seis porque fueron, en ese orden, los puntos donde encontré la mayor distancia entre el marketing y la evidencia documentada.

| Proveedor | Transparencia de propiedad | Auditorías independientes | Manejo de incidentes | Claridad de precios | Anonimato real en el registro | Desbloqueo de streaming |
|---|---|---|---|---|---|---|
| NordVPN | 6/10 | 9/10 | 6/10 | 4/10 | 5/10 | 9/10 |
| ExpressVPN | 3/10 | 8/10 | 7/10 | 5/10 | 5/10 | 9/10 |
| Surfshark | 6/10 | 8/10 | 7/10 | 5/10 | 5/10 | 8/10 |
| Proton VPN | 9/10 | 9/10 | 8/10 | 7/10 | 6/10 | 6/10 |
| Mullvad | 9/10 | 8/10 | 8/10 | 10/10 | 10/10 | 2/10 |
| VPN gratis promedio | 2/10 | 1/10 | 2/10 | 3/10 | 3/10 | 3/10 |

*(La versión HTML de esta investigación incluye esta misma comparación como gráfica de radar interactiva y animada.)*

¿A ustedes también los sorprendió la renovación de su VPN, o ya habían aprendido esta lección antes que yo? Los leo.

---

Esteban Rey
X: [@Kilowatto](https://x.com/kilowatto) — https://x.com/kilowatto
LinkedIn: https://www.linkedin.com/in/kilowatto
Wikidata: https://www.wikidata.org/wiki/Q140672978

---

## Metodología de investigación

Para esta investigación se desplegaron 10 líneas de investigación en paralelo, organizadas por ángulo temático: una a favor de la industria de VPN (beneficios reales, auditorías, cifras de mercado), una en contra (escándalos, demandas, filtraciones), una neutral (estructura de propiedad corporativa, tamaño de mercado), una técnica (protocolos, auditorías de no-registro, fingerprinting), y sub-líneas específicas para patrocinios a creadores de YouTube, streaming y geobloqueo, mitos de viajes (vuelos, wifi público), el caso específico de Opera como navegador con "VPN" integrado, precios y renovaciones en el mercado de habla hispana, y alternativas gratuitas auditadas.

Se consultaron 67 fuentes distintas, incluyendo documentos judiciales primarios (queja de la FTC contra Hotspot Shield, registros del caso PureVPN-FBI), comunicados corporativos oficiales (NordVPN, ExpressVPN, Opera, Kape Technologies vía registros regulatorios en Londres), estudios académicos presentados en el simposio NDSS 2026, reportes de laboratorios de pruebas independientes (AV-TEST, AV-Comparatives, Top10VPN), cobertura de medios especializados en tecnología (TechRadar, TechCrunch, CyberInsider, Ars Technica-adyacentes) y sitios de comparación de precios en inglés y español.

**Variante de investigación aplicada:** se usó la variante de "investigación profunda con contraparte/réplica" en lugar de "fondo histórico + noticia reciente", porque el tema no gira en torno a un evento detonante único, sino a una industria completa cuyo marketing pedía ser confrontado punto por punto con evidencia técnica y legal — cada afirmación de venta (invisibilidad, wifi público, vuelos baratos, antivirus incluido, streaming) se trató como una hipótesis a favor que necesitaba una réplica documentada.

**Fact-check:** cada dato duro se verificó contra la fuente primaria cuando existía (documentos judiciales, comunicados corporativos, registros regulatorios) y se buscó activamente contraevidencia o desmentidos antes de asignar el marcador de confianza. Un solo dato —presuntas relaciones de Kape Technologies con servicios de inteligencia israelíes, mencionado en una sola fuente secundaria sin corroboración independiente— se investigó y se descartó explícitamente por no cumplir el estándar de verificación de esta columna.

**Justificación de las dimensiones de la gráfica de radar:** se eligieron seis ejes —transparencia de propiedad, auditorías independientes, historial de incidentes, claridad de precios, anonimato en el registro y desbloqueo de streaming— porque fueron, en ese orden, los criterios que más peso tuvieron en las decisiones documentadas de los propios usuarios y reguladores citados a lo largo de la investigación (demandas por precios, quejas por transparencia, y las auditorías como estándar de facto de la industria en 2026). En total se incorporaron siete visualizaciones directamente en el cuerpo del texto —mapa de propiedad, CPM de patrocinios, cronología de escándalos, hallazgos en VPN gratuitas, detección de amenazas, precio promocional vs. renovación, y el radar comparativo— para traducir a números concretos afirmaciones que, de otro modo, quedarían como texto narrativo difícil de verificar de un vistazo.

---

## Fuentes

1. TechRadar — [Análisis de 30,000 reseñas de Android sobre precios de VPN](https://www.techradar.com/vpn/vpn-privacy-security/they-will-renew-your-subscription-even-if-you-turn-off-the-auto-renewal-which-vpn-has-the-most-price-complaints-on-the-play-store) (2026)
2. TechRadar — [Demanda contra NordVPN por renovación automática](https://www.techradar.com/vpn/vpn-services/a-us-law-firm-is-taking-nordvpn-to-court-over-deceptive-auto-renewal-pricing-heres-what-we-know) (2026)
3. VPNpro — [Tamaño del mercado global de VPN 2026](https://vpnpro.com/blog/vpn-market-size-and-share-2026/) (2026)
4. Wikipedia / registros corporativos — [Kape Technologies](https://en.wikipedia.org/wiki/Kape_Technologies) (2026)
5. CyberInsider — [Kape Technologies y su historial como Crossrider](https://cyberinsider.com/kape-technologies-owns-expressvpn-cyberghost-pia-zenmate-vpn-review-sites/) (2024)
6. PrivacyProof — [Mapa de propiedad corporativa de VPN 2026](https://privacyproof.online/blog/who-owns-your-vpn-corporate-ownership-2026) (2026)
7. VPN Testing Research Lab — [Kape Technologies, conflicto de interés](https://vpntesting.com/ownership/kape-technologies/) (2026)
8. Jazod — [Mapa de propiedad de VPN](https://jazod.com/ownership/) (2026)
9. Latka — [Ingresos de Nord Security](https://getlatka.com/companies/nordsecurity.com) (2025)
10. Sifted — [Nord Security, bootstrap a unicornio](https://sifted.eu/articles/nord-security-bootstrap-ipo) (2024)
11. Shielded Browsing — [Reseña de Mullvad VPN](https://shieldedbrowsing.com/mullvad-review/) (2026)
12. SponsorRadar — [Tarifas de patrocinio en YouTube por nicho](https://sponsorradar.com/insights/youtube-sponsorship-rates-what-brands-should-pay) (2026)
13. SponsorRadar — [Cuánto ganan los YouTubers por patrocinios](https://sponsorradar.com/insights/how-much-do-youtubers-make-from-sponsorships) (2026)
14. Linus Tech Tips (foro) — [Tom Scott sobre patrocinios de VPN](https://linustechtips.com/topic/1118228-tom-scott-on-common-vpn-sponsorship-claims/) (2019)
15. TheTVDB — [Registro de episodio LTT sobre patrocinios VPN](https://thetvdb.com/series/linus-tech-tips/episodes/10515747) (2024)
16. VPN Vertex — [Auditorías independientes de VPN 2026](https://www.vpnvertex.com/vpn-independent-audits/) (2026)
17. ExpressVPN — [Tercera auditoría KPMG de política sin registros](https://www.expressvpn.com/blog/kpmg-2025-no-logs-policy-audit/) (2025)
18. CyberInsider — [Casos documentados de VPN que mintieron sobre registros](https://cyberinsider.com/vpn-logs-lies/) (2026)
19. NordVPN — [Comunicado oficial sobre la brecha de 2018](https://nordvpn.com/blog/official-response-datacenter-breach/) (2019)
20. IT Pro — [NordVPN confirma brecha de centro de datos](https://www.itpro.com/data-insights/34675/nordvpn-confirms-2018-data-centre-breach) (2019)
21. The Hacker News — [Estudio NDSS 2026 sobre 281 apps VPN gratuitas](https://thehackernews.com/2026/07/study-of-281-free-android-vpn-apps.html) (2026)
22. Axis Intelligence — [Auditoría de Top10VPN sobre VPN gratuitas](https://axis-intelligence.com/are-free-vpns-safe/) (2026)
23. Newsweek — [Investigación de Trend Micro sobre Hola/Luminati](https://www.newsweek.com/hola-holavpn-luminati-cybersecurity-trend-micro-virtual-private-network-1264639) (2018)
24. Cyware — [Hola VPN, fugas de IP y cifrado débil](https://social.cyware.com/news/researchers-warn-hola-vpn-users-of-weak-encryption-and-ip-address-leaks-ca9daa39) (2020)
25. CISO Mag — [Declaraciones del fundador de Hola](https://cisomag.com/free-vpn/) (2019)
26. TechCrunch — [Facebook cierra Onavo](https://techcrunch.com/2019/02/21/facebook-removes-onavo/) (2019)
27. Center for Democracy and Technology — [Queja formal ante la FTC contra Hotspot Shield](https://cdt.org/press/cdt-files-complaint-with-the-ftc-on-hotspot-shield-vpn/) (2017)
28. TrustMyIP — [VPN gratis vs. de paga](https://trustmyip.com/blog/free-vpn-vs-paid-vpn) (2026)
29. Top10VPN — [¿Es segura la VPN gratis de Opera?](https://www.top10vpn.com/guides/is-opera-vpn-safe/) (2026)
30. PrivacySavvy — [Reseña de Opera VPN](https://privacysavvy.com/reviews/vpn/opera-vpn/) (2026)
31. Cybernews — [Reseña de Opera VPN Pro](https://cybernews.com/best-vpn/opera-vpn-review/) (2024)
32. Opera — [Página oficial de Free VPN](https://www.opera.com/features/free-vpn) (2026)
33. Grokipedia — [Perfil corporativo de Opera](https://grokipedia.com/page/Opera_(company)) (2026)
34. The Register — [Opera y el reporte de Hindenburg Research](https://www.theregister.com/2020/01/21/opera_accused_predatory_loans/) (2020)
35. Hackaday — [Fingerprinting de navegador y por qué las VPN no dan anonimato](https://hackaday.com/2025/11/19/browser-fingerprinting-and-why-vpns-wont-make-you-anonymous/) (2025)
36. NordVPN — [¿Se puede rastrear con una VPN?](https://nordvpn.com/blog/can-you-be-tracked-with-a-vpn/) (2026)
37. Ghostery — [¿Te pueden rastrear si usas VPN?](https://www.ghostery.com/blog/can-you-be-tracked-if-you-use-a-vpn) (2026)
38. TechRadar — [Auditorías independientes confirman a NordVPN como bloqueador de sitios maliciosos](https://www.techradar.com/pro/vpn/two-independent-audits-confirm-nordvpn-as-top-tool-for-blocking-malicious-sites) (2025)
39. NordVPN — [Resultados de prueba anti-phishing de AV-Comparatives](https://nordvpn.com/blog/nordvpn-anti-phishing-test-results/) (2026)
40. TravlFi — [¿Es seguro el wifi público? Postura de la FTC](https://travlfi.com/blogs/travlsync/is-public-wi-fi-safe) (2025)
41. MakeUseOf — [Deja de pagar por una VPN solo para el wifi de la cafetería](https://www.makeuseof.com/please-stop-paying-for-a-vpn-to-be-safe-on-coffee-shop-wi-fi/) (2026)
42. Le VPN — [Peligros del wifi público en 2026](https://www.le-vpn.com/public-wifi-dangers-2026/) (2026)
43. Browvopetshop — [Cómo Netflix bloquea VPN](https://browvopetshop.com/netflix-vpn-ban/) (2026)
44. TechTimes — [Nota legal sobre VPN y términos de servicio](https://www.techtimes.com/articles/312125/20251001/how-stay-safe-public-wi-fi-2025-practical-lessons-real-world-scenarios.htm) (2025)
45. GB News — [Mejores VPN para streaming en 2026](https://www.gbnews.com/tech/best-vpns-for-streaming-netflix-hbo-max-bbc-iplayer-disney) (2026)
46. Top10VPN — [Cómo ver HBO Max fuera de EE.UU.](https://www.top10vpn.com/guides/how-to-watch-hbo-max-outside-the-us/) (2026)
47. The Traveler — [El lado riesgoso de usar VPN para precios de vuelos](https://www.thetraveler.org/the-risky-side-of-using-vpn-for-flight-prices/) (2025)
48. DevRunners — [¿Consigue una VPN vuelos y hoteles más baratos?](https://devrunners.com/blog/vpn-cheaper-flights-hotels/) (2026)
49. Dollar Flight Club — [Incógnito vs. VPN para vuelos baratos](https://dollarflightclub.com/articles/vpn-for-cheaper-flights/) (2025)
50. Goodreads (blog de viajes) — [Cómo conseguir vuelos baratos con VPN](https://www.goodreads.com/author_blog_posts/19561399-how-to-get-cheap-flights-with-vpn?tab=book)
51. TomsGuide — [Histórico de precios y ofertas de VPN](https://www.tomsguide.com/news/save-83-over-two-years-with-this-massive-surfshark-black-friday-vpn-deal)
52. VPNExperto — [Precio de NordVPN en México 2026](https://vpnexperto.com/precio-de-nordvpn) (2026)
53. Shattered.io — [Mullvad vs. ProtonVPN](https://shattered.io/mullvad-vs-protonvpn/) (2026)
54. iFeelTech — [Mullvad vs. NordVPN vs. Proton VPN](https://ifeeltech.com/blog/mullvad-vs-nordvpn-vs-proton-vpn) (2026)
55. RNS Kape Technologies plc — [Resultados anuales auditados FY2022](https://pdf.dfcfw.com/pdf/H22_AN202303211584441241_1.pdf) (2023)
56. TechRadar — [NordVPN, "sí cometimos un error"](https://www.techradar.com/vpn/vpn-services/yes-we-made-a-mistake-i-asked-nordvpn-everything-youve-always-wanted-to-and-their-answers-may-surprise-you)
57. CBC — [Controversia de Linus Tech Tips](https://www.cbc.ca/news/canada/british-columbia/linus-tech-tips-youtube-controversy-1.6940087)
58. Fortune — [Hola VPN vendía ancho de banda como botnet](https://fortune.com/2015/05/29/hola-luminati-vpn) (2015)
59. Digital Trends — [Hola encontrada vendiendo ancho de banda de usuarios](https://www.digitaltrends.com/computing/hola-found-to-be-selling-users-internet-bandwidth-as-botnet/) (2015)
60. SC Media — [NordVPN confirma brecha de 2018](https://www.scworld.com/news/nordvpn-confirms-2018-breach)
61. CyberGuy — [¿Se puede rastrear cuando usas VPN?](https://cyberguy.com/privacy/can-you-be-tracked-when-using-a-vpn/) (2026)
62. AllAboutCookies — [Reseña de NordVPN Threat Protection Pro](https://allaboutcookies.org/nordvpn-threat-protection-review) (2026)
63. ipdrop.io — [Legalidad de VPN por país 2026](https://ipdrop.io/en/are-vpns-legal) (2026)
64. Le VPN — [Guía de legalidad de VPN 2026](https://www.le-vpn.com/vpn-legality-guide-2026/) (2026)
65. NordVPN — [¿Son legales las VPN? Leyes y sanciones por país](https://nordvpn.com/blog/are-vpns-legal/) (2026)
66. Surfshark — [VPN barata mensual 2026 (precios ExpressVPN/CyberGhost)](https://surfshark.com/blog/cheapest-monthly-vpn) (2026)
67. VPNExperto — [Precio de CyberGhost 2026](https://vpnexperto.com/precio-cyberghost) (2026)
