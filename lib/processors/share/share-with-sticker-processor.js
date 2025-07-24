class TestShareProcessor extends ShareProcessor {

    constructor(port, options) {
      super(port, options);
  
      port.onmessage = (e) => {
        console.log(`TestShareProcessor onmessage() e:${JSON.stringify(e)}`);
      };
    }
  
    onInit() {
      // nothing
    }
  
    onUninit() {
      // nothing
    }
  
    async processFrame(input, output) {
      console.log(`TestShareProcessor processFrame()`);
      output.width  = input.codedWidth;
      output.height = input.codedHeight;
      const ctx = output.getContext('2d');
      ctx.clearRect(0, 0, output.width, output.height);
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, output.width, output.height);
      input.close();
  
      return true;
    }
  }
  
  registerProcessor("share-processor-test", TestShareProcessor);
  