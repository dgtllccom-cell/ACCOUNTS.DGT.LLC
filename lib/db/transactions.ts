export type TransactionRunner<TClient> = {
  transaction<TResult>(callback: (client: TClient) => Promise<TResult>): Promise<TResult>;
};

export async function runInTransaction<TClient, TResult>(
  runner: TransactionRunner<TClient>,
  callback: (client: TClient) => Promise<TResult>
) {
  return runner.transaction(callback);
}

