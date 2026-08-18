/**
 * Domain-level failures. These carry a stable machine-readable code so the API layer
 * can map them to HTTP without business rules leaking into controllers.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
  }
}

export class AccountDisabledError extends DomainError {
  constructor() {
    super('ACCOUNT_DISABLED', 'This account has been disabled', 403);
  }
}

export class NotAuthenticatedError extends DomainError {
  constructor() {
    super('NOT_AUTHENTICATED', 'Sign in to continue', 401);
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(permission: string) {
    super('PERMISSION_DENIED', `You do not have permission to ${permission}`, 403);
  }
}
