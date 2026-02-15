export const ARCHIVE_STAGES = {
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  VALIDATING: 'validating',
  COMPRESSING: 'compressing',
  TRANSCODING: 'transcoding',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type ArchiveMediaStage = (typeof ARCHIVE_STAGES)[keyof typeof ARCHIVE_STAGES]

export const ARCHIVE_STAGE_LABELS: Record<ArchiveMediaStage, string> = {
  [ARCHIVE_STAGES.UPLOADING]: 'Загрузка',
  [ARCHIVE_STAGES.UPLOADED]: 'Загружено',
  [ARCHIVE_STAGES.VALIDATING]: 'Проверка',
  [ARCHIVE_STAGES.COMPRESSING]: 'Сжатие',
  [ARCHIVE_STAGES.TRANSCODING]: 'Конвертация',
  [ARCHIVE_STAGES.COMPLETED]: 'Готово',
  [ARCHIVE_STAGES.FAILED]: 'Ошибка',
}

export type MediaListItem = {
  id: string
  filename: string
  size: number | null
  mimeType: string
  type: 'IMAGE' | 'AUDIO' | 'VIDEO'
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED'
  currentStage: string | null
  stageProgress: number | null
  createdAt: string
  /** Presigned URL для просмотра (если файл в S3). Истекает через ~1 ч. */
  viewUrl?: string | null
  /** Presigned URL превью-кадра для видео. Истекает через ~1 ч. */
  thumbnailUrl?: string | null
}

export type MediaListResult = {
  items: MediaListItem[]
  total: number
  page: number
  limit: number
}

export type StorageInfo = {
  usedBytes: number
  limitBytes: number
}

export type CheckQuotaResult = {
  allowed: boolean
  remainingBytes: number
}

export type ArchiveProgressPayload = {
  mediaId: string
  stage: string
  progress: number
}
