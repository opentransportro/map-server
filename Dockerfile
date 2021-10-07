FROM node:alpine

ENV OTP_URL https://api.opentransport.ro/routing/v1/routers/romania/index/graphql
ENV WORK=/opt/map-server
ENV NODE_OPTS ""

RUN mkdir -p ${WORK}
WORKDIR ${WORK}

COPY yarn.lock package.json ${WORK}/
RUN yarn install && yarn cache clean

COPY . ${WORK}

RUN yarn build

CMD ["yarn", "start"]
EXPOSE 8080