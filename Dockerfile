FROM node:18.16.0-alpine

RUN apk add --no-cache bash
RUN npm i -g @nestjs/cli typescript ts-node

COPY package*.json /tmp/app/
RUN cd /tmp/app && npm install

COPY . /usr/src/app
RUN cp -a /tmp/app/node_modules /usr/src/app
COPY ./wait-for-it.sh /opt/wait-for-it.sh
COPY ./startup.deploy.sh /opt/startup.deploy.sh
RUN sed -i 's/\r//g' /opt/wait-for-it.sh
RUN sed -i 's/\r//g' /opt/startup.deploy.sh

WORKDIR /usr/src/app
RUN cp env-deploy .env
RUN npm run build

CMD ["/opt/startup.deploy.sh"]
