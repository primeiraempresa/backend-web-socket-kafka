import { Prop, Schema } from "@nestjs/mongoose";
import { Readable } from "stream";

@Schema()
export class Files {
  @Prop({ required: true, index: true })
  fieldname: string;
  @Prop({ required: true, index: true })
  originalname: string;
  @Prop({ required: true, index: true })
  mimetype: string;
  @Prop({ required: true, index: true })
  size: number;
  @Prop({ required: true, index: true })
  bucket: string;
  @Prop({ required: true, index: true })
  key: string;
  @Prop({ required: true, index: true })
  acl: string;
  @Prop({ required: true, index: true })
  contentType: string;
  @Prop({ required: true, index: true })
  location: string;
}
