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

Hold-and-move speed input is confined to the reader while the selector is hidden. Selection buttons handle Enter/Space explicitly and do not use drag capture. Repeated Surah swipes are limited to one change per 900 ms and cannot queue during loading. A speed drag suppresses only its immediate pointer click; keyboard activation remains available. Verify all input paths on the glasses.

The manual selector at index.html has no continuous-drag opt-in. Loading a passage navigates to reader.html, which opts into continuous drag in its initial CSS and restores the saved passage paused. Escape returns to index.html with a full navigation to reset the host input mode. Both pages register the same WebMCP passage tool. The app URL and selector layout remain the same.

The reader footer Play/Pause icon is a real button and receives initial focus. Select/Enter or clicking it toggles auto-scroll. Hold-and-move remains available from both the reader and the focused Play/Pause button.

WebMCP also registers navigate_quran_surah with direction next or previous. While a passage is displayed, ask Meta AI for the next or previous Surah. It opens one adjacent full chapter paused, stops at Surah 1/114, and uses the displayed chapter rather than unconfirmed selector edits.

WebMCP search_quran_verse_text accepts at least two consecutive Arabic words. It searches the plain Arabic Quran edition with diacritics/letter normalization while the reader keeps displaying Uthmani text. A unique result opens from that verse to the end of its Surah, paused; ambiguous results return up to 10 candidates and the total count, without changing the passage. No audio recording or speech recognition is added. The first search downloads the corpus; successful searches reuse it in memory.

Manual selection includes a ×1/×10/×50 step-size button. Activate it to cycle the increment used by both − and +. Values stay within the Surah/verse limits. Each selector field starts at ×1; choosing a step size never changes the number by itself.

When reopening the selector with a saved passage, Continue reading is focused first. Activate it once to open reader.html at the saved reading position, paused, without fetching or reselecting a passage. Down moves into the normal selector controls. First-time startup still focuses −.
