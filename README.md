# Altera Chrome Extension Interview

## Problem
You will be implementing a version of the [Chrome DevTools Recorder](https://developer.chrome.com/docs/devtools/recorder). This is a tool that allows users to record and replay computer actions, such as clicking, typing, etc on Chrome. 

Your final repo should contain the following 3 components:
1) A chrome extension that captures user actions on a Chrome browser and allows users to download action traces.
2) A script that takes in the recorded action trace and replays the same sequence of actions on a browser.
3) The recorded action trace of the following flow:
    1. Navigate to https://chatgpt.com
    2. Engage in a multiround conversation with ChatGPT. Use Search mode for for at least one of the queries.

## My Implementation

### Overview
I built a Chrome extension that records user actions (clicks, typing, key presses) and a Python replay script using Selenium. The system uses HTML selectors for element detection, similar to Chrome DevTools Recorder.

### Key Features
- **Action Recording**: Captures clicks, typing, and Enter key presses
- **Smart Selector Generation**: Prioritizes stable selectors (ID, data-testid, aria-label)
- **Robust Fallbacks**: Multiple strategies for element detection
- **Google Chrome Integration**: Specifically targets Google Chrome browser

### Technical Stack
- **Frontend**: Chrome Extension (HTML, CSS, JavaScript) with Webpack bundling
- **Backend**: Python with Selenium WebDriver
- **Development**: Cursor IDE for rapid iteration and fast development (I just wanted to use it for faster implementation)

## Implementation Challenges & Solutions

### 1. Typing Detection & User Experience
**The Problem**: Initially, the extension only recorded the final typed text. This was terrible UX because users couldn't see their typing progress or handle corrections.

**The Struggle**: I spent a few minutes trying to figure out when to "commit" a typing action. If I recorded every keystroke, the trace would be huge. If I only recorded the final result, users couldn't see their typing in the side panel. It would also sometimes update the previous typing, as if there wasn't new action being taken. 

**The Solution**: Implemented a smart typing system that:
- Records typing actions as they happen
- Updates the same action if typing continues
- Shows real-time progress in the side panel
- Handles text corrections and deletions properly

### 2. Enter Key Recording (Critical for ChatGPT)
**The Problem**: The extension was only recording typing but not Enter key presses. This meant ChatGPT would just have text typed but never submitted.

**The Struggle**: This was a major oversight. I recorded a perfect conversation flow, but when I replayed it, ChatGPT just sat there with typed text that never got sent. I had to completely rethink the action recording system.

**The Solution**: Added separate `keypress` action type that:
- Records Enter key presses as distinct actions
- Replays them using Selenium's `Keys.RETURN`
- Ensures messages actually get submitted

### 3. ChatGPT's Login Popup Nightmare
**The Problem**: ChatGPT shows a login popup for non-authenticated users that blocks all interactions. My replay script would fail because it couldn't click through the popup.

**The Struggle**: This was incredibly frustrating. I'd record actions, but the replay would fail because of this popup. I spent 10 minutes trying to detect and handle it before realizing the real solution.

**The Solution**: 
- Record in incognito mode to get the popup and recognize that action

### 4. Complex Selector Generation
**The Problem**: ChatGPT uses complex CSS-in-JS selectors like `div.[display:var(--force-hide-label)]` that break during replay.

**The Struggle**: The exit button and search button had these crazy selectors that Selenium couldn't parse. I kept getting "invalid selector" errors.

**The Solution**: Implemented a priority-based selector system:
1. `data-testid` attributes (most stable)
2. `aria-label` attributes (good for buttons)
3. `title` attributes
4. CSS classes
5. Element hierarchy as last resort

### 5. Performance vs Accuracy Tradeoffs
**The Problem**: The replay was painfully slow, taking minutes to execute what should take seconds.

**The Struggle**: I initially preserved exact timing between actions, but this made replays take forever. Users don't want to wait 30 seconds for a 5-second interaction. This could be because of ChatGPT's dynamic loading, network delays, or other factors that make the site slower than expected.

**The Solution**: 
- Capped delays at 3 seconds maximum
- Reduced element wait times
- Removed character-by-character typing delays
- Prioritized speed over perfect timing reproduction

## Setup Instructions

### Prerequisites
- Node.js and npm
- Python 3.7+
- Google Chrome browser

### Installation

1. **Install Node.js dependencies:**
```bash
npm install
```

2. **Build the Chrome extension:**
```bash
npm run build
```

3. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

4. **Load the Chrome extension:**
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

### Usage

1. **Record actions:**
   - Click the extension icon to open the side panel
   - Click "Start Recording"
   - Perform your actions on any website
   - Click "Stop Recording"
   - Click "Download Trace" to save the JSON file

2. **Replay actions:**
```bash
python3 replay.py your-trace-file.json
```

### Test with My Example Trace
I've included a sample trace file that demonstrates the full functionality. Test it out:

```bash
python3 replay.py action-trace-2025-08-13T01-25-12-801Z.json
```

## File Structure
```
├── static/                 # Chrome extension files
│   ├── html/sidepanel.html
│   ├── css/sidepanel.css
│   └── js/
│       ├── content.js      # Records user actions
│       ├── sidepanel.js    # UI and controls
│       └── background.js   # Message handling
├── replay.py              # Python replay script
├── requirements.txt       # Python dependencies
├── package.json          # Node.js dependencies
└── manifest.json         # Extension manifest
```

## Key Technical Decisions

### Working with Given Information
I started with the knowledge that Chrome DevTools Recorder uses HTML selectors, which gave me a proven foundation to build upon. From there, I researched the tradeoffs between different approaches and decided to stick with what has been plausible. 

Same thing with the webpack, I knew about webpacks for Chrome Extensions and it was easier for me to use than just a new system.

## Lessons Learned

1. **Rapid iteration is crucial**: Using Cursor IDE enabled fast development cycles and quick debugging
2. **User experience matters**: Real-time feedback in the side panel was crucial
3. **Test with real scenarios**: ChatGPT's complexity revealed many edge cases
4. **Simple solutions often work best**: HTML selectors beat complex AI approaches

The implementation prioritizes practical usability over theoretical perfection, making it suitable for real-world automation tasks. This is rapid iteration, while it's not the perfect optimal solution, it's better than nothing. Also I had fun with this haha, it's interesting! To be honest, I can see the direction Altera can take with projects like this. Something like an AI user action for people who don't know where to click on websites, and having like a cursor that directs users instead of blindly guessing. That's just my two cents. 
