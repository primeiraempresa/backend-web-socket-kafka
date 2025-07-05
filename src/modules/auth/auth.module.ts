import { Module } from "@nestjs/common";
import { AuthService } from "./services/auth.service";
import { AuthController } from "./controllers/auth.controller";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { DateService } from "@common/services/date.service";
@Module({
  providers: [AuthService, JwtStrategy, DateService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
