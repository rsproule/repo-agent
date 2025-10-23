import { prisma } from "@/lib/db";
import type { Logger } from "@/lib/logger";

export type JobType = 'sync_prs' | 'bucket_prs' | 'full_pipeline';
export type JobStatus = 'running' | 'completed' | 'failed';

export interface JobProgress {
  current: number;
  total: number;
  stage: string;
}

export interface JobRunInfo {
  id: string;
  jobType: JobType;
  status: JobStatus;
  progress?: JobProgress;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class JobTracker {
  constructor(
    private owner: string,
    private repo: string,
    private jobType: JobType,
    private triggeredBy: string,
    private logger: Logger,
  ) {}

  /**
   * Start a job with idempotency - returns existing running job or creates new one
   */
  async start(metadata?: Record<string, unknown>): Promise<{ jobId: string; isNew: boolean }> {
    try {
      // Check for existing running job
      const existingJob = await prisma.jobRun.findFirst({
        where: {
          owner: this.owner,
          repo: this.repo,
          jobType: this.jobType,
          status: 'running',
        },
      });

      if (existingJob) {
        this.logger.info('Job already running', {
          jobId: existingJob.id,
          jobType: this.jobType,
          owner: this.owner,
          repo: this.repo,
        });
        return { jobId: existingJob.id, isNew: false };
      }

      // Create new job run
      const jobRun = await prisma.jobRun.create({
        data: {
          owner: this.owner,
          repo: this.repo,
          jobType: this.jobType,
          status: 'running',
          triggeredBy: this.triggeredBy,
          metadata,
        },
      });

      this.logger.info('Job started', {
        jobId: jobRun.id,
        jobType: this.jobType,
        owner: this.owner,
        repo: this.repo,
      });

      return { jobId: jobRun.id, isNew: true };
    } catch (error) {
      this.logger.error('Failed to start job', { error });
      throw error;
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: JobProgress): Promise<void> {
    try {
      await prisma.jobRun.update({
        where: { id: jobId },
        data: { progress },
      });

      this.logger.debug('Job progress updated', {
        jobId,
        progress,
      });
    } catch (error) {
      this.logger.error('Failed to update job progress', { jobId, error });
    }
  }

  /**
   * Complete job successfully
   */
  async complete(jobId: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await prisma.jobRun.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          metadata,
        },
      });

      this.logger.info('Job completed', {
        jobId,
        jobType: this.jobType,
        owner: this.owner,
        repo: this.repo,
      });
    } catch (error) {
      this.logger.error('Failed to complete job', { jobId, error });
      throw error;
    }
  }

  /**
   * Mark job as failed
   */
  async fail(jobId: string, errorMessage: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await prisma.jobRun.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage,
          metadata,
        },
      });

      this.logger.error('Job failed', {
        jobId,
        jobType: this.jobType,
        owner: this.owner,
        repo: this.repo,
        errorMessage,
      });
    } catch (error) {
      this.logger.error('Failed to mark job as failed', { jobId, error });
    }
  }

  /**
   * Get current job status for this repo/job type
   */
  static async getStatus(
    owner: string,
    repo: string,
    jobType?: JobType,
  ): Promise<JobRunInfo | null> {
    const where: { owner: string; repo: string; jobType?: JobType } = { owner, repo };
    if (jobType) {
      where.jobType = jobType;
    }

    const job = await prisma.jobRun.findFirst({
      where,
      orderBy: { startedAt: 'desc' },
    });

    if (!job) return null;

    return {
      id: job.id,
      jobType: job.jobType as JobType,
      status: job.status as JobStatus,
      progress: job.progress as JobProgress | undefined,
      startedAt: job.startedAt,
      completedAt: job.completedAt || undefined,
      errorMessage: job.errorMessage || undefined,
    };
  }

  /**
   * Check if any job is currently running for this repo
   */
  static async isRunning(
    owner: string,
    repo: string,
    jobType?: JobType,
  ): Promise<boolean> {
    const where: { owner: string; repo: string; status: string; jobType?: JobType } = { owner, repo, status: 'running' };
    if (jobType) {
      where.jobType = jobType;
    }

    const count = await prisma.jobRun.count({ where });
    return count > 0;
  }

  /**
   * Get all running jobs for this repo
   */
  static async getRunningJobs(
    owner: string,
    repo: string,
  ): Promise<JobRunInfo[]> {
    const jobs = await prisma.jobRun.findMany({
      where: { owner, repo, status: 'running' },
      orderBy: { startedAt: 'desc' },
    });

    return jobs.map(job => ({
      id: job.id,
      jobType: job.jobType as JobType,
      status: job.status as JobStatus,
      progress: job.progress as JobProgress | undefined,
      startedAt: job.startedAt,
      completedAt: job.completedAt || undefined,
      errorMessage: job.errorMessage || undefined,
    }));
  }
}