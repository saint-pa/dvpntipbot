import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {MenuMiddleware} from 'telegraf-inline-menu';
import {Telegraf} from 'telegraf';
import {MyContext} from './my-context.js';
import {menu} from './menu.js';
import {getAccount, getBalance, register, tip, withdraw} from './utils.js'
import {getDB,saveTX} from './db.js'
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env['BOT_TOKEN'];
if (!token) {
	throw new Error('BOT_TOKEN environment variable not present');
}

const bot = new Telegraf<MyContext>(token);

// middlewares

const menuMiddleware = new MenuMiddleware('/', menu);

bot.use(menuMiddleware.middleware());
bot.use(generateUpdateMiddleware());
bot.use(async (ctx, next) => {
	if(ctx.message?.from.username == undefined){
		ctx.reply("Your account needs a username for tipping. Please add a username to continue.");
		return
	}

	const registered_commands = ['/tip', '/account', '/balance', '/withdraw']
	if(registered_commands.includes((ctx.message as any).text?.split(' ')[0])){
		const { env, dbi } = getDB();
		const txn = env.beginTxn()
		const userKey = txn.getString(dbi,ctx.message.from.username)
		saveTX(txn, dbi, env)

		if (userKey === null){
			ctx.replyWithMarkdown(`You are not registered. Use /register command to open a free account first.`)
			return
		}
	}

	await next();
})

// commands
bot.command('start', async context => menuMiddleware.replyToContext(context));
bot.command('help', async context => {
	context.replyWithMarkdown(`DVPN Tip Bot\n
		/register : Open new account\n
		/account : Get account address\n
		/balance : Get account balance\n
		/tip \`tip_amount\` \`@user\` : Tip user\n
		/withdraw \`address\` : Withdraw available balance to address\n
	`)
});
bot.command('tip', async context => {
	tip(context)
});
bot.command('register', async context => {
	const { env, dbi } = getDB();
	const txn = env.beginTxn()
	const userKey = txn.getString(dbi,context.message.from.username!)
	saveTX(txn, dbi, env)

	if (userKey){
		const wallet = await getAccount(context.message.from.username!)
		const [account] = await wallet.getAccounts();
		context.replyWithMarkdown(`Your account address is \`${account!.address}\``)
		return
	}

	const wallet = await register(context.message.from.username!)
	const [account] = await wallet!.getAccounts();
	context.replyWithMarkdown(`Successfully registered. Your account address is: \`${account!.address}\`. For further use refer \`/help\` command.`)

})
bot.command('withdraw', async context => {withdraw(context)});

bot.command('account', async context => {
	const wallet = await getAccount(context.message?.from?.username!)
	
	const [account] = await wallet.getAccounts();

	context.replyWithMarkdown(`Your account address is \`${account!.address}\``)

});

bot.command('balance', async context => {
	const wallet = await getAccount(context.message?.from?.username!)

	getBalance(wallet).then(balance=>{
		console.log(balance)
		context.replyWithMarkdown(`Your account balance is \`${balance} DVPN\``)
	})

})

bot.command('setAddress', async context => {
	const { env, dbi } = getDB();
	const txn = env.beginTxn()

	txn.putString(dbi,context.message.from.username!,context.message.text.split(' ').slice(1,).join(' ')!)
	saveTX(txn, dbi, env)
})

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
		{command: 'balance', description: 'check account balance'},
		{command: 'register', description: 'register for dvpn tipbot account'},
	]);

	await bot.launch();
	console.log(new Date(), 'Bot started as', bot.botInfo?.username);
}

start();
