# Stockfish Local Integration

A high-performance Chrome Extension that runs the Stockfish chess engine directly in the browser using WebAssembly (WASM). This tool performs local analysis on third-party chess websites without sending game data to external servers, ensuring low latency and privacy.

## Overview

This extension injects a local instance of Stockfish into the web page. It observes the DOM for moves, translates them from Standard Algebraic Notation (SAN) to Long Algebraic Notation (LAN), and computes the best move and evaluation score in real-time.

## Key Features

- **Local WASM Execution:** Runs Stockfish entirely client-side using Web Workers. No backend API is required.
- **Perspective-Aware Evaluation:**
  - The evaluation score (+/-) adjusts based on the selected player color.
  - Positive values always indicate the selected player is winning.
  - Negative values indicate the selected player is losing.
- **Automatic Move Translation:** Integrated with chess.js to robustly translate board moves (e.g., "Nf3") into the format required by Stockfish (e.g., "g1f3").
- **CORS & CSP Bypass:** Uses a specific Blob-based loading strategy to bypass Manifest V3 security restrictions, allowing the WASM engine to compile and run on third-party domains.
- **Visual Overlay:** Draws arrows on the board indicating the best calculated move.

## Project Structure

Ensure your directory is organized as follows:

/project-root
├── manifest.json # Extension configuration (Manifest V3)
├── ui.js # UI Injection and DOM Observer
├── engine-service.js # Engine Controller, Worker management, and Translation logic
├── styles.css # UI Styling
└── engine/ # Engine Assets
├── stockfish.js # Stockfish Engine Script
├── stockfish.wasm # WebAssembly Binary
└── chess.js # Chess logic library

## Installation

1. Clone or download the repository to a local folder.
2. Open Google Chrome and navigate to: chrome://extensions
3. Enable "Developer mode" using the toggle switch in the top right corner.
4. Click the "Load unpacked" button.
5. Select the root folder of this project.
6. The extension should now appear in your list.

## Usage

1. Navigate to a supported chess website (e.g., Chess.com) and open a game or analysis board.
2. The "STOCKFISH LOCAL" panel will appear on the screen.
3. Select your side:
   - Click "WHITE" if you are playing/analyzing as White.
   - Click "BLACK" if you are playing/analyzing as Black.
   - Note: Selecting the correct color ensures the evaluation score (+/-) is accurate for your perspective.
4. Set the Depth (default is 15) to control the strength of the analysis.
5. As moves are made on the board, the extension will automatically calculate and display the best reply.

## Technical Implementation Details

- **Engine Loading:** To comply with Chrome's Same-Origin Policy and Manifest V3, the engine is loaded by fetching the script source as text and creating a Blob URL. This allows the Worker to initialize with the correct relative paths for the WASM binary.
- **Move Sanitization:** Stockfish requires Long Algebraic Notation (LAN). The service uses chess.js to validate the board state and convert the visual moves (SAN) into LAN before sending commands to the engine.
- **Synchronization:** The service implements a job queue to ensure "position" and "go" commands are sent in strict sequence, preventing race conditions during rapid board updates.

## Disclaimer

This tool is intended for educational purposes, local analysis, and debugging. Using engine assistance during live games against human opponents on competitive platforms is a violation of Fair Play policies and may result in account suspension.

## Credits

- Stockfish Chess Engine (GPLv3)
- Chess.js (BSD)
