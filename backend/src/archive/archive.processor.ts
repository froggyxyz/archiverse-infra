import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { ArchiveService } from './archive.service'
import { ArchiveProgressService } from './archive-progress.service'
import { ARCHIVE_MEDIA_STAGES } from './archive.constants'

export const ARCHIVE_QUEUE_NAME = 'archive'

export type ArchiveJobPayload = {
  mediaId: string
  userId: string
  s3Key: string
}

@Processor(ARCHIVE_QUEUE_NAME)
export class ArchiveProcessor extends WorkerHost {
  constructor(
    private readonly archive: ArchiveService,
    private readonly progress: ArchiveProgressService,
  ) {
    super()
  }

  async process(job: Job<ArchiveJobPayload>): Promise<void> {
    const { mediaId, userId } = job.data
    const emit = (stage: string, progress: number) => {
      this.progress.publish({ userId, mediaId, stage, progress })
    }
    try {
      emit(ARCHIVE_MEDIA_STAGES.VALIDATING, 0)
      await job.updateProgress({ stage: ARCHIVE_MEDIA_STAGES.VALIDATING, progress: 0 })
      await this.archive.updateMediaProgress(mediaId, {
        currentStage: ARCHIVE_MEDIA_STAGES.VALIDATING,
        stageProgress: 0,
      })
      // TODO: реальная валидация/транскодинг по типу медиа
      await new Promise((r) => setTimeout(r, 500))
      emit(ARCHIVE_MEDIA_STAGES.COMPLETED, 1)
      await job.updateProgress({ stage: ARCHIVE_MEDIA_STAGES.COMPLETED, progress: 1 })
      await this.archive.updateMediaProgress(mediaId, {
        status: 'COMPLETED',
        currentStage: ARCHIVE_MEDIA_STAGES.COMPLETED,
        stageProgress: 1,
      })
    } catch (err) {
      emit(ARCHIVE_MEDIA_STAGES.FAILED, 0)
      await this.archive.updateMediaProgress(mediaId, {
        status: 'FAILED',
        currentStage: ARCHIVE_MEDIA_STAGES.FAILED,
        stageProgress: 0,
      })
      throw err
    }
  }
}
