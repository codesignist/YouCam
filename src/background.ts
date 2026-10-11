// Background effects, the way Google Meet does them on the web: a MediaPipe
// selfie segmentation model tells the person apart from the background on
// every camera frame; the background is drawn blurred (and optionally
// darkened) and the person sharp on top. main.ts only imports this module
// while an effect is on.
import { ImageSegmenter } from "@mediapipe/tasks-vision";
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import modelAssetPath from "../assets/models/selfie_segmenter.tflite?url";

export type BackgroundMode = "Blur" | "Dark blur";

export interface BackgroundEffect {
  setMode(mode: BackgroundMode): void;
  stop(): void;
}

// The model works on 256px input anyway, so handing it a downscaled frame is
// much cheaper than letting it resize full camera frames (and masks) itself
const MODEL_SIZE = 256;
// How bright the background stays in "Dark blur" (1 = unchanged)
const DARK_BRIGHTNESS = 0.4;

function createSegmenter(): Promise<ImageSegmenter> {
  return ImageSegmenter.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      // The GPU delegate measured slower: reading the mask back from the GPU
      // every frame costs more than running this small model on CPU
      baseOptions: { modelAssetPath, delegate: "CPU" },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }
  );
}

function resize(
  target: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number
): void {
  // Assigning a canvas size clears it, so only do it when it changes
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
}

function context2d(
  canvas: HTMLCanvasElement | OffscreenCanvas
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas context");
  return ctx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

// Starts drawing the camera image with the given background onto canvas.
// Switching modes keeps the model running, so it is instant.
export async function startBackground(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  initialMode: BackgroundMode
): Promise<BackgroundEffect> {
  const segmenter = await createSegmenter();
  let mode = initialMode;
  const ctx = context2d(canvas);
  const small = new OffscreenCanvas(1, 1);
  const smallCtx = context2d(small);
  const mask = new OffscreenCanvas(1, 1);
  const maskCtx = context2d(mask);
  const person = new OffscreenCanvas(1, 1);
  const personCtx = context2d(person);
  let maskImage: ImageData | undefined;
  let running = true;
  let frameRequest = 0;

  function drawFrame(): boolean {
    // Match the canvas to its on-screen size (it changes with the window
    // size, rotation and the screen's pixel ratio)
    const width = Math.round(canvas.clientWidth * devicePixelRatio);
    const height = Math.round(canvas.clientHeight * devicePixelRatio);
    if (!width || !height || !video.videoWidth) return false;
    // Checked separately: the page's canvas keeps its size from an earlier
    // start, while person is new (1x1) every time an effect is turned on
    resize(canvas, width, height);
    resize(person, width, height);
    const scale = MODEL_SIZE / Math.max(width, height);
    const smallW = Math.round(width * scale);
    const smallH = Math.round(height * scale);
    if (!maskImage || small.width !== smallW || small.height !== smallH) {
      resize(small, smallW, smallH);
      resize(mask, smallW, smallH);
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
    const confidence = result.confidenceMasks?.[0]?.getAsFloat32Array();
    if (confidence) {
      for (let i = 0; i < confidence.length; i++) {
        maskImage.data[i * 4 + 3] = confidence[i] * 255;
      }
    }
    result.close();
    maskCtx.putImageData(maskImage, 0, 0);

    // Background: the small frame scaled up and blurred (darkened in the same
    // filter pass for "Dark blur"), drawn a bit larger than the canvas so
    // the blur doesn't fade out at the edges
    const blur = Math.round(Math.max(width, height) / 50);
    ctx.filter =
      mode === "Dark blur"
        ? `blur(${blur}px) brightness(${DARK_BRIGHTNESS})`
        : `blur(${blur}px)`;
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

  function onFrame(): void {
    if (!running) return;
    try {
      // Once the canvas covers it, hiding the video saves compositing it
      // underneath every frame (it keeps decoding frames while hidden)
      if (drawFrame()) video.style.visibility = "hidden";
    } catch (err) {
      // Fall back to the plain video underneath rather than a frozen frame
      console.error("background:", err);
      stop();
      return;
    }
    frameRequest = video.requestVideoFrameCallback(onFrame);
  }
  frameRequest = video.requestVideoFrameCallback(onFrame);

  function stop(): void {
    if (!running) return;
    running = false;
    video.cancelVideoFrameCallback(frameRequest);
    segmenter.close();
    video.style.visibility = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    setMode(next) {
      mode = next;
    },
    stop,
  };
}
