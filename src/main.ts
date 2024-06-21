import dotenv from 'dotenv'
import {
    Address,
    Hash,
    createPublicClient,
    decodeAbiParameters,
    parseEther,
    parseGwei,
    webSocket,
} from 'viem'
import { bsc } from 'viem/chains'
import { ethers } from 'ethers'
import { erc20abi } from './fun'
dotenv.config()

const transport = webSocket(process.env.WSS)
const publicClient = createPublicClient({ chain: bsc, transport })
const Gwei3 = parseGwei('3')
const BNB001 = parseEther('0.01')

const CFG = {
    token: '0xfcfe6e7657d5385c9f8efa7abd8114669a887748'.toLowerCase(),
}

console.log({ wss: process.env.WSS })

publicClient.watchPendingTransactions({
    batch: false,
    onError: (error) => console.log(error),
    onTransactions: async (hashes) => {
        const hash = hashes[0]
        const tx = await publicClient.getTransaction({ hash }).catch(() => null)
        if (tx === null) return
        if (tx.from?.toLowerCase() === process.env.Address?.toLowerCase())
            return

        if (tx.to?.toLowerCase() === CFG.token) {
            console.log('捕捉到转账')
            if (isTransfer(tx.input)) {
                const input = decodeAbiParameters(
                    [
                        { name: 'recipient', type: 'address' },
                        { name: 'amount', type: 'uint256' },
                    ],
                    `0x${tx.input.slice(10)}`
                )
                const gasPrice = tx.gasPrice || 0n
                console.log({ gasPrice })

                const price = gasPrice > Gwei3 ? gasPrice * 2n : gasPrice * 3n
                transfer(input[0], price)
            }
        }
    },
})

function isTransfer(data: string): boolean {
    return data.slice(0, 10) === `0xa9059cbb`
}

async function transfer(to: string, gasPrice: bigint) {
    const wallet = new ethers.Wallet(process.env.Privatekey as string)

    const iface = new ethers.Interface(erc20abi)
    const data = iface.encodeFunctionData('transfer', [to, BNB001])
    const from = process.env.Address
    const nonce = await publicClient.getTransactionCount({
        address: from as Address,
    })

    let signedTx = await wallet.signTransaction({
        from,
        to: CFG.token,
        chainId: 56,
        nonce,
        gasPrice,
        gasLimit: 500000n,
        value: 0,
        data,
    })

    const hash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTx as Hash,
    })
    console.log(`send hash: ${hash}`)
}
