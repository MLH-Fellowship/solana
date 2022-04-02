import {Connection, Context, SignatureResult} from '../connection';
import {Transaction} from '../transaction';
import type {ConfirmOptions} from '../connection';
import type {Signer} from '../keypair';
import type {TransactionSignature} from '../transaction';

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

  const subscriptionCommitment =
    options?.preflightCommitment || options?.commitment;

  let subscriptionId: any;
  let response: any | null = null;

  const signature = await connection.sendTransaction(
    transaction,
    signers,
    sendOptions,
  );

  console.log(signature);

  const lastValidBlockHeight = (
    await connection.getLatestBlockhash(options && options.commitment)
  ).lastValidBlockHeight;
  console.log('lastValidBlockheight:', lastValidBlockHeight);

  subscriptionId = connection.onSignature(
    signature,
    (result: SignatureResult, context: Context) => {
      subscriptionId = undefined;
      response = {
        context,
        value: result,
      };
    },
    subscriptionCommitment,
  );

  const isExpired = async () => {
    const blockHeight = await connection.getBlockHeight(
      options && options.commitment,
    );
    console.log('blockHeight:', blockHeight);

    if (blockHeight > lastValidBlockHeight) {
      throw new Error('Transaction has expired.');
    } else {
      if (response?.context?.slot) return;
      console.log('subscriptionId:', subscriptionId);
      console.log('response:', response);
    }
    await isExpired();
  };

  await isExpired();
  // const status = (
  //   await connection.confirmTransaction(
  //     signature,
  //     options && options.commitment,
  //   )
  // ).value;

  // if (status.err) {
  //   throw new Error(
  //     `Transaction ${signature} failed (${JSON.stringify(status)})`,
  //   );
  // }
  console.log(signature);
  return signature;
}
