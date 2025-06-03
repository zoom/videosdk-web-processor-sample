/**
 * A generic inter-thread RingBuffer implementation using SharedArrayBuffer.
 * Supports fixed-length interleaved Float32 audio data with N channels.
 */
export class RingBuffer {
  private sab: SharedArrayBuffer;
  private frameCapacity: number;
  private channelCount: number;
  private _ptrs: Int32Array;
  private _buffer: Float32Array;

  // number of bytes for readIndex and writeIndex
  static readonly HEADER_SIZE = 2 * Int32Array.BYTES_PER_ELEMENT;

  /**
   * Create a new RingBuffer, allocating a SharedArrayBuffer under the hood
   * @param frameCapacity number of frames the buffer can hold
   * @param channelCount number of interleaved channels
   */
  static create(frameCapacity: number, channelCount: number): RingBuffer {
    const sab = new SharedArrayBuffer(
      RingBuffer.HEADER_SIZE + frameCapacity * channelCount * Float32Array.BYTES_PER_ELEMENT
    );
    const ringBuffer = new RingBuffer(sab, frameCapacity, channelCount);
    // initialize pointers
    Atomics.store(ringBuffer._ptrs, 0, 0);
    Atomics.store(ringBuffer._ptrs, 1, 0);
    return ringBuffer;
  }

  /**
   * Attach to an existing SharedArrayBuffer
   */
  static attach(
    sab: SharedArrayBuffer,
    frameCapacity: number,
    channelCount: number
  ): RingBuffer {
    return new RingBuffer(sab, frameCapacity, channelCount);
  }

  private constructor(
    sab: SharedArrayBuffer,
    frameCapacity: number,
    channelCount: number
  ) {
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

  /** current read index (in frames) */
  get readIndex(): number {
    return Atomics.load(this._ptrs, 0);
  }
  set readIndex(value: number) {
    Atomics.store(this._ptrs, 0, value);
  }

  /** current write index (in frames) */
  get writeIndex(): number {
    return Atomics.load(this._ptrs, 1);
  }
  set writeIndex(value: number) {
    Atomics.store(this._ptrs, 1, value);
  }

  get sharedArrayBuffer(): SharedArrayBuffer {
    return this.sab;
  }

  /** number of frames available to read */
  availableRead(): number {
    return (
      (this.writeIndex - this.readIndex + this.frameCapacity) %
      this.frameCapacity
    );
  }

  /** number of free frames available to write */
  availableWrite(): number {
    return this.frameCapacity - this.availableRead() - 1;
  }

  /**
   * Write interleaved audio frames into the ring buffer
   * @param frames interleaved Float32Array of length = framesCount * channelCount
   */
  write(frames: Float32Array): void {
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

  /**
   * Read up to numFrames from the buffer, returns interleaved Float32Array
   * @param numFrames maximum number of frames to read
   * @returns Float32Array of length = actualReadFrames * channelCount
   */
  read(numFrames: number): Float32Array {
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