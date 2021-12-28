import { generateUpdateMiddleware } from "telegraf-middleware-console-time";
import { MenuMiddleware } from "telegraf-inline-menu";
import { Telegraf, Markup } from "telegraf";
import { menu } from "./menu.js";
import {
  getAccount,
  createAccount,
  getBalance,
  transferTokens,
  removeAccount,
} from "./utils.js";
import * as dotenv from "dotenv";
import redisClient from "./redisClient.js";
dotenv.config();

const token = process.env["BOT_TOKEN"];
if (!token) {
  throw new Error("BOT_TOKEN environment variable not present");
}

const bot = new Telegraf(token);

// middlewares
const menuMiddleware = new MenuMiddleware("/", menu);

bot.use(menuMiddleware.middleware());
bot.use(generateUpdateMiddleware());
bot.use(async (ctx, next) => {
  const ignoreMessages = [
    "new_chat_member",
    "left_chat_member",
    "new_chat_title",
  ];

  if (ctx.message && !ignoreMessages.some((x) => x in ctx.message!)) {
    if (ctx.message.from.username == undefined) {
      ctx.reply(
        "Your account needs a username for tipping. Please add a username to continue."
      );
      return;
    }

    const registered_commands = [
      "/tip",
      "/account",
      "/balance",
      "/withdraw",
      "/tipall",
      "/unregister",
    ];
    if (
      registered_commands.includes((ctx.message as any).text?.split(" ")[0]) ||
      registered_commands.includes((ctx.message as any).text?.split("@")[0])
    ) {
      const account = await getAccount(ctx.message.from.username);
      if (account == null) {
        ctx.replyWithMarkdown(
          `You are not registered. Use /register to open an account (in DM).`
        );
        return;
      }
    }
  }
  await next();
});

// commands
bot.command("start", async (context) => menuMiddleware.replyToContext(context));
bot.command("help", async (context) => {
  context.replyWithMarkdown(`DVPN Tip Bot\n
		/register : Open new account (only DM)\n
		/account : Get account address\n
		/balance : Get account balance\n
		/tip \`<tip_amount>\` \`<@user>\` : Tip user\n
		/tipall \`<tip_amount>\` \`<timeout hh(:mm)(:ss) {default=00:25:00}>\` : Tip everyone in the group. Creates a button for claiming. \n
		/withdraw \`<withdraw_amount>\` \`<address>\` : Withdraw available balance to address\n
	`);
});

bot.command("register", async (context) => {
  if (context.message.chat.type == "group") {
    context.replyWithMarkdown(`You can only run this command only in DM.`);
    return;
  }
  var account = await getAccount(context.message.from.username!);
  if (account != null) {
    context.replyWithMarkdown(
      `You are already registered with account address: \`${
        account!.address
      }\`\nUse /unregister to unregister`
    );
    return;
  }
  const { address, mnemonic } = await createAccount(
    context.message.from.username!
  );
  context.replyWithMarkdown(
    `Successfully registered. Your account address is: \`${address}\`.\nMnemonic: \`${mnemonic}\`\nFor further use refer \`/help\` command.`
  );
});

bot.command("unregister", async (context) => {
  await removeAccount(context.message.from.username!);
  context.replyWithMarkdown(`Successfully unregistered`);
});

bot.command("account", async (context) => {
  const account = await getAccount(context.message.from.username!);
  context.replyWithMarkdown(
    `Your account address is \`${
      account!.address
    }\`.\nYou can use this to deposit DVPN.`
  );
});

bot.command("balance", async (context) => {
  const balance = await getBalance(context.message.from.username!);
  const account = await getAccount(context.message.from.username!);
  context.replyWithMarkdown(
    `Your account (\`${account!.address}\`) balance is \`${balance} DVPN.\``
  );
});

bot.command("tip", async (context) => {
  var params = (context.message as any).text.split(" ");
  if (params.length != 3) {
    context.replyWithMarkdown(`Tipping requires two arguments. Refer /help.`);
    return;
  }
  const tokens = Number(params[1]);
  if (isNaN(tokens)) {
    context.replyWithMarkdown(`Provide valid token amount.`);
    return;
  }
  const username = context.message?.from?.username!;
  const recipientAccount = await getAccount(params[2].trim().slice(1));
  if (recipientAccount === null) {
    context.replyWithMarkdown(`Recipient has not registered.`);
    return;
  }
  const result = await transferTokens(
    username,
    recipientAccount!.address,
    tokens
  );
  if ((result as any).code) {
    console.log(result.rawLog);
    context.replyWithMarkdown(`Transaction failed: \`${result.rawLog}\`.`);
    return;
  }
  context.replyWithMarkdown(`Tip successful. (Tx: ${result.transactionHash})`);
});

bot.command("withdraw", async (context) => {
  var params = (context.message as any).text.split(" ");
  if (params.length != 3) {
    context.replyWithMarkdown(`Withdraw requires two arguments. Refer /help.`);
    return;
  }
  const tokens = Number(params[1]);
  if (isNaN(tokens)) {
    context.replyWithMarkdown(`Provide valid token amount.`);
    return;
  }
  const username = context.message?.from?.username!;
  const recipientAddress = params[2].trim();
  if (
    recipientAddress.slice(0, 4) !== "sent" ||
    recipientAddress.length != 43
  ) {
    context.replyWithMarkdown(`Invalid withdraw address.`);
    return;
  }
  const result = await transferTokens(username, recipientAddress, tokens);
  if ((result as any).code) {
    console.log(result.rawLog);
    context.replyWithMarkdown(`Transaction failed: \`${result.rawLog}\`.`);
    return;
  }
  context.replyWithMarkdown(
    `Withdraw successful. (Tx: ${result.transactionHash})`
  );
});

bot.command("tipall", async (context) => {
  if (context.message.chat.type != "group") {
    return context.replyWithMarkdown(
      `tipall command can be used in groups only.`
    );
  }
  var params = (context.message as any).text.split(" ");
  if (params.length > 3) {
    return context.replyWithMarkdown(
      `tipall accepts two arguments. Refer /help.`
    );
  }
  const tokens = Number(params[1]);
  if (isNaN(tokens)) {
    return context.replyWithMarkdown(`Provide valid token amount.`);
  }
  var timeout = 25 * 60;
  if (params.length == 3) {
    const timeString = params[2].split(":");
    timeout = Number(timeString[0]) * 60 * 60;
    timeout += timeString.length > 1 ? Number(timeString[1]) * 60 : 0;
    timeout += timeString.length > 2 ? Number(timeString[2]) : 0;
  }
  if (isNaN(timeout)) {
    context.replyWithMarkdown(`Provide valid time. Format hh(:mm)(:ss)`);
    return;
  }
  if (timeout > 48 * 60 * 60) {
    context.replyWithMarkdown(`Maximum timeout: 48 hrs`);
  }
  context
    .reply(
      `@${context.message.from.username} has issued a tip of ${tokens} DVPN for all the users. Claim yours with the button below`,
      Markup.inlineKeyboard([Markup.button.callback("claim", "claimTip")])
    )
    .then((res) => {
      const message_id = res.message_id.toString();
      redisClient.hSet(message_id, "tipper", context.message.from.username!);
      redisClient.hSet(message_id, "amount", tokens.toString());
      setTimeout(() => context.deleteMessage(res.message_id), timeout * 1000);
    });
  return;
});

bot.action("claimTip", async (context) => {
  const username = context.update.callback_query.from.username;
  if (username == undefined) {
    return context.answerCbQuery(
      "Your account needs a username to claim. Please add a username to continue."
    );
  }
  const message_id =
    context.update.callback_query.message!.message_id.toString();
  const tipper = (await redisClient.hGet(message_id, "tipper"))!;
  const tokens = Number((await redisClient.hGet(message_id, "amount"))!);
  if (username == tipper) {
    return context.answerCbQuery("You can not claim your own tip.");
  }
  if (await redisClient.SISMEMBER(message_id + "_tipped", username)) {
    return context.answerCbQuery("You have already claimed the tip");
  }
  const recipientAccount = await getAccount(username);
  if (recipientAccount === null) {
    context.answerCbQuery(`You are not registered with dvpntipbot.`);
    return;
  }
  const result = await transferTokens(
    tipper,
    recipientAccount!.address,
    tokens
  );
  if ((result as any).code) {
    console.log(result.rawLog);
    context.answerCbQuery(`Transaction failed: \`${result.rawLog}\`.`);
    return;
  }
  await redisClient.sAdd(message_id + "_tipped", username);
  return context.answerCbQuery(
    `Tip successfully claimed. (Tx: ${result.transactionHash})`
  );
});

bot.catch((error) => {
  console.error("telegraf error occured: ", error);
});

async function start(): Promise<void> {
  await bot.telegram.setMyCommands([
    { command: "start", description: "open the menu" },
    { command: "help", description: "view help" },
    { command: "register", description: "register (run in private)" },
    { command: "unregister", description: "unregister" },
    { command: "tip", description: "tip someone" },
    { command: "tipall", description: "tip everyone" },
    { command: "withdraw", description: "withdraw balance" },
    { command: "account", description: "account details" },
    { command: "balance", description: "account balance" },
  ]);

  await bot.launch();
  console.log(new Date(), "Bot started as", bot.botInfo?.username);
}

start();
