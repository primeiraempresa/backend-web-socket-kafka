FROM node:24.14

RUN npm install -g pnpm
RUN npm install -g @nestjs/cli
USER root 
WORKDIR /home/node/app