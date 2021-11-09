import redisClient from './redisClient.js'
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";

const RPC_ENDPOINT = "https://rpc.sentinel.co";
let udvpnToDvpn = (udvpn:string) => (Number(udvpn)/1000000).toFixed(6)

export async function createAccount(username: string) {
    const wallet = await DirectSecp256k1HdWallet.generate();
    const mnemonic = wallet.mnemonic;
    redisClient.set(username, mnemonic);
    const address = (await getAccount(username))!.address;
    return {address, mnemonic};
}

export async function getAccount(username: string) {
    const mnemonic = await redisClient.get(username);
    if(mnemonic == null){
        return null;
    }
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic!, {prefix:"sent"});
    const [account] = await wallet.getAccounts();
    return account;
}

export async function getBalance(username: string) {
    const account = await getAccount(username);
    const stargateClient = await SigningStargateClient.connect(RPC_ENDPOINT);
    const balance =  await stargateClient.getBalance(account!.address,'udvpn');
    return udvpnToDvpn(balance.amount);
}

export async function transferTokens(senderUsername: string, recipientAddress: string, tokens: number){
    const mnemonic = await redisClient.get(senderUsername);
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic!, {prefix:"sent"});
    const account = await getAccount(senderUsername);
    const stargateClient = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, wallet);

    const amount = {
        denom: "udvpn",
        amount: String(tokens * 1000000),
    };
    const fee = {
        amount: [
            {
                denom: "udvpn",
                amount: "20000",
            },
        ],
        gas: "200000",
    };
    const result = await stargateClient.sendTokens(account!.address, recipientAddress, [amount], fee, "Transfered using @dvpntipbot");
    return result;
}


