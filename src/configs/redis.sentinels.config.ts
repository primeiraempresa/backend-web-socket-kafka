import { configService } from "./config.service";

export const redisSentinelsConfig = {
  name: configService.get<string>("DBAAS_SENTINEL_SERVICE_NAME"),
  sentinels: (configService.get<string>("DBAAS_SENTINEL_HOSTS") as string)
    .split(",")
    .map((host) => ({
      host,
      port: configService.get<number>("DBAAS_SENTINEL_PORT"),
    })),
  password: configService.get<string>("DBAAS_SENTINEL_PASSWORD"),
};
