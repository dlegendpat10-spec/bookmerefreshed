import { Queue, Worker } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

// Queue fallback / stub if Redis connection is not configured locally
export const notificationQueue = {
  add: async (name: string, data: any) => {
    console.log(`[Queue Mock] Job queued: "${name}"`, data);
    return { id: 'mock-job-id' };
  }
};
