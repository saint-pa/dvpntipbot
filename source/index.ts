import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {MenuMiddleware} from 'telegraf-inline-menu';
import {Telegraf} from 'telegraf';
import {menu} from './menu.js';
import {getAccount, createAccount, getBalance, transferTokens} from './utils.js'
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env['BOT_TOKEN'];
if (!token) {
	throw new Error('BOT_TOKEN environment variable not present');
}

const bot = new Telegraf(token);

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
		const account = await getAccount(ctx.message.from.username);
		if (account == null){
			ctx.replyWithMarkdown(`You are not registered. Use /register to open an account.`)
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
		/tip \`<tip_amount>\` \`<@user>\` : Tip user\n
		/withdraw \`<withdraw_amount>\` \`<address>\` : Withdraw available balace to address\n
	`)
});

bot.command('register', async context => {
	var account = await getAccount(context.message.from.username!);
	if (account != null){
		context.replyWithMarkdown(`You are already registered with account address: \`${account!.address}\``)
		return;
	}

	const {address, mnemonic} = await createAccount(context.message.from.username!)
	context.replyWithMarkdown(`Successfully registered. Your account address is: \`${address}\`.\nMnemonic: \`${mnemonic}\`\nFor further use refer \`/help\` command.`)

});
// bot.command('withdraw', async context => return context.reply('hello'));

bot.command('account', async context => {
	const account = await getAccount(context.message.from.username!);
	context.replyWithMarkdown(`Your account address is \`${account!.address}\`.\nYou can use this to deposit DVPN.`)
});

bot.command('balance', async context => {
	console.log(context.message.from.username!);
	const balance = await getBalance(context.message.from.username!);	
	const account = await getAccount(context.message.from.username!);
	context.replyWithMarkdown(`Your account (\`${account!.address}\`) balance is \`${balance} DVPN.\``)
})

bot.command('tip', async context => {
    var params = (context.message as any).text.split(' ');
	if (params.length != 3) {
		context.replyWithMarkdown(`Tipping requires two arguments. Refer /help.`);
		return;
	}
	const tokens = Number(params[1]);
	if (tokens === NaN){
		context.replyWithMarkdown(`Provide valid token amount.`);
		return;
	}
	const username = context.message?.from?.username!;
	const recipientAccount = await getAccount(params[2].trim().slice(1,));
	if (recipientAccount === null){
        context.replyWithMarkdown(`Recipient has not registered.`);
        return;
    }
	console.log()
	const result = await transferTokens(username, recipientAccount!.address, tokens);
	if ((result as any).code){
		context.replyWithMarkdown(`Transaction failed: \`${result.rawLog}\`.`);
		return;
	}
	context.replyWithMarkdown(`Tip successful.`);
});

bot.command('withdraw', async context => {
    var params = (context.message as any).text.split(' ');
	if (params.length != 3) {
		context.replyWithMarkdown(`Withdraw requires two arguments. Refer /help.`);
		return;
	}
	const tokens = Number(params[1]);
	if (tokens === NaN){
		context.replyWithMarkdown(`Provide valid token amount.`);
		return;
	}
	const username = context.message?.from?.username!;
	const recipientAddress = params[2].trim();
	if (recipientAddress.slice(0,4)!=='sent' || recipientAddress.length != 43){
		context.replyWithMarkdown(`Invalid withdraw address.`)
		return
	}
	const result = await transferTokens(username, recipientAddress, tokens);
	if ((result as any).code){
		context.replyWithMarkdown(`Transaction failed: \`${result.rawLog}\`.`);
		return;
	}
	context.replyWithMarkdown(`Withdraw successful.`);
})
bot.catch(error => {
	console.error('telegraf error occured: ', error);
});

async function start(): Promise<void> {
	// The commandsu you set here will be shown as /commands like /start or /magic in your telegram client.
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
