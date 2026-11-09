import asyncio

import pytest
from fastapi import HTTPException

from app import main


def test_owner_claims_require_exact_verified_email(monkeypatch):
    monkeypatch.setattr(main, "FIREBASE_PROJECT_ID", "spider-test")
    monkeypatch.setattr(main, "SPIDER_OWNER_EMAIL", "owner@example.com")
    claims = {
        "aud": "spider-test",
        "iss": "https://securetoken.google.com/spider-test",
        "email": "owner@example.com",
        "email_verified": True,
        "firebase": {"sign_in_provider": "google.com"},
        "sub": "firebase-user-123",
    }
    assert main._owner_claims_valid(claims)
    assert not main._owner_claims_valid({**claims, "email": "other@example.com"})
    assert not main._owner_claims_valid({**claims, "email_verified": False})
    assert not main._owner_claims_valid({**claims, "aud": "another-project"})
    assert not main._owner_claims_valid({**claims, "firebase": {"sign_in_provider": "anonymous"}})


def test_backend_ai_auth_fails_closed_when_not_configured(monkeypatch):
    monkeypatch.setattr(main, "FIREBASE_PROJECT_ID", "")
    monkeypatch.setattr(main, "SPIDER_OWNER_EMAIL", "")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(main.require_owner(None))
    assert exc.value.status_code == 503


def test_backend_ai_auth_rejects_missing_bearer(monkeypatch):
    monkeypatch.setattr(main, "FIREBASE_PROJECT_ID", "spider-test")
    monkeypatch.setattr(main, "SPIDER_OWNER_EMAIL", "owner@example.com")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(main.require_owner(None))
    assert exc.value.status_code == 401
