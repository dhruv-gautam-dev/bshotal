// Utilities for persisting and resolving redirect URLs across authentication flows
export const authReturnTo = {
  get: () => '/',
  set: (url) => {},
  clear: () => {},
};

export default authReturnTo;

