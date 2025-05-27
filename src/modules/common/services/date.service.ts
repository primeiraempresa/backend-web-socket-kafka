import { configService } from "@config/configService";
import { Injectable } from "@nestjs/common";
import { toZonedTime, format } from "date-fns-tz";
@Injectable()
export class DateService {
  private readonly timeZone =
    configService.get<string>("TZ") || "America/Sao_Paulo";

  now() {
    const utcDate = new Date();

    // Converte a data UTC para o fuso horário de São Paulo
    const zonedDate = toZonedTime(utcDate, this.timeZone);

    // Formata a data como ISO, mas com o fuso horário de São Paulo
    const isoStringWithTimeZone = format(
      zonedDate,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
      { timeZone: this.timeZone },
    );
    return isoStringWithTimeZone;
  }
}
