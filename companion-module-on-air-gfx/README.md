# Companion module: ON-AIR-GFX

Bitfocus Companion module to control ON-AIR-GFX: polls, Q&A public toggles, and play/cue/stop Q&A questions. Same pattern as the Run of Show Companion module: **Railway URL + Event ID** only (no API key).

## Requirements

- The ON-AIR-GFX **Railway** app (live-csv-server) deployed with the Companion API routes under `/companion-api`.
- Your Railway app’s public URL plus `/companion-api` as the base URL in the module.

## Module config

1. **Railway API URL** – Base URL including path, e.g.  
   `https://your-app.up.railway.app/companion-api`
2. **Event ID** – The event ID from the ON-AIR-GFX web app (Event detail or Operators page).
3. **Poll interval** – How often the module refreshes events/polls/Q&A (10–120 seconds).

## Actions

- **Set poll active (output)** – Turn a poll on/off for output (Play/Stop in Operators).
- **Toggle poll public** – Show/hide poll on the public event page (audience can vote).
- **Toggle Q&A session public** – Show/hide Q&A session on the public page.
- **Play question** – Take a question live (same as “Play” in Operators).
- **Cue question** – Set a question as next (same as “Cue” in Operators).
- **Stop current Q&A question** – Clear the live Q&A question.

## Feedbacks

- Poll active / Poll public  
- Q&A session public  
- Question active (live) / Question cued (next)

## Variables

- Event name  
- Active poll title  
- Active Q&A question text  
- Cued question text  

## Building

```bash
yarn install
yarn package
```

Then install the generated package into Companion (see [Companion module development](https://github.com/bitfocus/companion/wiki/Module-Development)).
