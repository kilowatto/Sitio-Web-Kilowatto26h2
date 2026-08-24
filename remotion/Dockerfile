FROM node:24-bookworm-slim

# Chrome's runtime libraries. Remotion ships its own headless shell but not the system libs it
# links against, and a missing one fails at render time with a bare exit code rather than a
# message that says which.
RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 \
  libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
  libpango-1.0-0 libcairo2 libcups2 ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# El orden importa. `COPY src` iba antes de estas dos capas, así que cualquier cambio en la
# composición -- lo que más va a cambiar -- invalidaba también la instalación de dependencias y
# la descarga de Chrome: ocho minutos emulados en vez de uno. Las capas caras primero y lo que
# cambia seguido al final.
COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Chrome horneado en la imagen, no bajado al primer render: si no, ese costo lo paga el primer
# clip de cada arranque en frío.
RUN npx remotion browser ensure

COPY remotion.config.ts ./
COPY src ./src
# public/ trae las fuentes de la marca, y `remotion bundle` las mete en el bundle desde aquí.
# Sin esta línea la imagen se construye sin quejarse y el render muere al arrancar con
# "NetworkError ... at loadFont" -- que es el comportamiento correcto: mejor que falle a que
# publique un clip con la tipografía sustituida.
COPY public ./public

# El bundle también horneado: construirlo por render haría que cada clip espere a webpack.
RUN npx remotion bundle --out-dir=build

CMD ["node", "src/server.ts"]
