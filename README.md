# apl's lazer ref client


## Setup

create a `config.json` file:
```
{
  "client_id": "46401",
  "client_secret": "yourClientSecretHere"
}
```
Make sure that (one of) the redirect URLs is localhost:8084.

## Running

```
npm i
npm start
```

For editing, run this to keep the tailwind css up to date:
```
npx @tailwindcss/cli -i ./src/renderer/css/tailwind-input.css -o ./src/renderer/css/tailwind.css  --watch
```
