let currentState = "IDLE";
let selectedFinger = null;

let wakeStartTime = null;
let selectStartTime = null;
let confirmStartTime = null;

const WAKE_DURATION = 1500;
const SELECT_DURATION = 1500;
const CONFIRM_DURATION = 1000;

let handDetected = false;
let fullPalmDetected = false;
let fingerCount = null;
let handValid = true;

const stateDisplay = document.getElementById("stateDisplay");
const progressCircle = document.getElementById("progressCircle");
const circumference = 2 * Math.PI * 40;

function countFingers(landmarks) {
  let count = 0;

  // Index
  if (landmarks[8].y < landmarks[6].y) count++;
  // Middle
  if (landmarks[12].y < landmarks[10].y) count++;
  // Ring
  if (landmarks[16].y < landmarks[14].y) count++;
  // Pinky
  if (landmarks[20].y < landmarks[18].y) count++;

  // Thumb
  if (landmarks[4].x > landmarks[3].x) count++;

  return count;
}

function onResults(results) {
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
    handValid = true;

    const landmarks = results.multiHandLandmarks[0];

    fingerCount = countFingers(landmarks);
    fullPalmDetected = fingerCount === 5;
  } else {
    handDetected = false;
    fingerCount = null;
    fullPalmDetected = false;
  }

  canvasCtx.restore();
}

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
  console.log("Activated Button:", finger);
}

setInterval(() => {
  const now = Date.now();

  switch (currentState) {
    case "IDLE": {
      if (handDetected && fullPalmDetected && handValid) {
        if (!wakeStartTime) wakeStartTime = now;

        const elapsed = now - wakeStartTime;
        updateProgress(elapsed / WAKE_DURATION);

        if (elapsed >= WAKE_DURATION) {
          currentState = "SELECT_HOLD";
          selectStartTime = null;
          selectedFinger = null;
          resetProgress();
        }
      } else {
        wakeStartTime = null;
        resetProgress();
      }
      break;
    }

    case "SELECT_HOLD": {
      if (!handDetected) {
        currentState = "IDLE";
        selectedFinger = null;
        selectStartTime = null;
        resetProgress();
        break;
      }

      if (!handValid) {
        currentState = "ERROR";
        selectedFinger = null;
        selectStartTime = null;
        resetProgress();
        break;
      }

      // 关键修复：没有 fingerCount 就视为没有持续按住，必须清空计时与选择
      if (!(fingerCount >= 1 && fingerCount <= 5)) {
        selectedFinger = null;
        selectStartTime = null;
        resetProgress();
        break;
      }

      // 有 fingerCount 才允许开始或继续计时
      if (selectedFinger !== fingerCount) {
        selectedFinger = fingerCount;
        selectStartTime = now;
        resetProgress();
      }

      if (!selectStartTime) selectStartTime = now;

      const elapsed = now - selectStartTime;
      updateProgress(elapsed / SELECT_DURATION);

      if (elapsed >= SELECT_DURATION) {
        currentState = "CONFIRM";
        confirmStartTime = now;
        resetProgress();
      }

      break;
    }

    case "CONFIRM": {
      const elapsed = now - confirmStartTime;
      updateProgress(elapsed / CONFIRM_DURATION);

      if (elapsed >= CONFIRM_DURATION) {
        currentState = "ACTIVATED";
        triggerAction(selectedFinger);
        resetProgress();
      }
      break;
    }

    case "ACTIVATED": {
      // 真实系统这里跳转页面并关闭摄像头
      break;
    }

    case "ERROR": {
      resetProgress();

      if (!handDetected) {
        currentState = "IDLE";
      } else if (handValid) {
        // 恢复后回 IDLE 重新开始更简单
        currentState = "IDLE";
      }
      break;
    }
  }

  updateUI();
}, 50);

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  if (k === "x") {
    handDetected = false;
    fullPalmDetected = false;
    fingerCount = null;
    wakeStartTime = null;
    selectStartTime = null;
    resetProgress();
    return;
  }

  handDetected = true;
  handValid = true;

  if (k === "p") {
    fullPalmDetected = true;
    fingerCount = null;
  }

  if (k >= "1" && k <= "5") {
    fullPalmDetected = false;
    fingerCount = parseInt(k, 10);
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();

  if (k === "p") {
    fullPalmDetected = false;
  }

  if (k >= "1" && k <= "5") {
    fingerCount = null;

    // 关键修复：松开数字键就清空选择计时，防止两次短按累计
    selectStartTime = null;
    if (currentState === "SELECT_HOLD") {
      selectedFinger = null;
      resetProgress();
    }
  }
});

const videoElement = document.getElementById("inputVideo");
const canvasElement = document.getElementById("outputCanvas");
const canvasCtx = canvasElement.getContext("2d");

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
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
