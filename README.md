# dvpntipbot

[![dependencies Status](https://status.david-dm.org/gh/EdJoPaTo/telegram-typescript-bot-template.svg)](https://david-dm.org/EdJoPaTo/telegram-typescript-bot-template)
[![devDependencies Status](https://status.david-dm.org/gh/EdJoPaTo/telegram-typescript-bot-template.svg?type=dev)](https://david-dm.org/EdJoPaTo/telegram-typescript-bot-template?type=dev)

## Install

```sh
$ npm install
```


## Start the bot

### Local development

```sh
$ mkdir persist
```

Then go ahead and start the bot

```sh
$ npm start
```

### Production

The container is meant to be used with a secret containing your bot token: `/run/secrets/bot-token.txt`.
Alternatively, you can supply it via the environment variable named `BOT_TOKEN`.

The container has one volume (`/app/persist`) which will contain persistent data your bot creates.
Make sure to explicitly use that volume (for example, make sure it's synced or tied to the host in a multi-node setup).

## Basic Folder structure example

- `source` contains your TypeScript source files. Subfolders contain specifics about your implementation
  - `bot` may contain files relevant for the telegram bot
    - `menu` may contain specifics about the bot, the menu that is shown on /start
  - `magic` may contain something relevant for doing magic. It is not relevant to the bot directly but it is used by it.
- `test` contains test files
- `locales` contains translation strings for your bot. That way it can speak multiple languages.
- `dist` will contain transpiled JavaScript files.
- `persist` will contain persistent data your bot uses. Make sure to keep that data persistent (Backups for example).