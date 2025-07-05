import { S3Client } from "@aws-sdk/client-s3";
import { configService } from "./config.service";
const isLocal: boolean = configService.get<string>("ENV_AMB") === "LOCAL";
export const s3 = new S3Client({
  region: configService.get<string>("REGIONAWS") as string,
  credentials: {
    accessKeyId: configService.get<string>("AWS_ACCESS_KEY_ID") as string,
    secretAccessKey: configService.get<string>(
      "AWS_SECRET_ACCESS_KEY",
    ) as string,
  },
  ...(!isLocal
    ? {}
    : {
        endpoint: configService.get<string>("AWS_ENDPOINT") as string,
        forcePathStyle: true,
      }),
});
