FROM node:22-alpine

WORKDIR /application

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000
CMD ["node", "src/server.js"]
