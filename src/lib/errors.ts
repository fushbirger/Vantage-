/** A rule the caller broke; API routes turn these into 4xx responses. */
export class CollabError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
