import PgBoss from 'pg-boss';
import { env } from '../../config/env.js';

export const RENDER_QUEUE = 'render-video';

let bossSingleton: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (bossSingleton) return bossSingleton;
  const boss = new PgBoss(env.DATABASE_URL);
  boss.on('error', (err) => console.error('[pg-boss] error:', err));
  await boss.start();
  // pg-boss v10: 큐를 사용 전에 명시적으로 등록해야 함 (idempotent)
  await boss.createQueue(RENDER_QUEUE);
  bossSingleton = boss;
  return boss;
}

export type RenderJobPayload = {
  videoId: string;
  /** RenderJob 행의 id — API 호출 시점에 미리 생성되어 전달됨 */
  renderJobId: string;
};

export async function enqueueRender(payload: RenderJobPayload): Promise<string> {
  const boss = await getBoss();
  const id = await boss.send(RENDER_QUEUE, payload, {
    retryLimit: 1,
    retryDelay: 30,
    expireInHours: 2,
  });
  if (!id) throw new Error('pg-boss failed to enqueue');
  return id;
}
