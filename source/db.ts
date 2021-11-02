import {newEnv, Txn, Dbi} from 'typestub-node-lmdb'
import path from 'path';

export function getDB() {
    const __dirname = path.resolve()
    const env = newEnv().open({
        path: __dirname+"/persist",
        mapSize: 2*1024*1024*1024, // maximum database size
        maxDbs: 3
    });
    var dbi = env.openDbi({
        name: "keysDB",
        create: true // will create if database did not exist
    })
    return {env, dbi}
}

export function saveTX(txn: Txn, dbi: Dbi, env: {close(): void}) {
    txn.commit()
    dbi.close()
    env.close()
}