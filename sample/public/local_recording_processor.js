!(function (e) {
  "function" == typeof define && define.amd ? define(e) : e();
})(function () {
  "use strict";
  class e extends AudioProcessor {
    #e = 48e3;
    #t = -1;
    #n = -2;
    #s = -3;
    #r = -4;
    #o = -5;
    constructor(e, t) {
      super(e, t),
        (this.recordedData = []),
        (this.isRecording = !1),
        (this.sampleRate = 0),
        (this.numChannels = 0),
        (this.port.onmessage = (e) => {
          const { command: t, config: n } = e.data;
          "start" === t
            ? (console.log(
                `start to record audio data! config: ${JSON.stringify(n)}`
              ),
              (this.isRecording = !0),
              (this.recordedData = []),
              n
                ? ((this.sampleRate = n.sampleRate),
                  (this.numChannels = n.numChannels || 2))
                : ((this.sampleRate = this.#e), (this.numChannels = 2)),
              this.port.postMessage({
                type: "status",
                message: "local recording is started...",
              }))
            : "stop" === t &&
              ((this.isRecording = !1),
              this.port.postMessage({
                type: "status",
                message: "local recording is stopped...",
              }),
              this.#a());
        });
    }
    onInit() {
      console.log("local recording audio processor init");
    }
    onUninit() {
      console.log("local recording audio processor uninit");
    }
    process(e, t, n) {
      if (!this.isRecording || 0 === this.numChannels) return !0;
      const s = e[0];
      if (!s || 0 === s.length) return console.warn("no input channels"), !0;
      const r = s.length;
      if (0 === r || !s[0] || 0 === s[0].length)
        return console.warn("first input channel is empty, no data!"), !0;
      const o = Math.min(r, this.numChannels),
        a = [];
      for (let e = 0; e < o; e++)
        if (s[e] && s[e].length > 0) a.push(s[e].slice());
        else if (
          (console.warn(`processor: channel ${e} expected but no data found!`),
          e < r && s[e])
        )
          console.warn(`channel ${e} is empty, but has data`);
        else {
          const e = s[0] && s[0].length > 0 ? s[0].length : 128;
          a.push(new Float32Array(e));
        }
      if (a.length > 0)
        if (a.length === this.numChannels) this.recordedData.push(a);
        else if (a.length < this.numChannels && a.length > 0) {
          for (; a.length < this.numChannels; ) {
            const e =
              a[0] && a[0].length > 0
                ? a[0].length
                : s[0] && s[0].length > 0
                ? s[0].length
                : 128;
            a.push(new Float32Array(e));
          }
          this.recordedData.push(a);
        } else
          a.length > this.numChannels &&
            this.recordedData.push(a.slice(0, this.numChannels));
      return !0;
    }
    #a() {
      if (0 !== this.recordedData.length)
        if (this.sampleRate <= 0 || this.numChannels <= 0)
          this.port.postMessage({
            type: "error",
            message: "invalid sample rate",
          });
        else
          try {
            const e = this.#i();
            if (0 !== e.errno || !e.buffer)
              return void this.port.postMessage({
                type: "error",
                message: "failed to encode wav data",
              });
            this.port.postMessage(
              { type: "encodedRecordingData", buffer: e.buffer },
              [e.buffer]
            );
          } catch (e) {
            this.port.postMessage({
              type: "error",
              message: "failed to encode wav data",
            }),
              console.error(`failed to encode wav data: ${e}`);
          } finally {
            this.recordedData = [];
          }
      else
        this.port.postMessage({
          type: "error",
          message: "no recorded data to encode",
        });
    }
    #i() {
      if (0 === this.recordedData.length)
        return (
          console.error("no data to encode!"), { errno: this.#t, buffer: null }
        );
      if (this.sampleRate <= 0)
        return (
          console.error(`invalid sample rate: ${this.sampleRate}`),
          { errno: this.#n, buffer: null }
        );
      if (this.numChannels <= 0)
        return (
          console.error(`invalid number of channels: ${this.numChannels}`),
          { errno: this.#s, buffer: null }
        );
      let e = 0;
      if (
        !(
          this.recordedData.length > 0 &&
          this.recordedData[0].length > 0 &&
          this.recordedData[0][0]
        )
      )
        return { errno: this.#r, buffer: null };
      for (const t of this.recordedData) t && t[0] && (e += t[0].length);
      if (e <= 0)
        return (
          console.error("no samples to encode!"),
          { errno: this.#o, buffer: null }
        );
      const t = e * this.numChannels,
        n = new Float32Array(t),
        s = [];
      for (let t = 0; t < this.numChannels; t++) {
        const n = new Float32Array(e);
        let r = 0;
        for (const e of this.recordedData)
          e && e[t] && e[t].length > 0 && (n.set(e[t], r), (r += e[t].length));
        s.push(n);
      }
      let r = 0;
      for (let t = 0; t < e; t++)
        for (let e = 0; e < this.numChannels; e++)
          s[e] ? (n[r++] = s[e][t]) : (n[r++] = 0);
      const o = 2 * this.numChannels,
        a = this.sampleRate * o,
        i = 2 * n.length,
        l = new ArrayBuffer(44 + i),
        h = new DataView(l);
      return (
        this.#l(h, 0, "RIFF"),
        h.setUint32(4, 36 + i, !0),
        this.#l(h, 8, "WAVE"),
        this.#l(h, 12, "fmt "),
        h.setUint32(16, 16, !0),
        h.setUint16(20, 1, !0),
        h.setUint16(22, this.numChannels, !0),
        h.setUint32(24, this.sampleRate, !0),
        h.setUint32(28, a, !0),
        h.setUint16(32, o, !0),
        h.setUint16(34, 16, !0),
        this.#l(h, 36, "data"),
        h.setUint32(40, i, !0),
        this.#h(h, 44, n),
        { errno: 0, buffer: l }
      );
    }
    #h(e, t, n) {
      for (let s = 0; s < n.length; s++, t += 2) {
        const r = Math.max(-1, Math.min(1, n[s]));
        e.setInt16(t, r < 0 ? 32768 * r : 32767 * r, !0);
      }
    }
    #l(e, t, n) {
      for (let s = 0; s < n.length; s++) e.setUint8(t + s, n.charCodeAt(s));
    }
  }
  registerProcessor("local_recording_audio_processor", e);
});
