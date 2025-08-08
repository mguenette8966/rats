# Grace & the Three Rats (Browser Game)

A small 3D browser game built with Babylon.js. Control Grace with mouse and keyboard to find Rio, Chunk, and Snickerdoodle in a small town, then return home to win.

## How to run

1. Start a static web server in this folder:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

2. Open your browser to:

- `http://127.0.0.1:8080/index.html`

## Controls

- WASD / Arrow keys: Forward/Back + Strafe Left/Right
- Mouse move: Turn Grace (yaw)
- Hold Left Mouse: Sprint (2x speed)
- Space: Interact (pick up nearby rat)

## Notes

- Buildings and roads are procedurally placed each load; rats spawn randomly near buildings.
- When you are within a few meters of a rat, their name appears. Press `E` to pick it up.
- After all three are found, head back to the `Home` marker to win.
