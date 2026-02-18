export type RoomPlaylistItem = {
  id: string
  mediaId: string
  title: string
  duration: string
  thumbnailUrl?: string | null
}

export type RoomInfo = {
  id: string
  inviteCode: string
  inviteLink: string
  createdById: string
  createdAt: string
}

export type RoomPlaylistItemInfo = {
  id: string
  mediaId: string
  order: number
  addedById: string
  addedByUsername: string
  filename: string
  mimeType: string
  type: string
  viewUrl: string | null
  thumbnailUrl: string | null
  createdAt: string
}

export type RoomParticipantInfo = {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  joinedAt: string
}

export type RoomChatMessageInfo = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: string
}
