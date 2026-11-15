export interface ResumeJob {
  id: string;
  user_id: string;
  priority_score: number;
  created_at: string | number | Date;
  status: string;
  resume_storage_path: string | null;
  job_description: string;
  attempts?: number;
  next_retry_at?: string | null;
  composite_hash?: string | null;
}

export type JobComparator<T> = (a: T, b: T) => number;

const toEpoch = (v: ResumeJob["created_at"]): number => {
  const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

/** Lower priority_score first; ties broken FIFO by created_at. */
export const compareResumeJobs: JobComparator<ResumeJob> = (a, b) =>
  a.priority_score - b.priority_score || toEpoch(a.created_at) - toEpoch(b.created_at);

export class MinHeap<T extends ResumeJob = ResumeJob> {
  private readonly heap: T[];
  private readonly compare: JobComparator<T>;

  constructor(items: readonly T[] = [], compare: JobComparator<T> = compareResumeJobs) {
    this.compare = compare;
    this.heap = [...items];
    this.heapify();
  }

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  insert(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  extractMin(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop() as T;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return min;
  }

  /** O(n) bottom-up heap construction. */
  private heapify(): void {
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) this.siftDown(i);
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) >= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    const n = this.heap.length;
    let i = index;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && this.compare(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.compare(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
  }
}

export { MinHeap as MinHeapQueue };
