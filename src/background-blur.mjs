// Background blur, the way Google Meet does it on the web: a MediaPipe
// selfie segmentation model tells the person apart from the background on
// every camera frame; the background is drawn blurred and the person sharp
// on top. app.js only imports this module while blur is enabled.
import {
  FilesetResolver,
  ImageSegmenter,
} from "../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

const WASM_DIR = new URL(
  "../node_modules/@mediapipe/tasks-vision/wasm",
  import.meta.url
).href;
const MODEL = new URL("../assets/models/selfie_segmenter.tflite", import.meta.url)
  .href;
// The model works on 256px input anyway, so handing it a downscaled frame is
// much cheaper than letting it resize full camera frames (and masks) itself
const MODEL_SIZE = 256;

async function createSegmenter() {
  // MediaPipe's Emscripten loader treats any page with process.versions.node
  // as Node.js (and then fails on __dirname) unless it looks like an Electron
  // renderer, so pretend to be one while it loads
  const previousType = process.type;
  process.type = "renderer";
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_DIR);
    return await ImageSegmenter.createFromOptions(fileset, {
      // The GPU delegate measured slower in NW.js: reading the mask back from
      // the GPU every frame costs more than running this small model on CPU
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  } finally {
    if (previousType === undefined) delete process.type;
    else process.type = previousType;
  }
}

function resize(target, width, height) {
  // Assigning a canvas size clears it, so only do it when it changes
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
}

// Starts drawing the blurred camera image onto canvas and resolves to a
// function that stops it again
export async function startBackgroundBlur(video, canvas) {
  const segmenter = await createSegmenter();
  const ctx = canvas.getContext("2d");
  const small = new OffscreenCanvas(1, 1);
  const smallCtx = small.getContext("2d");
  const mask = new OffscreenCanvas(1, 1);
  const maskCtx = mask.getContext("2d");
  const person = new OffscreenCanvas(1, 1);
  const personCtx = person.getContext("2d");
  let maskImage;
  let running = true;
  let frameRequest;

  function drawFrame() {
    // Match the canvas to its on-screen size (it changes with the window
    // size, rotation and the screen's pixel ratio)
    const width = Math.round(canvas.clientWidth * devicePixelRatio);
    const height = Math.round(canvas.clientHeight * devicePixelRatio);
    if (!width || !height || !video.videoWidth) return false;
    // Checked separately: the page's canvas keeps its size from an earlier
    // start, while person is new (1x1) every time blur is turned on
    resize(canvas, width, height);
    resize(person, width, height);
    const scale = MODEL_SIZE / Math.max(width, height);
    const smallW = Math.round(width * scale);
    const smallH = Math.round(height * scale);
    if (small.width !== smallW || small.height !== smallH) {
      small.width = mask.width = smallW;
      small.height = mask.height = smallH;
      maskImage = maskCtx.createImageData(smallW, smallH);
    }

    // Same crop as the plain video's object-fit: cover; object-position: bottom
    const crop = Math.min(video.videoWidth / width, video.videoHeight / height);
    const sw = width * crop;
    const sh = height * crop;
    const sx = (video.videoWidth - sw) / 2;
    const sy = video.videoHeight - sh;
    smallCtx.drawImage(video, sx, sy, sw, sh, 0, 0, smallW, smallH);

    const result = segmenter.segmentForVideo(small, performance.now());
    const confidence = result.confidenceMasks[0].getAsFloat32Array();
    for (let i = 0; i < confidence.length; i++) {
      maskImage.data[i * 4 + 3] = confidence[i] * 255;
    }
    result.close();
    maskCtx.putImageData(maskImage, 0, 0);

    // Background: the small frame scaled up and blurred, drawn a bit larger
    // than the canvas so the blur doesn't fade out at the edges
    const blur = Math.round(Math.max(width, height) / 50);
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(small, -blur, -blur, width + blur * 2, height + blur * 2);
    ctx.filter = "none";
    // Person: the sharp frame cut out by the (smoothly upscaled) mask
    personCtx.globalCompositeOperation = "copy";
    personCtx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
    personCtx.globalCompositeOperation = "destination-in";
    personCtx.drawImage(mask, 0, 0, width, height);
    ctx.drawImage(person, 0, 0);
    return true;
  }

  function onFrame() {
    if (!running) return;
    try {
      // Once the canvas covers it, hiding the video saves compositing it
      // underneath every frame (it keeps decoding frames while hidden)
      if (drawFrame()) video.style.visibility = "hidden";
    } catch (err) {
      // Fall back to the plain video underneath rather than a frozen frame
      console.error("background blur:", err);
      stop();
      return;
    }
    frameRequest = video.requestVideoFrameCallback(onFrame);
  }
  frameRequest = video.requestVideoFrameCallback(onFrame);

  function stop() {
    if (!running) return;
    running = false;
    video.cancelVideoFrameCallback(frameRequest);
    segmenter.close();
    video.style.visibility = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  return stop;
}
