import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name?: string | null;
  sender_avatar?: string | null;
  content: string;
  reply_to_message_id?: string | null;
  reply_to?: {
    id: string;
    sender_name?: string | null;
    content: string;
  } | null;
  forward_from_chat_id?: string | null;
  forward_from_user_id?: string | null;
  forward_sender_name?: string | null;
  is_pinned: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
  status: 'sending' | 'sent' | 'read';
  is_edited: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface SendMessageParams {
  chatId: string;
  content: string;
  senderName?: string;
  senderAvatar?: string;
  replyToMessageId?: string | null;
  forwardMeta?: {
    fromChatId?: string;
    fromUserId?: string;
    senderName?: string;
  } | null;
}

export class ChatService {
  /**
   * Загрузка сообщений чата с историей ответов (Reply)
   */
  static async loadMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, reply_to:reply_to_message_id(id, sender_name, content)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[ChatService] Error loading messages:', error);
      return [];
    }

    return (data || []) as ChatMessage[];
  }

  /**
   * Отправка сообщения
   */
  static async sendMessage({
    chatId,
    content,
    senderName,
    senderAvatar,
    replyToMessageId,
    forwardMeta,
  }: SendMessageParams): Promise<ChatMessage> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('401: Необходимо войти в систему для отправки сообщений.');

    const cleanContent = content.trim();
    if (!cleanContent) throw new Error('400: Сообщение не может быть пустым.');

    const payload: any = {
      chat_id: chatId,
      sender_id: user.id,
      sender_name: senderName || user.email?.split('@')[0] || 'Турист',
      sender_avatar: senderAvatar || null,
      content: cleanContent,
      reply_to_message_id: replyToMessageId || null,
      status: 'sent',
    };

    if (forwardMeta) {
      payload.forward_from_chat_id = forwardMeta.fromChatId || null;
      payload.forward_from_user_id = forwardMeta.fromUserId || null;
      payload.forward_sender_name = forwardMeta.senderName || null;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([payload])
      .select('*, reply_to:reply_to_message_id(id, sender_name, content)')
      .single();

    if (error) throw error;

    // Broadcast WebSocket event
    try {
      supabase.channel(`chat_${chatId}`).send({
        type: 'broadcast',
        event: 'message:new',
        payload: data,
      });
    } catch {
      // ignore
    }

    return data as ChatMessage;
  }

  /**
   * Редактирование: строго автор + проверка 48 часов
   * Админам и другим пользователям возвращается 403 Forbidden!
   */
  static async editMessage(messageId: string, newContent: string, currentUserId: string): Promise<ChatMessage> {
    const cleanContent = newContent.trim();
    if (!cleanContent) throw new Error('400: Сообщение не может быть пустым.');

    // 1. Проверяем оригинальное сообщение
    const { data: original, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('sender_id, created_at, chat_id')
      .eq('id', messageId)
      .single();

    if (fetchErr || !original) throw new Error('404: Сообщение не найдено.');

    // 2. Строгое правило авторства: админы НЕ могут менять чужой текст
    if (original.sender_id !== currentUserId) {
      throw new Error('403 Forbidden: Вы можете редактировать только собственные сообщения.');
    }

    // 3. Временной лимит 48 часов
    const createdAt = new Date(original.created_at).getTime();
    const hoursElapsed = (Date.now() - createdAt) / (1000 * 60 * 60);
    if (hoursElapsed > 48) {
      throw new Error('403 Forbidden: Редактирование разрешено только в течение 48 часов с момента отправки.');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        content: cleanContent,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('sender_id', currentUserId)
      .select('*, reply_to:reply_to_message_id(id, sender_name, content)')
      .single();

    if (error) throw error;

    // Broadcast WebSocket event
    try {
      supabase.channel(`chat_${original.chat_id}`).send({
        type: 'broadcast',
        event: 'message:edit',
        payload: data,
      });
    } catch {
      // ignore
    }

    return data as ChatMessage;
  }

  /**
   * Удаление: автор или администратор/модератор
   */
  static async deleteMessage(
    messageId: string,
    chatId: string,
    currentUserId: string,
    isModerator: boolean
  ): Promise<void> {
    const { data: original } = await supabase
      .from('chat_messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!original) throw new Error('404: Сообщение не найдено.');

    if (original.sender_id !== currentUserId && !isModerator) {
      throw new Error('403 Forbidden: У вас нет прав на удаление этого сообщения.');
    }

    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
    if (error) throw error;

    // Broadcast WebSocket event
    try {
      supabase.channel(`chat_${chatId}`).send({
        type: 'broadcast',
        event: 'message:delete',
        payload: { id: messageId, chat_id: chatId },
      });
    } catch {
      // ignore
    }
  }

  /**
   * Закрепление сообщения: доступно модераторам или автору
   */
  static async togglePin(
    messageId: string,
    chatId: string,
    isPinned: boolean,
    isModerator: boolean
  ): Promise<ChatMessage> {
    if (!isModerator) {
      throw new Error('403 Forbidden: Закреплять сообщения в группе могут только модераторы.');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        is_pinned: isPinned,
        pinned_at: isPinned ? new Date().toISOString() : null,
      })
      .eq('id', messageId)
      .select('*, reply_to:reply_to_message_id(id, sender_name, content)')
      .single();

    if (error) throw error;

    // Broadcast WebSocket event
    try {
      supabase.channel(`chat_${chatId}`).send({
        type: 'broadcast',
        event: 'message:pin',
        payload: { id: messageId, chat_id: chatId, is_pinned: isPinned, message: data },
      });
    } catch {
      // ignore
    }

    return data as ChatMessage;
  }

  /**
   * Блокировка нарушителя модератором
   */
  static async banUser(userId: string, reason: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('chat_banned_users').upsert({
      user_id: userId,
      reason,
      banned_by: user?.id || null,
      banned_at: new Date().toISOString(),
    });

    if (error) throw error;
  }

  /**
   * Проверка прав администратора / модератора текущего пользователя
   */
  static async isCurrentUserModerator(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Подписка на реалтайм-события через Supabase Realtime WebSockets
   */
  static subscribeToChat(
    chatId: string,
    callbacks: {
      onNewMessage: (msg: ChatMessage) => void;
      onEditMessage: (msg: ChatMessage) => void;
      onDeleteMessage: (msgId: string) => void;
      onPinMessage: (msgId: string, isPinned: boolean, message?: ChatMessage) => void;
    }
  ) {
    const channelName = `chat_${chatId}`;
    const channel = supabase.channel(channelName);

    // 1. Слушаем broadcast события
    channel
      .on('broadcast', { event: 'message:new' }, ({ payload }) => {
        if (payload?.chat_id === chatId) callbacks.onNewMessage(payload);
      })
      .on('broadcast', { event: 'message:edit' }, ({ payload }) => {
        if (payload?.chat_id === chatId) callbacks.onEditMessage(payload);
      })
      .on('broadcast', { event: 'message:delete' }, ({ payload }) => {
        if (payload?.chat_id === chatId) callbacks.onDeleteMessage(payload.id);
      })
      .on('broadcast', { event: 'message:pin' }, ({ payload }) => {
        if (payload?.chat_id === chatId) callbacks.onPinMessage(payload.id, payload.is_pinned, payload.message);
      });

    // 2. Слушаем прямые изменения из PostgreSQL (postgres_changes)
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        (change) => {
          callbacks.onNewMessage(change.new as ChatMessage);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        (change) => {
          const updated = change.new as ChatMessage;
          if (updated.is_pinned) {
            callbacks.onPinMessage(updated.id, true, updated);
          } else {
            callbacks.onEditMessage(updated);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (change) => {
          if (change.old?.id) callbacks.onDeleteMessage(change.old.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
