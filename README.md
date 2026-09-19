# BLOOM

Soft neon merge garden. Aim, drop, bloom.

Candy cubes fall into a tall dusk-purple well. Line up **three or more** of the same color and size — they dissolve into a petal bloom and become **one larger cube**. Chains cascade. Don’t cross the dotted line.

## Play

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## Build

```bash
npm run build
```

Static files land in `dist/`. Preview the production build with `npm run preview`.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Aim | A / D, ← / →, or mouse | drag |
| Drop | Space, Enter, or click | tap |
| Start / again | Space or the button | tap |

## How it works

- One cube at a time. A faint ghost shows where it will land.
- **3+** matching cubes that touch up / down / left / right **bloom**.
- A bloom becomes the next tier (bigger, glowier). Max-tier blooms **clear** for a burst of score.
- Cascades multiply your combo. High score is stored in `localStorage` (`bloom-best`).

No accounts, no backend, no ads.
