import { Module } from "@nestjs/common";
import { CommonService } from "./services/common.service";
import { WebSocketService } from "./services/webSocket.service";

@Module({
  providers: [CommonService, WebSocketService],
  exports: [CommonService, WebSocketService],
})
export class CommonModule {}
