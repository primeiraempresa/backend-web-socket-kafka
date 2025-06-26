import { configService } from "@config/configService";
import { Injectable } from "@nestjs/common";
import { toZonedTime } from "date-fns-tz";
@Injectable()
export class DateService {
  private readonly timeZone =
    configService.get<string>("TZ") ?? "America/Sao_Paulo";

  now() {
    const utcDate = new Date();
    const zonedDate = toZonedTime(utcDate, this.timeZone);
    return zonedDate;
  }
}
