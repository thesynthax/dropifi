FROM node:21

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=5000

RUN npm run build

EXPOSE 5000

CMD [ "node", "dist/server.js" ]
