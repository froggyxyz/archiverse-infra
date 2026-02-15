export type ChatWindowMessage = {
    id?: string
    text: string
    isOwn: boolean
    senderName?: string
    createdAt?: Date | string
}
