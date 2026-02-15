// ======================================================
// Gesture-Based Button Activation System
// Mobile-Optimized Version
// ------------------------------------------------------
// This script implements a finite state machine (FSM)
// for gesture-based interaction using MediaPipe Hands.
// The system is optimized for mobile stability.
// ======================================================

// ======================================================
// 1. FSM STATE VARIABLES
// ======================================================

// Current interaction state
let currentState = "IDLE";

// Currently selected finger count (1–5)
let selectedFinger = null;

// Timing variables for dwell-based interaction
let wakeStartTime = null;
let selectStartTime = null;
let confirmStartTime = null;

// Dwell durations (mobile optimized)
const WAKE_DURATION = 1200; // Open palm hold to activate
const SELECT_DURATION = 1200; // Hold gesture to select
const CONFIRM_DURATION = 800; // Final confirmation hold

// Grace period allows temporary hand loss without reset
const GRACE_PERIOD = 2500;

// Detection flags
let handDetected = false;
let fullPalmDetected = false;
let fingerCount = null;

let lastHandTime = null;

// ======================================================
// 2. MOBILE STABILITY (TIME-BASED FILTERING)
// ======================================================

// Instead of frame voting, we use time-based stability.
// A gesture must remain stable for STABLE_TIME ms.

let candidateFinger = null;
let candidateFingerStart = null;

let candidatePalm = false;
let candidatePalmStart = null;

const STABLE_TIME = 400;

// ======================================================
// 3. DOM REFERENCES
// ======================================================

const stateDisplay = document.getElementById("stateDisplay");
const progressCircle = document.getElementById("progressCircle");
const canvasElement = document.getElementById("outputCanvas");
const canvasCtx = canvasElement.getContext("2d");
const videoElement = document.getElementById("inputVideo");

const circumference = 2 * Math.PI * 38;

// ======================================================
// 4. USER-FACING UI MESSAGES
// ======================================================

function updateUI() {
  // Translate technical states into user-friendly instructions
  let message = "";

  switch (currentState) {
    case "IDLE":
      message = "✋ Show an open palm to begin";
      break;

    case "SELECT_HOLD":
      message = "☝️ Show 1–5 fingers to choose";
      break;

    case "CONFIRM":
      message = "⏳ Hold to confirm…";
      break;

    case "ACTIVATED":
      message = "✅ Activated";
      break;
  }

  stateDisplay.innerText = message;

  // Update visual highlight of selected button
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (selectedFinger) {
    const el = document.getElementById("btn" + selectedFinger);
    if (el) el.classList.add("active");
  }
}

// Update circular dwell progress indicator
function updateProgress(ratio) {
  const progress = Math.min(Math.max(ratio, 0), 1);
  const offset = circumference * (1 - progress);
  progressCircle.style.strokeDashoffset = offset;
}

// Reset progress circle
function resetProgress() {
  progressCircle.style.strokeDashoffset = circumference;
}

// Provide haptic + console feedback
function triggerAction(finger) {
  if (navigator.vibrate) navigator.vibrate(200);
  console.log("Activated:", finger);
}

// ======================================================
// 5. FINGER COUNTING (MOBILE-STABLE LOGIC)
// ======================================================

// A finger is considered extended if its tip is above
// both PIP and MCP joints.
function fingerExtended(tip, pip, mcp) {
  return tip.y < pip.y && pip.y < mcp.y;
}

// Count number of extended fingers (0–5)
function countFingers(landmarks) {
  const index = fingerExtended(landmarks[8], landmarks[6], landmarks[5]);
  const middle = fingerExtended(landmarks[12], landmarks[10], landmarks[9]);
  const ring = fingerExtended(landmarks[16], landmarks[14], landmarks[13]);
  const pinky = fingerExtended(landmarks[20], landmarks[18], landmarks[17]);

  const extendedCount =
    (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);

  // If no fingers extended → treat as fist (0)
  if (extendedCount === 0) {
    return 0;
  }

  // Thumb detection based on distance from palm center
  const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;

  const thumbDistance = Math.abs(landmarks[4].x - palmCenterX);
  const thumbVertical =
    landmarks[4].y < landmarks[3].y && landmarks[3].y < landmarks[2].y;

  let thumb = false;

  // Threshold tuned for mobile wide-angle cameras
  if (thumbDistance > 0.13 && thumbVertical) {
    thumb = true;
  }

  return extendedCount + (thumb ? 1 : 0);
}

// ======================================================
// 6. FSM MAIN LOOP
// ======================================================

setInterval(() => {
  const now = Date.now();

  switch (currentState) {
    case "IDLE":
      // Wait for stable open palm activation
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
      // Allow short hand loss (grace period)
      if (!handDetected) {
        if (lastHandTime && now - lastHandTime > GRACE_PERIOD) {
          currentState = "IDLE";
          selectedFinger = null;
          selectStartTime = null;
          resetProgress();
        }
        break;
      }

      // Only allow valid selections (1–5)
      if (!(fingerCount >= 1 && fingerCount <= 5)) {
        selectedFinger = null;
        selectStartTime = null;
        resetProgress();
        break;
      }

      // Update selection when gesture changes
      if (selectedFinger !== fingerCount) {
        selectedFinger = fingerCount;
        selectStartTime = now;
        resetProgress();
      }

      const elapsed = now - selectStartTime;
      updateProgress(elapsed / SELECT_DURATION);

      if (elapsed >= SELECT_DURATION) {
        currentState = "CONFIRM";
        confirmStartTime = now;
        resetProgress();
      }

      break;

    case "CONFIRM":
      const confirmElapsed = now - confirmStartTime;
      updateProgress(confirmElapsed / CONFIRM_DURATION);

      if (confirmElapsed >= CONFIRM_DURATION) {
        currentState = "ACTIVATED";
        triggerAction(selectedFinger);
        resetProgress();
      }

      break;

    case "ACTIVATED":
      // Remains in activated state until reset externally
      break;
  }

  updateUI();
}, 50);

// ======================================================
// 7. CAMERA LIFECYCLE MANAGEMENT
// ======================================================

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

let camera = null;
let cameraRunning = false;

// Stop underlying media tracks explicitly
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
  camera.start();
  cameraRunning = true;
}

function stopCamera() {
  if (!cameraRunning) return;
  camera.stop();
  cameraRunning = false;
  stopMediaTracks();
  camera = null;
}

// Initial camera start
startCamera();

// Stop camera when page hidden or backgrounded
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopCamera();
  else startCamera();
});

window.addEventListener("pagehide", stopCamera);
window.addEventListener("pageshow", startCamera);
window.addEventListener("beforeunload", stopCamera);

// ======================================================
// 8. HAND LANDMARK PROCESSING
// ======================================================

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

    // Time-based finger stability
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

    // Stable palm detection (≥4 fingers)
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
