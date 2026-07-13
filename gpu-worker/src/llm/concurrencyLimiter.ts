// 게이트웨이의 QWEN_MAX_CONCURRENCY(서버측 asyncio.Semaphore)와 클라이언트측을 맞추기 위한 제한기.
// 없으면 gpu-worker가 여러 에셋 잡을 동시에 처리할 때 게이트웨이 허용치를 넘겨 429(GATEWAY_BUSY)만
// 계속 받게 됨 — 애초에 게이트웨이가 받을 수 있는 만큼만 동시에 쏘도록 여기서 줄을 세운다.
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (max < 1) throw new Error("ConcurrencyLimiter: max must be >= 1");
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}
