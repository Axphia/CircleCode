export function confirmFrame(previous, result) {
  if (!result.ok) return { key: '', count: 0, confirmed: false };
  const key = `${result.format}/${result.mode}/${[...result.bytes].join(',')}`;
  const count = previous.key === key ? previous.count + 1 : 1;
  return { key, count, confirmed: count >= 2 };
}

export class ScannerClient {
  constructor(WorkerClass = globalThis.Worker) {
    this.WorkerClass = WorkerClass;
    this.worker = null;
    this.pending = null;
    this.sequence = 0;
    this.engine = null;
  }
  stop(reason = 'Scan cancelled') {
    this.worker?.terminate();
    this.worker = null;
    this.engine = null;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error(reason));
      this.pending = null;
    }
  }
  scan(image, rings, engine) {
    if (this.pending) return Promise.reject(new Error('Previous scan still in progress'));
    if (this.worker && this.engine !== engine) this.stop();
    return new Promise((resolve, reject) => {
      try {
        if (!this.worker) {
          this.worker = new this.WorkerClass(new URL('./scanner-worker.js', import.meta.url), { type: 'module' });
          this.engine = engine;
          const active = this.worker;
          this.worker.onerror = this.worker.onmessageerror = () => { if (this.worker === active) this.stop('Image scanner worker failed to start. Try selecting JavaScript.'); };
          this.worker.onmessage = ({ data }) => {
            if (this.worker !== active || !this.pending || data.id !== this.pending.id) return;
            const current = this.pending;
            clearTimeout(current.timer);
            this.pending = null;
            if (data.error) current.reject(new Error(data.error));
            else current.resolve(data);
          };
        }
        const id = ++this.sequence;
        this.pending = { id, resolve, reject, timer: setTimeout(() => this.stop('Scanning timed out. Try reducing image size or aligning the code.'), 10000) };
        this.worker.postMessage({ id, image, rings, engine }, [image.data.buffer]);
      } catch (error) {
        this.stop(error.message);
        reject(error);
      }
    });
  }
}
