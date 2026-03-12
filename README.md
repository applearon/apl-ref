# apl's lazer ref client


## Setup

TODO: explain how to get OAuth setup
Make sure that (one of) the redirect URLs is localhost:8084.

## Running

```
npm i
npm start
```

## Compile
```
npm run make -- --platform=win32
```
You can change or omit `-- --platform=win32` depending on what platform you build for. By default, it will build as a bundled zip.

For editing, run this to keep the tailwind css up to date:
```
npx @tailwindcss/cli -i ./src/renderer/css/tailwind-input.css -o ./src/renderer/css/tailwind.css  --watch
```
