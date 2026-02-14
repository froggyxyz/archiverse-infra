/**
 * Stage identifiers for media processing. Frontend can map these to labels.
 */
export const ARCHIVE_MEDIA_STAGES = {
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  VALIDATING: 'validating',
  COMPRESSING: 'compressing',
  TRANSCODING: 'transcoding',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type ArchiveMediaStage =
  (typeof ARCHIVE_MEDIA_STAGES)[keyof typeof ARCHIVE_MEDIA_STAGES]
