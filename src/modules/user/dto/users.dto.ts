import { Prop } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";
import { Sports } from "@user/models/sports.model";
import { Users } from "@user/models/user.model";
import { IsEmail, IsObject, IsString } from "class-validator";
import { ObjectId } from "mongoose";
export class UsersDto  {
  _id: ObjectId | string;
    @ApiProperty({ required: true})
    @Prop({ required: true })
    @IsString()
    username: string;
  
    @ApiProperty({ required: true })
    @Prop({ required: true })
    @IsEmail({ allow_display_name: true }, { message: "Invalid email" })
    @IsString()
    email: string;
  
    @ApiProperty({ required: true })
    @IsObject()
    esportes: Partial<Sports>;
  
    @ApiProperty({ default: null })
    @Prop({ required: false, default: null })
    //   @Prop({ type: mongoose.Schema.Types.ObjectId, ref: imagem.name, default: null, required: true })
    profilePic: string;

  __v: number;
}
