class RingBuffer {
  static HEADER_SIZE = 2 * Int32Array.BYTES_PER_ELEMENT;

  static create(frameCapacity, channelCount) {
    const sab = new SharedArrayBuffer(
      RingBuffer.HEADER_SIZE +
        frameCapacity * channelCount * Float32Array.BYTES_PER_ELEMENT
    );

    const ringbuffer = new RingBuffer(sab, frameCapacity, channelCount);
    Atomics.store(ringbuffer._ptrs, 0, 0);
    Atomics.store(ringbuffer._ptrs, 1, 0);
    return ringbuffer;
  }

  static attach(sab, frameCapacity, channelCount) {
    return new RingBuffer(sab, frameCapacity, channelCount);
  }

  constructor(sab, frameCapacity, channelCount) {
    this.sab = sab;
    this.frameCapacity = frameCapacity;
    this.channelCount = channelCount;
    this._ptrs = new Int32Array(sab, 0, 2);
    this._buffer = new Float32Array(
      sab,
      RingBuffer.HEADER_SIZE,
      frameCapacity * channelCount
    );
  }

  get readIndex() {
    return Atomics.load(this._ptrs, 0);
  }

  set readIndex(value) {
    Atomics.store(this._ptrs, 0, value);
  }

  get writeIndex() {
    return Atomics.load(this._ptrs, 1);
  }

  set writeIndex(value) {
    Atomics.store(this._ptrs, 1, value);
  }

  availableRead() {
    return (
      (this.writeIndex - this.readIndex + this.frameCapacity) %
      this.frameCapacity
    );
  }

  availableWrite() {
    return this.frameCapacity - this.availableRead() - 1;
  }

  write(frames) {
    const numFrames = Math.floor(frames.length / this.channelCount);
    let w = this.writeIndex;
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < this.channelCount; ch++) {
        this._buffer[(w * this.channelCount + ch) % this._buffer.length] =
          frames[i * this.channelCount + ch];
      }
      w = (w + 1) % this.frameCapacity;
    }
    this.writeIndex = w;
  }

  read(numFrames) {
    const available = this.availableRead();
    const toRead = Math.min(numFrames, available);
    const out = new Float32Array(toRead * this.channelCount);
    let r = this.readIndex;
    for (let i = 0; i < toRead; i++) {
      for (let ch = 0; ch < this.channelCount; ch++) {
        out[i * this.channelCount + ch] =
          this._buffer[(r * this.channelCount + ch) % this._buffer.length];
      }
      r = (r + 1) % this.frameCapacity;
    }
    this.readIndex = r;
    return out;
  }
}

export { RingBuffer };
