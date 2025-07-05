import { Module } from "@nestjs/common";
import { CommonService } from "./services/common.service";
import { WebSocketService } from "./services/webSocket.service";
import { CacheService } from "./services/cache.service";
import { DateService } from "./services/date.service";

@Module({
  providers: [CommonService, WebSocketService, CacheService, DateService],
  exports: [CommonService, WebSocketService, CacheService, DateService],
})
export class CommonModule {}
