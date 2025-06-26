import { Module } from "@nestjs/common";
import { CommonService } from "./services/common.service";
import { WebSocketService } from "./services/webSocket.service";
import { CacheService } from "./services/cache.service";

@Module({
  providers: [CommonService, WebSocketService, CacheService],
  exports: [CommonService, WebSocketService, CacheService],
})
export class CommonModule {}
