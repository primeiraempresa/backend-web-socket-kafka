import { configService } from "@config/configService";
import { Injectable } from "@nestjs/common";
import { toZonedTime } from "date-fns-tz";
@Injectable()
export class DateService {
  private readonly timeZone =
    configService.get<string>("TZ") ?? "America/Sao_Paulo";

  now(): Date {
    const utcDate = new Date();
    const zonedDate = toZonedTime(utcDate, this.timeZone);
    return zonedDate;
  }
  date(date: number | string): Date {
    const utcDate = new Date(date);
    const zonedDate = toZonedTime(utcDate, this.timeZone);
    return zonedDate;
  }
}
