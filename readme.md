# MateIt

_Because "Fair Play" is just a suggestion._

**_Freedom is your best camouflage:_**

You don't have to follow the engine like a sheep. You can play your own moves, make your own mistakes, and only call in the airstrike when you really need it. Use it just for the endgame, just to fix a blunder, or not at all.

Mixing human stupidity with machine intelligence is the best way to avoid getting banned. But be warned: if you use it on every single move, not even God (or the site engineers) can save your account.

## Overview

**MateIt** is a browser extension that runs the strongest chess engine directly in your browser tab. It watches the board and tells you exactly what the best move is without sending a single byte of data to an external server.

It's fast, it's private, and it's probably better at chess than all of us combined.

## Installation

Since this is a custom tool for the discerning developer (that's you), it's installed via Developer Mode.

1. Download the latest release of repository and extract the zip
2. Open Chrome and type `chrome://extensions` in the address bar.
3. Flip the "Developer mode" switch in the top right corner.
4. Click "Load unpacked."
5. Select the folder where you saved extracted files.
6. Go to a chess website and look for the new panel. If you don't see it, refresh the page.

You can also built from the latest source code by running `npm install` followed by `npm run build`. This will create `dist` folder containing the extension. Then install the extension as explained above and you are done.

## Usage

Using the tool is wayyy more easier than checkmating with a King and Rook.

1. **The Panel:** You will see a small overlay on the screen when you go to _chess.com_. It will appear automatically, you don't need to do anything.
2. **Pick a Side:**
   - Click **WHITE** if you are playing the white pieces.
   - Click **BLACK** if you are playing the black pieces.
   - _Pro Tip: Ensure this matches your actual color, or the engine will tell you how to lose most efficiently._
3. **Depth:** The default depth is 15. This is usually enough to beat a Grandmaster. Crank it up if you have patience and a good CPU; turn it down if you want instant (but slightly less god-like) advice.
4. **The Evaluation:**
   - A positive score (e.g., +1.50) means **YOU** are winning.
   - A negative score (e.g., -2.00) means **YOU** are in trouble.
   - "M3" means you have a forced mate in 3. Don't mess it up.

## Disclaimer

**Read this part carefully.**

This extension is built for analysis, debugging, and educational purposes. It is a powerful tool that runs locally.

However, using computer assistance during live games against human opponents on platforms like Chess.com is strictly forbidden. It is unfair, against the rules, and will result in your account being banned. Use this tool responsibly—analyze your own games _after_ they are finished, or test it against bots. If you get banned for cheating, that is entirely on you.

## Credits

- **Stockfish:** The engine doing all the heavy lifting. Distributed under GPLv3.
- **Chess.js:** The library that translates "Knight to f3" into something the engine actually understands.
- **Me:** For building this thing.
- **You:** For actually reading the using it.
