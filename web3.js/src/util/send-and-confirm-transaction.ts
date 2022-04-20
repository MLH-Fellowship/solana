import {
  Connection,
  Context,
  RpcResponseAndContext,
  SignatureResult,
} from '../connection';
import {Transaction} from '../transaction';
import type {ConfirmOptions} from '../connection';
import type {Signer} from '../keypair';
import type {TransactionSignature} from '../transaction';
import {sleep} from './sleep';

/**
 * Sign, send and confirm a transaction.
 *
 * If `commitment` option is not specified, defaults to 'max' commitment.
 *
 * @param {Connection} connection
 * @param {Transaction} transaction
 * @param {Array<Signer>} signers
 * @param {ConfirmOptions} [options]
 * @returns {Promise<TransactionSignature>}
 */
export async function sendAndConfirmTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Array<Signer>,
  options?: ConfirmOptions,
): Promise<TransactionSignature> {
  const sendOptions = options && {
    skipPreflight: options.skipPreflight,
    preflightCommitment: options.preflightCommitment || options.commitment,
    maxRetries: options.maxRetries,
  };

  const signature = await connection.sendTransaction(
    transaction,
    signers,
    sendOptions,
  );

  const subscriptionCommitment =
    options?.preflightCommitment || options?.commitment;
  let subscriptionId: number | undefined;
  let status: RpcResponseAndContext<SignatureResult> | null = null;
  let message: string | null = null;

  const confirmTx = new Promise((resolve, reject) => {
    try {
      subscriptionId = connection.onSignature(
        signature,
        (result: SignatureResult, context: Context) => {
          subscriptionId = undefined;
          status = {
            context,
            value: result,
          };
          message = 'confirmed';
          resolve(message);
        },
        subscriptionCommitment,
      );
    } catch (err) {
      reject(err);
    }
  });

  const checkBlockHeight = async () => {
    const blockHeight = await connection.getBlockHeight(
      options && options.commitment,
    );

    return blockHeight;
  };

  const expireTx = new Promise((resolve, reject) => {
    (async () => {
      try {
        let currentBlockHeight = await checkBlockHeight();
        while (currentBlockHeight <= transaction.lastValidBlockHeight!) {
          if (transaction.lastValidBlockHeight! - currentBlockHeight > 200) {
            await sleep(2000);
          } else if (transaction.lastValidBlockHeight! - currentBlockHeight > 100) {
            await sleep(1000);
          } else {
            await sleep(500);
          }
          currentBlockHeight = await checkBlockHeight();
        }
        console.log('lastValidBlockHeight exceeded!');
        message = 'expired';
        resolve(message);
      } catch (error) {
        reject(error);
      }
    })();
  });

  try {
    const outcome = await Promise.race([confirmTx, expireTx]);
    switch (outcome) {
      case 'confirmed':
        console.log('Transaction has been confirmed');
        break;
      case 'expired':
        console.log('Transaction has expired');
        break;
    }
  } finally {
    if (subscriptionId) {
      connection.removeSignatureListener(subscriptionId);
    }
  }

  if (status === null) {
    throw new Error('Transaction has expired.');
  }

  return signature;
}
