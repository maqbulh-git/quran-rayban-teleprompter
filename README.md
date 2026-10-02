# Quran Teleprompter V2

This version no longer hard-codes a small list of verses.

On the glasses, enter the Surah number (1–114), select **التالي**, enter the Start verse, select **التالي**, enter the End verse, then select **تحميل**. The same text field is used for all three steps so the glasses' dictation or handwriting composer has one target. The app fetches the Uthmani Quran text from Al Quran Cloud and caches the selected passage locally.

After confirming the Surah, Start defaults to **1** and End defaults to **that Surah's last verse**. You can edit either before loading. Confirming a Surah again resets both defaults; moving between the verse steps preserves your edits.

Examples:
- Surah 17, 1–40
- Surah 16, 108–128
- Surah 2, 255–286
- Surah 36, 1–12

Controls:
- On the selection screen, select the number field to dictate or write its value. Swipe down to **التالي** and select it to move to the next step. **السابق** returns to the prior step. On the last step, select **تحميل** to load the passage.
- Enter/Space: play/pause
- Up/Down: scroll backward/forward by three quarters of a page, with overlap for reading. Manual scrolling pauses autoplay; Enter/Select resumes from that position.
- Left/Right: decrease/increase autoplay speed
- Escape: restart/show selector

Important: the first time you load a new passage, the glasses need internet access. Previously loaded passages are cached locally.

Source: Al Quran Cloud REST API. Its current terms say the Arabic Quran text may be reproduced/displayed for non-commercial use and request preservation of the Uthmani orthography.
