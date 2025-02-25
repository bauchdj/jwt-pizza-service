FROM node:slim 
WORKDIR /usr/src/app
COPY . .
RUN npm ci
EXPOSE 80
CMD ["node", "index.js", "80"]