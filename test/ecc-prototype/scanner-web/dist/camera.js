export class Camera {
  constructor(devices = globalThis.navigator?.mediaDevices) {
    this.devices = devices;
    this.generation = 0;
    this.stream = null;
    this.video = null;
  }
  async start(video, facing = 'environment') {
    this.stop();
    const generation = this.generation;
    if (!this.devices?.getUserMedia) throw new Error('Camera access unavailable. HTTPS and a supported browser are required.');
    let stream;
    try {
      stream = await this.devices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
    } catch (error) {
      if (generation !== this.generation) return false;
      throw error;
    }
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false; }
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    try {
      await video.play();
      return generation === this.generation;
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }
  stop() {
    this.generation++;
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.video) { this.video.pause(); this.video.srcObject = null; }
    this.stream = this.video = null;
  }
}
