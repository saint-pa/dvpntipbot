import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {MenuMiddleware} from 'telegraf-inline-menu';
import {Telegraf} from 'telegraf';
import TelegrafSessionLocal from 'telegraf-session-local';

import {helpHandler, tipHandler, withdrawHandler, accountHandler} from './handlers.js';
import {MyContext} from './my-context.js';

import {menu} from './menu/index.js';

const token = process.env['BOT_TOKEN'];
if (!token) {
	throw new Error('BOT_TOKEN environment variable not present');
}

const bot = new Telegraf<MyContext>(token);

// middlewares
const localSession = new TelegrafSessionLocal({
	database: 'persist/sessions.json',
});

const menuMiddleware = new MenuMiddleware('/', menu);

bot.use(localSession.middleware());
bot.use(menuMiddleware.middleware());
bot.use(generateUpdateMiddleware());
bot.use(async (ctx, next) => {
	if(ctx.message?.from.username == undefined){
		ctx.reply("Your account needs a username for tipping. Please add a username to continue.");
	}
	await next();
})
  
// commands
bot.command('start', async context => menuMiddleware.replyToContext(context));
bot.command('help', async context => helpHandler(context));
bot.command('tip', async context => tipHandler(context));
bot.command('withdraw', async context => withdrawHandler(context));
bot.command('account', async context => accountHandler(context));

bot.catch(error => {
	console.error('telegraf error occured', error);
});

async function start(): Promise<void> {
	// The commands you set here will be shown as /commands like /start or /magic in your telegram client.
	await bot.telegram.setMyCommands([
		{command: 'start', description: 'open the menu'},
		{command: 'help', description: 'view help'},
		{command: 'tip', description: 'tip someone'},
		{command: 'withdraw', description: 'withdraw balance'},
		{command: 'account', description: 'account details'},
	]);

	await bot.launch();
	console.log(new Date(), 'Bot started as', bot.botInfo?.username);
}

start();
