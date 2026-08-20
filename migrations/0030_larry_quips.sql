ALTER TABLE books ADD COLUMN larry_quip TEXT;

UPDATE books SET larry_quip = 'Larry jura que leyó este mismo libro flotando sobre el Zócalo en 1521, a bordo de una carabela que de casualidad también tenía wifi. Dice que le pareció "un poco parcial hacia España", pero que la vista desde ahí arriba era espectacular.'
WHERE title = 'Los Tiempos Malditos';

UPDATE books SET larry_quip = 'Larry lo leyó completo durante una escala de dos minutos en un viaje a velocidad superior a la de la luz — según él, en ese punto el tiempo ya no corre igual y "dos minutos" son en realidad varias tardes muy productivas. No pregunten cómo consiguió el boleto.'
WHERE title = 'Supremacía Cuántica';

UPDATE books SET larry_quip = 'Larry dice que conoció a Bill Gates en una junta de dos personas: Bill y él. Larry llevaba una laptop de 1975 "para no hacerlo sentir mal". Terminaron hablando de BASIC durante tres horas.'
WHERE title = 'Código Fuente: Mis Inicios';

UPDATE books SET larry_quip = 'Larry insiste en que probó el metaverso completo antes de que saliera el libro, escaneando el código QR de la portada con un celular que todavía no existía. Dice que "el wifi del metaverso es peor que el de un antro".'
WHERE title = 'Metaverse Dream';

UPDATE books SET larry_quip = 'Larry lo leyó en una noche, sentado junto a un fuego imaginario en Long Lake, con un chaleco que definitivamente no combina con nada de lo que normalmente usa. Dice que la fábula lo hizo llorar, pero que lo niega si alguien le pregunta directamente.'
WHERE title = 'La vida de Chuck';
