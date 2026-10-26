# Imagen base
FROM node:20

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# Los despliegues en contenedor deben usar R2 y nunca el fallback local.
ENV NODE_ENV=production

# Copiar archivos
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar todo el código
COPY . .

# El volumen local toma los permisos de este directorio al crearse.
RUN mkdir -p /app/local_uploads && chown -R node:node /app

COPY docker-entrypoint.sh /usr/local/bin/visaguide-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/visaguide-entrypoint \
    && chmod 755 /usr/local/bin/visaguide-entrypoint

# Exponer puerto
EXPOSE 3000

# El entrypoint prepara el volumen como root y ejecuta la aplicación como node.
ENTRYPOINT ["/usr/local/bin/visaguide-entrypoint"]
CMD ["node", "index.js"]

#Backend Dockerfile
