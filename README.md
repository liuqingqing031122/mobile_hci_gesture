# Gesture-Based Button Activation System

A mobile-friendly gesture interaction technique that allows users to activate buttons with finger counting and multi-stage dwell mechanisms. Built for the Mobile HCI coursework at the University of Glasgow.

## Project Overview

This project implements a hand tracking-based input technique that addresses the "Midas Touch" problem in gesture-based interfaces. Users can select and activate one of five buttons by showing 1-5 fingers, with a finite state machine (FSM) design requiring sustained intent at each stage to prevent false activations.

**Key Features:**

- Hand tracking using MediaPipe Hands
- Multi-stage dwell-based confirmation (IDLE -> SELECT_HOLD -> CONFIRM -> ACTIVATED)
- Mobile-optimized with stability filtering and grace periods
- Single-handed operation
- No additional hardware required (uses front-facing camera)

## Repository Structure

This repository contains two branches for different purposes:

### `main` Branch - Optimized Implementation

**Best for: Trying out the interaction technique**

- High-performance recognition with minimal lag
- Higher camera resolution for better tracking
- Smooth, responsive interaction
- Optimized for modern browsers

**Use this branch if you want to:**

- Experience the best version of the technique
- See how the interaction performs under ideal conditions
- Demo the system

### `user-evaluation` Branch - Testing Version

**For: User evaluation and research purposes**

- Automated testing workflow with 3 conditions (Normal light, Dim light, Far distance)
- Task introduction screens and progress tracking
- Automatic data logging (JSON download after each condition)
- 5 randomized tasks per condition (15 total per participant)
- 30-second timeout per task

**Trade-offs:**

- Slightly lower camera resolution (for cross-browser compatibility)
- Minor performance lag (due to camera compatibility workarounds)
- Some browsers may have camera initialization issues

**Use this branch if you want to:**

- Conduct user evaluations
- Replicate the study methodology
- Collect performance data

## Quick Start

### Option 1: Run Locally (Recommended)

```bash
# Clone the repository
git clone https://github.com/liuqingqing031122/mobile_hci_gesture.git
cd mobile_hci_gesture

# For optimized version (main branch)
git checkout main
# Open index.html in your browser

# For evaluation version (user-evaluation branch)
git checkout user-evaluation
# Open index.html in your browser
```

**Requirements:**

- Modern web browser with camera permissions
- Device with front-facing camera
- Good lighting conditions (for optimal performance)

### Option 2: Deployed Version

**Live Demo:** [Deployed Website](https://mobile-hci-evaluation.netlify.app/)

_Note: Deployed version uses the user-evaluation branch_

## How to Use

### Main Branch (Interactive Demo)

1. **Open the page** - Allow camera permissions when prompted
2. **Wake the system** - Show an open palm and hold for 1.2 seconds
3. **Select a button** - Show 1-5 fingers corresponding to the button number
4. **Hold steady** - Maintain your gesture for 1.2 seconds
5. **Confirmation** - The system confirms your selection (0.8s)
6. **Button activated!** - The selected button is triggered

**Tips for best performance:**

- Ensure good lighting
- Hold your hand within camera view (~30-60cm from camera)
- Keep your hand steady during dwell periods
- Use clear, distinct finger gestures

### User-Evaluation Branch (Testing Protocol)

1. **Enter Participant ID** - Start screen will ask for your ID
2. **Complete 3 conditions** - System automatically guides you through:
   - Normal lighting (5 tasks)
   - Dim lighting (5 tasks) - Turn off main lights
   - Far distance (5 tasks) - Stand ~1.5m from camera
3. **Follow task instructions** - Each task tells you which button to activate
4. **Download logs** - JSON file downloads automatically after each condition

**Testing Tips:**

- Complete all tasks in one session if possible
- Don't refresh the page during a condition
- Download log files immediately after each condition
- Read condition instructions carefully before starting

## Technical Details

**Technology Stack:**

- HTML5 / CSS3 / JavaScript (ES6+)
- [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html) - Hand tracking
- Web-based (no server required)

**Core Implementation:**

- Finite State Machine (FSM) with 5 states
- Finger counting via landmark position analysis
- Time-based stability filtering (400ms threshold)
- Dwell-based confirmation (1.2s, 1.2s, 0.8s)
- Grace period (2.5s) for temporary hand loss

**Key Challenges Solved:**

- Thumb detection (horizontal distance threshold: 0.13)
- Mobile camera shake and inconsistent frame rates
- Cross-browser camera compatibility
- Midas Touch problem mitigation

## Evaluation Data

If you're using the `user-evaluation` branch, data is automatically logged and downloaded as JSON files:

**Log file format:** `{ID}_{condition}_log.json`

**Data collected per task:**

- Participant ID
- Condition (normal/dim/far)
- Task number
- Target button
- Activated button
- Success status
- Timed out (boolean)
- Completion time (ms)
- Timestamp

## Known Issues

### Main Branch

- Single extended thumb (Button 1) may occasionally fail detection
- Requires relatively good lighting (dim conditions may cause issues)
- MediaPipe may take 1-2 seconds to initialize on first load

### User-Evaluation Branch

- Camera may show as black screen on some devices/browsers (hidden to improve compatibility)
- Slightly lower performance compared to main branch
- Safari may have camera permission issues

**Workarounds:**

- Refresh page if camera doesn't initialize
- Use Chrome/Edge for best compatibility
- Ensure browser has camera permissions

## License

This project was created for academic purposes as part of the Mobile HCI coursework at the University of Glasgow.

## Acknowledgments

- MediaPipe Hands by Google
- Study participants who provided valuable feedback

**Last Updated:** March 2026
