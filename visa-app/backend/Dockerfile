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

# Exponer puerto
EXPOSE 3000

# Comando para correr la app
CMD ["node", "index.js"]

#Backend Dockerfile
