// =======================
// FSM VARIABLES
// =======================

let currentState = "IDLE";
let selectedFinger = null;

let wakeStartTime = null;
let selectStartTime = null;
let confirmStartTime = null;

const WAKE_DURATION = 1800;
const SELECT_DURATION = 1500;
const CONFIRM_DURATION = 1200;
const GRACE_PERIOD = 2500;

let handDetected = false;
let fullPalmDetected = false;
let fingerCount = null;

let lastHandTime = null;

// =======================
// MOBILE STABILITY (time based)
// =======================

let candidateFinger = null;
let candidateFingerStart = null;

let candidatePalm = false;
let candidatePalmStart = null;

const STABLE_TIME = 400;

// =======================
// DOM
// =======================

const stateDisplay = document.getElementById("stateDisplay");
const progressCircle = document.getElementById("progressCircle");
const canvasElement = document.getElementById("outputCanvas");
const canvasCtx = canvasElement.getContext("2d");
const videoElement = document.getElementById("inputVideo");

const circumference = 2 * Math.PI * 38;

// =======================
// UI
// =======================

function updateUI() {
  stateDisplay.innerText = "STATE: " + currentState;

  document.querySelectorAll(".btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (selectedFinger) {
    const el = document.getElementById("btn" + selectedFinger);
    if (el) el.classList.add("active");
  }
}

function updateProgress(ratio) {
  const progress = Math.min(Math.max(ratio, 0), 1);
  const offset = circumference * (1 - progress);
  progressCircle.style.strokeDashoffset = offset;
}

function resetProgress() {
  progressCircle.style.strokeDashoffset = circumference;
}

function triggerAction(finger) {
  if (navigator.vibrate) navigator.vibrate(200);
  console.log("Activated:", finger);
}

// =======================
// MOBILE OPTIMIZED FINGER COUNT
// =======================

function fingerExtended(tip, pip, mcp) {
  return tip.y < pip.y && pip.y < mcp.y;
}

function countFingers(landmarks) {
  let count = 0;

  const index = fingerExtended(landmarks[8], landmarks[6], landmarks[5]);
  const middle = fingerExtended(landmarks[12], landmarks[10], landmarks[9]);
  const ring = fingerExtended(landmarks[16], landmarks[14], landmarks[13]);
  const pinky = fingerExtended(landmarks[20], landmarks[18], landmarks[17]);

  if (index) count++;
  if (middle) count++;
  if (ring) count++;
  if (pinky) count++;

  // -------- 更稳的拇指判断 --------

  // 掌心中心点（大致）
  const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;

  const thumbDistance = Math.abs(landmarks[4].x - palmCenterX);

  const thumbVertical =
    landmarks[4].y < landmarks[3].y && landmarks[3].y < landmarks[2].y;

  // 提高阈值
  if (thumbDistance > 0.12 && thumbVertical) {
    count++;
  }

  return count;
}

// =======================
// FSM LOOP
// =======================

setInterval(() => {
  const now = Date.now();

  switch (currentState) {
    case "IDLE":
      if (handDetected && fullPalmDetected) {
        if (!wakeStartTime) wakeStartTime = now;

        const elapsed = now - wakeStartTime;
        updateProgress(elapsed / WAKE_DURATION);

        if (elapsed >= WAKE_DURATION) {
          currentState = "SELECT_HOLD";
          selectStartTime = null;
          resetProgress();
        }
      } else {
        wakeStartTime = null;
        resetProgress();
      }
      break;

    case "SELECT_HOLD":
      if (!handDetected) {
        if (lastHandTime && now - lastHandTime > GRACE_PERIOD) {
          currentState = "IDLE";
          selectedFinger = null;
          selectStartTime = null;
          resetProgress();
        }
        break;
      }

      if (!(fingerCount >= 1 && fingerCount <= 5)) {
        selectedFinger = null;
        selectStartTime = null;
        resetProgress();
        break;
      }

      if (selectedFinger !== fingerCount) {
        selectedFinger = fingerCount;
        selectStartTime = now;
        resetProgress();
      }

      {
        const elapsed = now - selectStartTime;
        updateProgress(elapsed / SELECT_DURATION);

        if (elapsed >= SELECT_DURATION) {
          currentState = "CONFIRM";
          confirmStartTime = now;
          resetProgress();
        }
      }
      break;

    case "CONFIRM":
      {
        const elapsed = now - confirmStartTime;
        updateProgress(elapsed / CONFIRM_DURATION);

        if (elapsed >= CONFIRM_DURATION) {
          currentState = "ACTIVATED";
          triggerAction(selectedFinger);
          resetProgress();
        }
      }
      break;

    case "ACTIVATED":
      break;
  }

  updateUI();
}, 50);

// =======================
// MEDIAPIPE SETUP
// =======================

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 0,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults(onResults);

// camera instance will be created dynamically
let camera = null;
let cameraRunning = false;

function stopMediaTracks() {
  const stream = videoElement.srcObject;
  if (stream && stream.getTracks) {
    stream.getTracks().forEach((t) => t.stop());
  }
  videoElement.srcObject = null;
}

function createCamera() {
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });
}

function startCamera() {
  if (cameraRunning) return;

  if (!camera) createCamera();

  try {
    camera.start();
    cameraRunning = true;
    console.log("Camera started");
  } catch (e) {
    console.warn("Camera start failed", e);
  }
}

function stopCamera() {
  if (!cameraRunning) return;

  try {
    camera.stop();
  } catch (e) {
    console.warn("Camera stop failed", e);
  }

  cameraRunning = false;
  stopMediaTracks();

  // drop camera instance so restart is clean on mobile browsers
  camera = null;

  console.log("Camera stopped");
}

// start once
startCamera();

// =======================
// VISIBILITY AND LIFECYCLE CONTROL
// =======================

// tab switch and app background
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopCamera();
  } else {
    startCamera();
  }
});

// iOS Safari often uses pagehide pageshow more reliably
window.addEventListener("pagehide", () => {
  stopCamera();
});

window.addEventListener("pageshow", () => {
  startCamera();
});

// leaving the page
window.addEventListener("beforeunload", () => {
  stopCamera();
});

// =======================
// HAND RESULTS
// =======================

function onResults(results) {
  canvasElement.width = results.image.width;
  canvasElement.height = results.image.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);

  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handDetected = true;
    lastHandTime = Date.now();

    const landmarks = results.multiHandLandmarks[0];
    const rawFinger = countFingers(landmarks);

    // time stable finger
    if (rawFinger !== candidateFinger) {
      candidateFinger = rawFinger;
      candidateFingerStart = Date.now();
    }
    if (
      candidateFingerStart &&
      Date.now() - candidateFingerStart >= STABLE_TIME
    ) {
      fingerCount = rawFinger;
    } else {
      fingerCount = null;
    }

    // time stable palm (looser)
    const rawPalm = rawFinger >= 4;
    if (rawPalm !== candidatePalm) {
      candidatePalm = rawPalm;
      candidatePalmStart = Date.now();
    }
    if (candidatePalmStart && Date.now() - candidatePalmStart >= STABLE_TIME) {
      fullPalmDetected = rawPalm;
    } else {
      fullPalmDetected = false;
    }
  } else {
    handDetected = false;
    fingerCount = null;
    fullPalmDetected = false;

    candidateFinger = null;
    candidateFingerStart = null;

    candidatePalm = false;
    candidatePalmStart = null;
  }

  canvasCtx.restore();
}
