<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# car_relay

## Structure

- `backend/server.ts`: local relay backend entry
- `backend/config/cameras_config.json`: local camera config used by the relay backend
- `src/`: frontend code
- `restart.bat`: Windows local startup script

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Check or create `.env.local`
3. Set at least:
   - `PORT=3100`
   - `API_PREFIX=/relay-api`
   - `REMOTE_COLLECTOR_URL=http://127.0.0.1:5001`
4. Start:
   `restart.bat`

## Notes

- The relay backend no longer depends on `../radar_tracker` for runtime config.
- Default camera config is stored in `backend/config/cameras_config.json`.
- The local backend API is namespaced under `/relay-api` to reduce route conflicts.
