# Quran Teleprompter V2

This version no longer hard-codes a small list of verses.

On the glasses, enter the Surah number (1–114), select **التالي**, enter the Start verse, select **التالي**, enter the End verse, then select **تحميل**. The same text field is used for all three steps so the glasses' dictation or handwriting composer has one target. The app fetches the Uthmani Quran text from Al Quran Cloud and caches the selected passage locally.

After confirming the Surah, Start defaults to **1** and End defaults to **that Surah's last verse**. You can edit either before loading. Chapter selection uses built-in verse counts and never waits for a network request or disables the number field. Confirming a Surah again resets both defaults; moving between the verse steps preserves your edits.

Examples:
- Surah 17, 1–40
- Surah 16, 108–128
- Surah 2, 255–286
- Surah 36, 1–12

Controls:
- On the selection screen, select the number field to dictate or write its value. Swipe down to **التالي** and select it to move to the next step. **السابق** returns to the prior step. On the last step, select **تحميل** to load the passage.
- Enter/Space: play/pause
- Up/Down: scroll backward/forward by three quarters of a page, with overlap for reading. Manual scrolling pauses autoplay; Enter/Select resumes from that position.
- Left/Right without holding: previous/next Surah, loaded in full and paused. Stops at Surah 1 and 114.
- Hold and move right/left: increase/decrease autoplay speed (5–80). Every 25 pointer-coordinate units changes speed by 5. Requires Neural Band continuous drag; the direction and sensitivity need verification on real glasses. Initial body CSS opts in with `touch-action: none`.
- Escape: restart/show selector

Important: the first time you load a new passage, the glasses need internet access. Previously loaded passages are cached locally.

Source: Al Quran Cloud REST API. Its current terms say the Arabic Quran text may be reproduced/displayed for non-commercial use and request preservation of the Uthmani orthography.

If the glasses do not open dictation or handwriting, use the − / + buttons to change the current number. Up/Down moves between the number field, −, +, Next, and Back. Select activates the highlighted control.

## Meta AI / WebMCP

When `document.modelContext` is available, the app registers `open_quran_passage` at startup. Open the Quran app on the glasses first, then say: “Hey Meta, open Surah 16, verses 106 to 128.” You can also ask for “Surah 16, verse 106 to the end” or an entire Surah. `surah` is required; `fromVerse` defaults to 1 and `toVerse` defaults to the final verse. Invalid ranges and network failures return short explanations to Meta AI. Cancellation is forwarded to the Quran API request. The passage opens paused, ready to read.

The number field stays disabled and outside focus navigation; use − / + and Next for manual selection. WebMCP is optional and does not change the manual controls. Tool registration and mock tests do not prove Meta AI discovery on the glasses; test the spoken request on the device after reopening the app.

Hold-and-move speed input is temporarily disabled: global touch-action opt-in interfered with button activation on the glasses. Normal activation is restored. Surah swipes are limited to one change per 900 ms and cannot queue while a chapter loads.
