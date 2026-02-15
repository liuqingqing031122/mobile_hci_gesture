// =======================
// FSM VARIABLES
// =======================

let currentState = "IDLE";
let selectedFinger = null;

let wakeStartTime = null;
let selectStartTime = null;
let confirmStartTime = null;

const WAKE_DURATION = 2000;
const SELECT_DURATION = 2000;
const CONFIRM_DURATION = 1500;
const GRACE_PERIOD = 2500;

let handDetected = false;
let fullPalmDetected = false;
let fingerCount = null;

let lastHandTime = null;

// =======================
// STABILITY BUFFER
// =======================

let fingerHistory = [];
let palmHistory = [];

const HISTORY_SIZE = 8;
const STABLE_THRESHOLD = 6;

// =======================
// DOM
// =======================

const stateDisplay = document.getElementById("stateDisplay");
const progressCircle = document.getElementById("progressCircle");
const canvasElement = document.getElementById("outputCanvas");
const canvasCtx = canvasElement.getContext("2d");

const circumference = 2 * Math.PI * 40;

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
// STABILITY LOGIC
// =======================

function getStableFinger() {
  if (fingerHistory.length < HISTORY_SIZE) return null;

  const counts = {};
  fingerHistory.forEach((f) => {
    if (f !== null) {
      counts[f] = (counts[f] || 0) + 1;
    }
  });

  let maxFinger = null;
  let maxCount = 0;

  for (let finger in counts) {
    if (counts[finger] > maxCount) {
      maxCount = counts[finger];
      maxFinger = parseInt(finger);
    }
  }

  if (maxCount >= STABLE_THRESHOLD) return maxFinger;
  return null;
}

function isStablePalm() {
  if (palmHistory.length < HISTORY_SIZE) return false;
  const count = palmHistory.filter((p) => p === true).length;
  return count >= STABLE_THRESHOLD;
}

// =======================
// FINGER COUNT (改进拇指判断)
// =======================

function countFingers(landmarks) {
  let count = 0;

  // 四指
  if (landmarks[8].y < landmarks[6].y) count++;
  if (landmarks[12].y < landmarks[10].y) count++;
  if (landmarks[16].y < landmarks[14].y) count++;
  if (landmarks[20].y < landmarks[18].y) count++;

  // 改进拇指判断（横向 + 纵向）
  const thumbOpen =
    Math.abs(landmarks[4].x - landmarks[2].x) > 0.05 &&
    landmarks[4].y < landmarks[3].y;

  if (thumbOpen) count++;

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
      break;
  }

  updateUI();
}, 50);

// =======================
// MEDIAPIPE SETUP
// =======================

const videoElement = document.getElementById("inputVideo");

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

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});

camera.start();
let cameraRunning = true;

// =======================
// VISIBILITY CONTROL
// =======================

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (cameraRunning) {
      camera.stop();
      cameraRunning = false;
      console.log("Camera stopped (hidden)");
    }
  } else {
    if (!cameraRunning) {
      camera.start();
      cameraRunning = true;
      console.log("Camera restarted (visible)");
    }
  }
});

window.addEventListener("beforeunload", () => {
  if (cameraRunning) camera.stop();
});

// =======================
// HAND RESULTS
// =======================

function onResults(results) {
  canvasElement.width = results.image.width;
  canvasElement.height = results.image.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiHandLandmarks.length > 0) {
    handDetected = true;
    lastHandTime = Date.now();

    const landmarks = results.multiHandLandmarks[0];
    const rawFinger = countFingers(landmarks);

    fingerHistory.push(rawFinger);
    if (fingerHistory.length > HISTORY_SIZE) fingerHistory.shift();

    palmHistory.push(rawFinger >= 4);
    if (palmHistory.length > HISTORY_SIZE) palmHistory.shift();

    fingerCount = getStableFinger();
    fullPalmDetected = isStablePalm();
  } else {
    handDetected = false;
    fingerCount = null;
    fullPalmDetected = false;

    fingerHistory = [];
    palmHistory = [];
  }

  canvasCtx.restore();
}
