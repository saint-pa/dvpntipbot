import {MyContext} from './my-context'
import { spawnSync } from 'child_process';
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, assertIsBroadcastTxSuccess } from "@cosmjs/stargate";
import {getDB,saveTX} from './db.js'
// import { assertIsBroadcastTxSuccess, SigningStargateClient } from "@cosmjs/stargate";

let udvpnToDvpn = (udvpn:string) => (Number(udvpn)/1000000).toFixed(6)

export async function register(username: string) {
    const { env, dbi } = getDB();
	const txn = env.beginTxn()

    if (txn.getString(dbi,username)===null){
        console.log(`Create new account for ${username}`)
        var child = spawnSync('sentinelcli', ['keys', 'add', '--keyring-backend', 'test', username], { input:'y\n' })
        console.log(child)
        const mnemonic = String(child.stderr).replace(/\n/g,' ').split(' ').slice(-25,-1).join(' ')
        txn.putString(dbi,username,mnemonic)
    }

    saveTX(txn, dbi, env)

    return getAccount(username)

}

export async function getAccount(username:string) {

    const { env, dbi } = getDB();
	const txn = env.beginTxn()
    // const username = context.message?.from?.username!
    const mnemonic = txn.getString(dbi,username)

    saveTX(txn, dbi, env)

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic!, {prefix:"sent"});

    return wallet

}

export async function getBalance(wallet: DirectSecp256k1HdWallet) {
    const [account] = await wallet.getAccounts();

    const rpcEndpoint = "https://rpc.sentinel.co";
    const client = await SigningStargateClient.connect(rpcEndpoint);

    const balance =  await client.getBalance(account!.address,'udvpn');
    return udvpnToDvpn(balance.amount)
}

export async function tip(context:MyContext) {
    console.log(context.message)
    console.log((context.message as any).entities?.slice())
    const username = context.message?.from.username!
    var text = (context.message as any).text.split(' ')
	if (text.length != 3) {
		context.replyWithMarkdown(`Tipping requires two arguments. Refer /help`)
        return
	}
    const tokens = Number(text[1])
    console.log(tokens)
    if (tokens === NaN){
        context.replyWithMarkdown(`Provide valid token amount`)
        return
    }
    const recipientUsername = text[2]
    const { env, dbi } = getDB();
	const txn = env.beginTxn()
    // const username = context.message?.from?.username!
    const mnemonic_recipient = txn.getString(dbi,recipientUsername.slice(1,))

    saveTX(txn, dbi, env)    
    if (mnemonic_recipient === null){
        context.replyWithMarkdown(`Recipient has not registered with DVPN Tip Bot`)
        return
    }

    const recipientWallet = await getAccount(recipientUsername.slice(1,))
    const [recipientAccount] = await recipientWallet.getAccounts();


    transfer(await getAccount(username),recipientAccount!.address,tokens*1000000)
    // const wallet = await getOrCreateAccount(context,context.message?.from?.username)

    // const [firstAccount] = await wallet.getAccounts();
}

export async function transfer(wallet: DirectSecp256k1HdWallet, recipientAddress: string, tokens: number){
    // const recipientAddress = "sent1rqvc6sxfhw7q95vk7uceqtlzcst9vgv9uyu5at";
    
    const [account] = await wallet.getAccounts();
    const rpcEndpoint = "https://rpc.sentinel.co";
    const client = await SigningStargateClient.connectWithSigner(rpcEndpoint,wallet);

    const amount = {
      denom: "udvpn",
      amount: String(tokens),
    };
    const fee = {
        amount: [
          {
            denom: "udvpn",
            amount: "20000",
          },
        ],
        gas: "180000",
      };
    const result = await client.sendTokens(account!.address, recipientAddress, [amount], fee, "Transfered from DVPN Tip bot");
    console.log(result)
    assertIsBroadcastTxSuccess(result);
}


