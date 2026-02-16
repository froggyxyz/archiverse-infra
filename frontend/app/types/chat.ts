export type ChatWindowMessage = {
    id?: string
    text: string
    isOwn: boolean
    senderName?: string
    createdAt?: Date | string
}

export type ChatListItem = {
    id: string
    otherUser: { id: string; username: string; avatarUrl: string | null }
    lastMessageAt: string
    lastMessage: {
        text: string | null
        attachmentPreview: { type: string; url: string } | null
    } | null
    unreadCount: number
}

export type MessageWithAttachments = {
    id: string
    chatId: string
    senderId: string
    text: string | null
    createdAt: string
    attachments: Array<{
        id: string
        type: string
        url: string
        thumbnailUrl: string | null
    }>
}

export type ChatMessagesResult = {
    messages: MessageWithAttachments[]
    nextCursor: string | null
}
