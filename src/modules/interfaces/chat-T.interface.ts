export interface Chat_T {
  chatId: string;
  messageId: string;
}
export interface Chat_T_WS extends Chat_T {
  userId: string;
}
