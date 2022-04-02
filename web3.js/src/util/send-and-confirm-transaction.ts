import {Connection} from '../connection';
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

  const status = await connection.getSignatureStatus(signature);

  const checkBlockHeight = async () => {
    const blockHeight = await connection.getBlockHeight(
      options && options.commitment,
    );

    if (blockHeight > transaction.lastValidBlockHeight!) {
      throw new Error('Transaction has expired.');
    } else {
      if (status) {
        return;
      }
      await sleep(500);
      await checkBlockHeight();
    }
  };

  await checkBlockHeight();
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
  return signature;
}
