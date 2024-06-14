FROM node:18.16.0-alpine

RUN apk add --no-cache bash
RUN npm i -g @nestjs/cli typescript ts-node

COPY package*.json /tmp/app/
RUN cd /tmp/app && npm install

COPY . /usr/src/app
RUN cp -a /tmp/app/node_modules /usr/src/app
COPY ./wait-for-it.sh /opt/wait-for-it.sh
COPY ./startup.example.sh /opt/startup.example.sh
RUN sed -i 's/\r//g' /opt/wait-for-it.sh
RUN sed -i 's/\r//g' /opt/startup.example.sh

WORKDIR /usr/src/app
RUN cp env-local-docker .env
RUN npm run build

CMD ["/opt/startup.example.sh"]
