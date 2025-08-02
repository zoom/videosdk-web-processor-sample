class SimpleShareProcessor extends ShareProcessor {

    constructor(port, options) {
      super(port, options);
  
      port.onmessage = (e) => {
        console.log(`SimpleShareProcessor onmessage() e:${JSON.stringify(e)}`);
      };
    }
  
    onInit() {
      const outputCanvas = this.getOutput();
      if (outputCanvas) {
        this.context = outputCanvas.getContext('2d');
        if (!this.context) {
          console.error('2D context could not be initialized.');
        }
      }
    }
  
    onUninit() {
      // nothing
    }
  
    async processFrame(input, output) {
      output.width  = input.codedWidth;
      output.height = input.codedHeight;
      this.context.clearRect(0, 0, output.width / 4, output.height / 4);
      this.context.fillStyle = 'red';
      this.context.fillRect(0, 0, output.width, output.height);
      input.close();
      return true;
    }
  }
  
  registerProcessor("simple-share-processor", SimpleShareProcessor);
  