import time
from collections import defaultdict

from slowapi import Limiter
from slowapi.util import get_remote_address

# Standard slowapi limiter based on client IP
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


# Custom in-memory rate limiter / account lock helper for sensitive endpoints
class BruteForceProtector:
    def __init__(self, max_attempts: int = 5, lockout_seconds: int = 900):
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self.attempts: dict[str, list[float]] = defaultdict(list)
        self.locks: dict[str, float] = {}

    def is_locked(self, key: str) -> bool:
        now = time.time()
        lock_until = self.locks.get(key)
        if lock_until:
            if now < lock_until:
                return True
            else:
                del self.locks[key]
                self.attempts[key] = []
        return False

    def record_failure(self, key: str):
        now = time.time()
        self.attempts[key] = [t for t in self.attempts[key] if now - t < self.lockout_seconds]
        self.attempts[key].append(now)
        if len(self.attempts[key]) >= self.max_attempts:
            self.locks[key] = now + self.lockout_seconds

    def reset(self, key: str):
        self.attempts.pop(key, None)
        self.locks.pop(key, None)


login_protector = BruteForceProtector(max_attempts=5, lockout_seconds=600)  # 10 min lock
