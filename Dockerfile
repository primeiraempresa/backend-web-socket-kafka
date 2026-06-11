FROM node:24.1.0

RUN npm install -g pnpm@9.15.0 @nestjs/cli

USER node


WORKDIR /home/node/app