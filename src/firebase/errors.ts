export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `Firestore-Berechtigung verweigert: ${context.operation} auf ${context.path}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;

    // This is for environments that support it (e.g., V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FirestorePermissionError);
    }
  }
}
