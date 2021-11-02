import {MyContext} from './my-context'
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import {getDB,saveTX} from './db.js'

let udvpnToDvpn = (udvpn:string) => (Number(udvpn)/1000000).toFixed(6)

export async function register(username: string) {
    const { env, dbi } = getDB();
	const txn = env.beginTxn()

    console.log(`Create new account for ${username}`)
    const newWallet = await DirectSecp256k1HdWallet.generate(24,{prefix:'sent'})
    txn.putString(dbi,username,newWallet.mnemonic)

    saveTX(txn, dbi, env)

    return newWallet

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
    const mnemonic_recipient = txn.getString(dbi,recipientUsername.slice(1,))

    saveTX(txn, dbi, env)    
    if (mnemonic_recipient === null){
        context.replyWithMarkdown(`Recipient has not registered with DVPN Tip Bot`)
        return
    }

    const recipientWallet = await getAccount(recipientUsername.slice(1,))
    const [recipientAccount] = await recipientWallet.getAccounts();


    transfer(await getAccount(username),recipientAccount!.address,tokens*1000000,context)
}

export async function withdraw(context:MyContext) {
    const username = context.message?.from.username!
    var text = (context.message as any).text.split(' ')
	if (text.length != 2) {
		context.replyWithMarkdown(`Withdraw requires exactly two arguments. Refer /help`)
        return
	}
    const transferAddress = text[1]
    if (transferAddress.slice(0,4)!=='sent' || transferAddress.length != 43){
        context.replyWithMarkdown(`Not a valid address to transfer`)
        return
    }

    const wallet = await getAccount(username)
    getBalance(wallet).then((balance)=>{
        console.log(`Balance: ${balance}`)
        const tokens = Number(balance)*1000000
        const feeAmount = 20000
        if (tokens < feeAmount){
            context.replyWithMarkdown(`Insufficient funds to withdraw`)
            return
        }
        transfer(wallet,transferAddress,tokens-feeAmount,context)
    })
}

export async function transfer(wallet: DirectSecp256k1HdWallet, recipientAddress: string, tokens: number, context: MyContext){
    const [account] = await wallet.getAccounts();

    console.log(`attempt to transfer ${tokens} from ${account?.address} to ${recipientAddress}`)

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
    if ((result as any).code){
        context.reply(result.rawLog!)
    }
}


