import React, { useState } from 'react';
import {
  Reply,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Copy,
  Check,
  CheckCheck,
  Clock,
  ShieldAlert,
  Forward,
  User as UserIcon,
  X,
  CornerDownRight,
} from 'lucide-react';
import type { ChatMessage } from '@/services/chatService';

interface TelegramMessageItemProps {
  message: ChatMessage;
  currentUserId: string | null;
  isModerator: boolean;
  onReply: (message: ChatMessage) => void;
  onJumpToMessage: (messageId: string) => void;
  onSaveEdit: (messageId: string, newText: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onTogglePin: (messageId: string, currentPinned: boolean) => Promise<void>;
  onBanUser?: (userId: string, senderName: string) => void;
}

export const TelegramMessageItem: React.FC<TelegramMessageItemProps> = ({
  message,
  currentUserId,
  isModerator,
  onReply,
  onJumpToMessage,
  onSaveEdit,
  onDelete,
  onTogglePin,
  onBanUser,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Author & RBAC Checks
  const isAuthor = Boolean(currentUserId && currentUserId === message.sender_id);
  const createdAtMs = new Date(message.created_at).getTime();
  const hoursSinceCreation = (Date.now() - createdAtMs) / (1000 * 60 * 60);
  const isWithin48h = hoursSinceCreation <= 48;

  // STRICT RBAC:
  // 1. Edit ONLY if author AND <= 48h
  const canEdit = isAuthor && isWithin48h;
  // 2. Delete if author OR moderator/admin
  const canDelete = isAuthor || isModerator;
  // 3. Pin if moderator
  const canPin = isModerator;
  // 4. Ban if moderator and not self
  const canBan = isModerator && !isAuthor;

  const senderLower = (message.sender_name || '').toLowerCase();
  const isAdminSender = Boolean(
    senderLower.includes('admin') ||
    senderLower.includes('damir') ||
    senderLower.includes('azada') ||
    senderLower.includes('берди') ||
    senderLower.includes('азада') ||
    senderLower.includes('👑')
  );

  let adminRoleBadge: string | null = null;
  if (isAdminSender) {
    if (senderLower.includes('damir') || senderLower.includes('берди')) {
      adminRoleBadge = '👑 Damir (Super Admin)';
    } else if (senderLower.includes('azada') || senderLower.includes('азада')) {
      adminRoleBadge = '👑 Azada (Super Admin)';
    } else {
      adminRoleBadge = '👑 Super Admin';
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editText.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveEdit(message.id, editText.trim());
      setIsEditing(false);
    } catch (err: any) {
      alert(err?.message || 'Ошибка редактирования сообщения');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const remainingHours = Math.max(0, Math.floor(48 - hoursSinceCreation));

  return (
    <div
      id={`chat-msg-${message.id}`}
      className={`group relative flex flex-col my-1.5 transition-all duration-300 ${
        isAuthor ? 'items-end' : 'items-start'
      }`}
    >
      {/* Pinned Marker Badge */}
      {message.is_pinned && (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full mb-1 shadow-2xs">
          <Pin className="h-3 w-3 fill-amber-500 text-amber-600" />
          <span>Закреплённое сообщение</span>
        </div>
      )}

      {/* Message Bubble Box */}
      <div
        className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-xs border transition-colors ${
          isAuthor
            ? isAdminSender
              ? 'bg-gradient-to-br from-deepblue-950 via-deepblue-900 to-amber-950/40 text-white border-amber-500/50 ring-1 ring-amber-400/20 rounded-tr-xs'
              : 'bg-deepblue-900 text-white border-deepblue-800 rounded-tr-xs'
            : isAdminSender
            ? 'bg-amber-50/90 text-slate-800 border-amber-300 ring-1 ring-amber-200/60 rounded-tl-xs shadow-sm'
            : 'bg-white text-slate-800 border-sand-200 rounded-tl-xs'
        }`}
      >
        {/* Author Header */}
        <div className="flex items-center gap-1.5 mb-1.5 text-xs flex-wrap">
          {!isAuthor && (
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                isAdminSender ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-sand-200 text-deepblue-900'
              }`}
            >
              {message.sender_avatar ? (
                <img
                  src={message.sender_avatar}
                  alt={message.sender_name || 'U'}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : isAdminSender ? (
                '👑'
              ) : (
                <UserIcon className="h-3 w-3" />
              )}
            </div>
          )}
          <span
            className={`font-semibold ${
              isAuthor
                ? isAdminSender ? 'text-amber-300 font-bold' : 'text-emerald-300'
                : isAdminSender ? 'text-amber-900 font-bold' : 'text-deepblue-600'
            }`}
          >
            {message.sender_name || 'Путешественник'}
          </span>
          {adminRoleBadge && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-2xs">
              {adminRoleBadge}
            </span>
          )}
        </div>

        {/* Forward Header */}
        {message.forward_sender_name && (
          <div
            className={`flex items-center gap-1.5 text-[11px] mb-1.5 italic ${
              isAuthor ? 'text-deepblue-200' : 'text-slate-500'
            }`}
          >
            <Forward className="h-3.5 w-3.5 shrink-0 rotate-180" />
            <span>Переслано от: </span>
            <strong className="underline decoration-dotted">{message.forward_sender_name}</strong>
          </div>
        )}

        {/* Telegram Reply Quote Box */}
        {message.reply_to && (
          <div
            onClick={() => message.reply_to_message_id && onJumpToMessage(message.reply_to_message_id)}
            className={`cursor-pointer mb-2 flex items-start gap-2 rounded-lg border-l-3 px-2.5 py-1.5 text-xs transition-opacity hover:opacity-90 ${
              isAuthor
                ? 'border-emerald-400 bg-white/10 text-white/90'
                : 'border-deepblue-600 bg-sand-100 text-slate-700'
            }`}
            title="Перейти к ответу"
          >
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 opacity-70 mt-0.5" />
            <div className="min-w-0">
              <div
                className={`font-semibold text-[11px] leading-tight ${
                  isAuthor ? 'text-emerald-300' : 'text-deepblue-700'
                }`}
              >
                {message.reply_to.sender_name || 'Собеседник'}
              </div>
              <div className="truncate text-[11px] opacity-80 mt-0.5">
                {message.reply_to.content}
              </div>
            </div>
          </div>
        )}

        {/* Message Content or Edit Input */}
        {isEditing ? (
          <form onSubmit={handleSaveEditSubmit} className="mt-1 space-y-2">
            <div className="text-[10px] text-sand-300">
              Редактирование (доступно ещё ~{remainingHours} ч.)
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className={`w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border focus:ring-1 ${
                isAuthor
                  ? 'bg-deepblue-950 text-white border-deepblue-700 focus:ring-emerald-400'
                  : 'bg-slate-50 text-slate-900 border-sand-300 focus:ring-deepblue-500'
              }`}
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditText(message.content);
                }}
                disabled={isSaving}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] bg-sand-200 text-slate-700 hover:bg-sand-300 transition-colors"
              >
                <X className="h-3 w-3" /> Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving || !editText.trim()}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium shadow-xs"
              >
                {isSaving ? (
                  <Clock className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Сохранить
              </button>
            </div>
          </form>
        ) : (
          <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
            {message.content}
          </div>
        )}

        {/* Footer: edited label + timestamp + status checks */}
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] ${
            isAuthor ? 'text-deepblue-200' : 'text-slate-400'
          }`}
        >
          {message.is_edited && <span className="italic">изменено</span>}
          <span>{formatTime(message.created_at)}</span>

          {isAuthor && (
            <span className="inline-flex items-center">
              {message.status === 'sending' && (
                <Clock className="h-3 w-3 animate-pulse opacity-70" />
              )}
              {message.status === 'sent' && (
                <Check className="h-3 w-3 text-deepblue-200" />
              )}
              {message.status === 'read' && (
                <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Floating Action Buttons / Telegram Context Toolbar */}
      <div
        className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 px-1 text-slate-500`}
      >
        {/* Reply */}
        <button
          onClick={() => onReply(message)}
          className="p-1 hover:text-deepblue-700 hover:bg-sand-200 rounded-md transition-colors"
          title="Ответить"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          className="p-1 hover:text-deepblue-700 hover:bg-sand-200 rounded-md transition-colors"
          title={copied ? 'Скопировано!' : 'Копировать'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Edit - ONLY author within 48h */}
        {canEdit && !isEditing && (
          <button
            onClick={() => {
              setIsEditing(true);
              setEditText(message.content);
            }}
            className="p-1 hover:text-deepblue-700 hover:bg-sand-200 rounded-md transition-colors"
            title="Редактировать (до 48ч)"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Pin / Unpin - Moderators only */}
        {canPin && (
          <button
            onClick={() => onTogglePin(message.id, message.is_pinned)}
            className="p-1 hover:text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
            title={message.is_pinned ? 'Открепить' : 'Закрепить'}
          >
            {message.is_pinned ? (
              <PinOff className="h-3.5 w-3.5 text-amber-600" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Delete - Author or Moderator */}
        {canDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className="p-1 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Удалить сообщение"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        )}

        {/* Ban - Moderator only for non-authors */}
        {canBan && onBanUser && (
          <button
            onClick={() => onBanUser(message.sender_id, message.sender_name || 'Пользователь')}
            className="p-1 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
            title="Заблокировать пользователя"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
          </button>
        )}
      </div>
    </div>
  );
};
