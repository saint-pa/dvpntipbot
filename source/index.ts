import { generateUpdateMiddleware } from "telegraf-middleware-console-time";
import { Telegraf, Markup, Telegram } from "telegraf";
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
      "/makeitrain",
      "/bet",
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
bot.command("start", async (context) => {
  context.replyWithMarkdown(`
Hello, Welcome to DVPN Tip Bot\n
Use /register in DM to register a wallet with the bot
Use /help to get more information on each command\n
Warning: Use this wallet ONLY as a HOT wallet (\`https://bit.ly/3nh0nIb\`) 
	`);
});

bot.command("help", async (context) => {
  context.replyWithMarkdown(`DVPN Tip Bot\n
		/register : Open new account (only DM)\n
		/account : Get account address\n
		/balance : Get account balance\n
		/tip \`<tip_amount>\` \`<@user>\` : Tip user (eg. /tip 100 @dvpntipbot)\n
		/tipall \`<tip_amount>\` \`<timeout hh(:mm)(:ss) {default=00:25:00}>\` \`<tip_limit>\` : Tip everyone in the group. Creates a button for claiming. (eg. /tipall 100 1:30:00 1000)\n
		/makeitrain \`<no of users>\` \`<tip_amount_per_user>\` : Tip random registered users. (eg. /makeitrain 5 10)\n
		/withdraw \`<withdraw_amount>\` \`<address>\` : Withdraw available balance to address\n
		/bet open \`<amount>\` \`<timeout hh(:mm)(:ss)>\` : Open a bet\n
		/bet accept \`<bet_id>\`: Accept a bet\n
		/bet list: List all open bets
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
      `You are already registered with account address: \`${account!.address
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
    `Your account address is \`${account!.address
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
  if (params.length > 4) {
    return context.replyWithMarkdown(
      `tipall accepts two arguments. Refer /help.`
    );
  }
  const tokens = Number(params[1]);
  if (isNaN(tokens)) {
    return context.replyWithMarkdown(`Provide valid token amount.`);
  }
  var timeout = 25 * 60;
  if (params.length > 2) {
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

  var tokens_limit = -1
  if (params.length > 3) {
    tokens_limit = Number(params[3]);
    if (isNaN(tokens_limit)) {
      return context.replyWithMarkdown(`Provide valid token limit amount.`);
    }
  }

  context
    .reply(
      `@${context.message.from.username} has issued a tip of ${tokens} DVPN for all the users. Claim yours with the button below.` + ((tokens_limit != -1) ? ` Pool limit is ${tokens_limit} DVPN` : ""),
      Markup.inlineKeyboard([Markup.button.callback("claim", "claimTip")])
    )
    .then((res) => {
      const message_id = res.message_id.toString();
      redisClient.hSet(message_id, "tipper", context.message.from.username!);
      redisClient.hSet(message_id, "amount", tokens.toString());
      redisClient.hSet(message_id, "token_limit", tokens_limit.toString());
      redisClient.hSet(message_id, "claimed", "0");
      setTimeout(() => context.deleteMessage(res.message_id), timeout * 1000);
    });
  return;
});

bot.command("makeitrain", async (context) => {
  var params = (context.message as any).text.split(" ");
  if (params.length != 3) {
    context.replyWithMarkdown(`makeitrain command requires two arguments. Refer /help.`);
    return;
  }
  const tokens = Number(params[2]);
  if (isNaN(tokens)) {
    context.replyWithMarkdown(`Provide valid token amount.`);
    return;
  }
  const users = Number(params[1]);
  var userList: { [id: string]: string } = {}
  var number_of_tries = 0
  while (Object.keys(userList).length < users) {
    try {
      number_of_tries += 1
      if (number_of_tries > users * 100) {
        context.replyWithMarkdown(`Couldn't find enough users`);
        return;
      }
      const user_key = (await redisClient.randomKey())!
      const mnemonic = (await redisClient.get(user_key))!
      if (!(user_key in userList) && [12, 24].includes(mnemonic.split(" ").length)) {
        const recipientAccount = await getAccount(user_key);
        if (recipientAccount !== null) {
          userList[user_key!] = recipientAccount!.address!
        }
      }
    }
    catch { }
  }
  context.replyWithMarkdown(`Users being tipped ${tokens} DVPN:\n\`${Object.keys(userList).join('\n')}\``);
  const username = context.message?.from?.username!;
  for (var user_key in userList) {
    const result = await transferTokens(
      username,
      userList[user_key]!,
      tokens
    );
    if ((result as any).code) {
      console.log(result.rawLog);
      context.replyWithMarkdown(`Transaction failed to @${user_key}: \`${result.rawLog}\`.`);
    }
    context.replyWithMarkdown(`Tip successful to @${user_key}. (Tx: ${result.transactionHash})`);
  }
});

const formatTime = (seconds: number) => {
  seconds = (seconds / 1000)
  return [
    Math.floor(seconds / 60 / 60),
    Math.floor(seconds / 60 % 60),
    Math.floor(seconds % 60)
  ]
    .join(":")
    .replace(/\b(\d)\b/g, "0$1")
}

const concludeBet = async (context: any, betId: string) => {
  redisClient.sRem('open_bets', betId)

  const username = await redisClient.hGet(betId, 'username')
  const amount = await redisClient.hGet(betId, 'amount')
  const participants: { id: number, username: string }[] = JSON.parse((await redisClient.hGet(betId, 'participants'))!)
  if (participants.length < 2) {
    return context.replyWithMarkdown(`Not enough participants for the bet with Id: ${betId}`)
  }
  const startMessage = await context.replyWithMarkdown(`Rolling dice for bet with ID: ${betId}. The winning numbers are:\n` + participants.map((mem, index) => `${index + 1} : @${mem.username}`).join('\n'))
  var diceMessage = await context.replyWithDice()
  var diceRoll = diceMessage.dice.value - 1
  while (diceRoll >= participants.length) {
    diceMessage = await context.replyWithDice()
    diceRoll = diceMessage.dice.value - 1
  }

  const winnerMessage = await context.replyWithMarkdown(`Winner of the ${amount} DVPN bet was @${participants[diceRoll]!.username}`)
  const telegram = new Telegram(token)
  for (var member of participants) {
    if (member.id != context.chat.id) {
      telegram.forwardMessage(member.id, context.chat.id, startMessage.message_id)
      telegram.forwardMessage(member.id, context.chat.id, diceMessage.message_id)
      telegram.forwardMessage(member.id, context.chat.id, winnerMessage.message_id)
    }
  }

  if (participants[diceRoll]!.username != username) {
    const recipientAccount = await getAccount(participants[diceRoll]!.username);
    const result = await transferTokens(
      username!,
      recipientAccount!.address,
      parseFloat(amount!)
    );
    if ((result as any).code) {
      console.log(result.rawLog);
      context.replyWithMarkdown(`Transaction failed: \`${result.rawLog}\`.`);
      return;
    }
    context.replyWithMarkdown(`Transaction of ${amount} DVPN successful. (Tx: ${result.transactionHash})`);
  }
  redisClient.hDel(betId, ['username', 'chat_id', 'amount', 'expiry', 'participants'])

}

bot.command("bet", async (context) => {
  var params = (context.message as any).text.split(" ");
  const now = new Date().getTime()

  if (params[1] == 'open') {
    const betId = context.message.message_id.toString()

    if (params.length > 4) {
      return context.replyWithMarkdown(
        `bet open accepts two arguments. Refer /help.`
      );
    }
    const tokens = Number(params[2]);
    if (isNaN(tokens)) {
      return context.replyWithMarkdown(`Provide valid token amount.`);
    }
    const balance = await getBalance(context.message.from.username!);
    if (parseFloat(balance) < tokens) {
      return context.replyWithMarkdown(`You don't have enough tokens to place the bet`);
    }
    var timeout = 30 * 60;
    if (params.length == 4) {
      const timeString = params[3].split(":");
      timeout = Number(timeString[0]) * 60 * 60;
      timeout += timeString.length > 1 ? Number(timeString[1]) * 60 : 0;
      timeout += timeString.length > 2 ? Number(timeString[2]) : 0;
    }

    timeout = timeout * 1000

    redisClient.sAdd('open_bets', betId)

    redisClient.hSet(betId, "username", context.from.username!)
    redisClient.hSet(betId, 'amount', tokens.toString())
    redisClient.hSet(betId, 'expiry', (now + timeout).toString())
    redisClient.hSet(betId, 'participants', JSON.stringify([
      { id: context.from.id, username: context.from.username }
    ]))

    setTimeout(() => concludeBet(context, betId), timeout)
    return context.replyWithMarkdown(`Bet successfully placed\nBet Id: ${betId}`)
  }
  else if (params[1] == 'accept') {
    if (params.length > 3) {
      return context.replyWithMarkdown(
        `bet accept accepts one arguments. Refer /help.`
      );
    }
    const betId = params[2]
    const expiry = await redisClient.hGet(betId, 'expiry')
    const tokens = await redisClient.hGet(betId, 'amount')
    const balance = await getBalance(context.message.from.username!);
    if (parseFloat(balance) < parseFloat(tokens!)) {
      return context.replyWithMarkdown(`You don't have enough tokens to accept the bet`);
    }
    if (expiry && parseInt(expiry) > now) {
      const username = context.from.username!
      const id = context.from.id!
      let participants: { id: number, username: string }[] = JSON.parse((await redisClient.hGet(betId, 'participants'))!)
      if (!participants.map(obj => obj.username).includes(username)) {
        participants.push({ id: id, username: username })
        redisClient.hSet(betId, 'participants', JSON.stringify(participants))
        return context.replyWithMarkdown(`Joined the bet successfully`)
      }
      else {
        return context.replyWithMarkdown(`You are already a part of this bet.`);
      }
    }
  }
  else if (params[1] == 'list') {
    const header = `Following are the open bets\n${'='.repeat(10)}\n`
    let bets_info = []
    const all_bets = await redisClient.sMembers('open_bets')
    for (var betId of all_bets) {
      const username = await redisClient.hGet(betId, 'username')
      const amount = await redisClient.hGet(betId, 'amount')
      const expiry = await redisClient.hGet(betId, 'expiry')
      const participants = await redisClient.hGet(betId, 'participants')

      if (expiry && parseInt(expiry) > now) {
        const duration = (parseInt(expiry) - now)
        bets_info.push(`\`Bet_ID\`: ${betId}\n\`User\`: @${username}\n\`Amount\`: ${amount}\n\`Expiry_in\`: ${formatTime(duration)}\n\`Participants\`: ${JSON.parse(participants!).length}/6`)
      }
    }
    if (bets_info.length == 0) {
      return context.replyWithMarkdown(`There are no open bets`)
    }
    return context.replyWithMarkdown(header + bets_info.join(`\n${"-".repeat(15)}\n`))
  }
  else if (params[1] == 'close') {
    const betId = params[2]
    concludeBet(context, betId)
  }
  else {
    return context.replyWithMarkdown(`Betting has three modes:
    /bet open \`<amount>\` \`<timeout hh(:mm)(:ss)>\`
    /bet accept \`<bet_id|username>\`
    /bet list`
    );
  }
  return
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
  const tokens_limit = await redisClient.hGet(message_id, "token_limit")
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
  if (tokens_limit) {
    const claimed = await redisClient.HINCRBY(message_id, "claimed", 1)
    console.log(claimed)
    if (tokens != -1 && tokens * claimed > Number(tokens_limit)) {
      return context.answerCbQuery(
        "Tokens limit reached."
      );
    }
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
    { command: "start", description: "get started" },
    { command: "help", description: "view help" },
    { command: "register", description: "register (run in private)" },
    { command: "unregister", description: "unregister" },
    { command: "tip", description: "tip someone" },
    { command: "tipall", description: "tip everyone" },
    { command: "makeitrain", description: "tip random registered users" },
    { command: "withdraw", description: "withdraw balance" },
    { command: "account", description: "account details" },
    { command: "balance", description: "account balance" },
    { command: "bet", description: "place bets" },
  ]);

  await bot.launch();
  console.log(new Date(), "Bot started as", bot.botInfo?.username);
}

start();
