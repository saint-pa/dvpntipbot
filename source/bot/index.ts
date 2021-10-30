import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {MenuMiddleware} from 'telegraf-inline-menu';
import {Telegraf} from 'telegraf';
import TelegrafSessionLocal from 'telegraf-session-local';


import {MyContext} from './my-context.js';
import {menu} from './menu/index.js';

const token = process.env['BOT_TOKEN'];
if (!token) {
	throw new Error('BOT_TOKEN environment variable not present');
}

const bot = new Telegraf<MyContext>(token);

const localSession = new TelegrafSessionLocal({
	database: 'persist/sessions.json',
});

bot.use(localSession.middleware());

if (process.env['NODE_ENV'] !== 'production') {
	// Show what telegram updates (messages, button clicks, ...) are happening (only in development)
	bot.use(generateUpdateMiddleware());
}

bot.command('help', async context => context.reply('this is some help'));

bot.command('withdraw', async context => {
	return context.reply('withdraw');
});
bot.command('account', async context => {
	return context.reply('account');
});
bot.command('balance', async context => {
	return context.reply('balance');
});
bot.command('tip', async context => {
	return context.reply('tip');
});

const menuMiddleware = new MenuMiddleware('/', menu);
bot.command('start', async context => menuMiddleware.replyToContext(context));
bot.use(menuMiddleware.middleware());

bot.catch(error => {
	console.error('telegraf error occured', error);
});

export async function start(): Promise<void> {
	// The commands you set here will be shown as /commands like /start or /magic in your telegram client.
	await bot.telegram.setMyCommands([
		{command: 'start', description: 'open the menu'},
		{command: 'tip', description: 'tip someone'},
		{command: 'withdraw', description: 'withdraw balance'},
		{command: 'account', description: 'account details'},
		{command: 'balance', description: 'check balance'},
		{command: 'register', description: 'resgister account'},
	]);

	await bot.launch();
	console.log(new Date(), 'Bot started as', bot.botInfo?.username);
}
