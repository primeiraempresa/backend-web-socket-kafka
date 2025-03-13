FROM node:20.18

RUN npm install -g pnpm
RUN npm install -g @nestjs/cli
USER node 
WORKDIR /home/node/app