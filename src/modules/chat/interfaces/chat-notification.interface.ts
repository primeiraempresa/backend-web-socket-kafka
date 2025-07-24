import { ChatConversation } from "@chat/models/chat_conversation.model";
import { Chats } from "@chat/models/chat.model";

// Interface para eventos de notificação de mensagens
export interface MessageNotificationEvent {
  type:
    | "new_message"
    | "message_read"
    | "message_delivered"
    | "message_edited"
    | "message_deleted";
  chatId: string;
  messageId?: string;
  senderId: string;
  recipientIds: string[];
  message?: ChatConversation;
  timestamp: Date;
  metadata?: any;
}

// Interface para eventos de status do chat
export interface ChatStatusEvent {
  type:
    | "chat_created"
    | "chat_updated"
    | "chat_deleted"
    | "user_joined"
    | "user_left"
    | "chat_archived"
    | "chat_muted";
  chatId: string;
  userId: string;
  affectedUserIds: string[];
  chat?: Chats;
  timestamp: Date;
  metadata?: any;
}

// Interface para status de usuário online
export interface UserStatusEvent {
  type: "user_online" | "user_offline" | "user_typing" | "user_stopped_typing";
  userId: string;
  chatId?: string;
  timestamp: Date;
  metadata?: any;
}

// Interface para contadores de mensagens não lidas
export interface UnreadCountUpdate {
  chatId: string;
  userId: string;
  unreadCount: number;
  lastMessageId?: string;
  timestamp: Date;
}

// Interface para marcação de mensagens como lidas
export interface MessageReadUpdate {
  chatId: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

// Interface para entrega de mensagens
export interface MessageDeliveryUpdate {
  chatId: string;
  messageId: string;
  userId: string;
  deliveredAt: Date;
}

// Interface para eventos de digitação
export interface TypingEvent {
  chatId: string;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

// Interface para presença de usuário
export interface UserPresence {
  userId: string;
  status: "online" | "offline" | "away" | "busy";
  lastSeen?: Date;
  currentChatId?: string;
}

// Interface para notificações push
export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data: {
    chatId: string;
    messageId?: string;
    type: string;
  };
  badge?: number;
}

// Interface para configurações de notificação do usuário
export interface NotificationSettings {
  userId: string;
  globalNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  chatSpecificSettings: Map<
    string,
    {
      enabled: boolean;
      muted: boolean;
      muteUntil?: Date;
    }
  >;
}
