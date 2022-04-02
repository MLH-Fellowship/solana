import {Connection} from '../connection';
import {Transaction} from '../transaction';
import type {ConfirmOptions} from '../connection';
import type {Signer} from '../keypair';
import type {
  TransactionSignature,
  TransactionSignatureBlockhash,
} from '../transaction';

class TransactionExpiredBlockheightExceededError extends Error {
  signature: string;

  constructor(signature: string) {
    super(`Signature ${signature} has expired.`);
    this.signature = signature;
  }
}

Object.defineProperty(
  TransactionExpiredBlockheightExceededError.prototype,
  'name',
  {
    value: 'TransactionExpiredBlockheightExceededError',
  },
);

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

  let status;

  const signature = await connection.sendTransaction(
    transaction,
    signers,
    sendOptions,
  );

  const signatureBlockhash: TransactionSignatureBlockhash = {
    signature: signature,
    blockhash: transaction.recentBlockhash,
    lastValidBlockHeight: transaction.lastValidBlockHeight,
  };

  status = (
    await connection.confirmTransaction(
      signatureBlockhash,
      options && options.commitment,
    )
  ).value;

  if (status.err) {
    throw new TransactionExpiredBlockheightExceededError(signature);
  }

  return signature;
}
