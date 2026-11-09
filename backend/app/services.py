"""External data adapters used by the SPIDER API."""
from __future__ import annotations
import asyncio, email.utils, time, xml.etree.ElementTree as ET
from datetime import timezone
from typing import Any
import httpx
BIQUOTE_BASE = "https://biquote.io/api"
RSS_FEEDS = [("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"), ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"), ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"), ("The Guardian", "https://www.theguardian.com/world/rss"), ("DW", "https://rss.dw.com/xml/rss-en-all")]
NEWS_CACHE_SECONDS = 90
_news_cache: dict[str, Any] = {"at": 0.0, "items": []}

def _quote_is_valid(item: dict[str, Any]) -> bool:
    try:
        mid = item.get("mid")
        if mid is not None and float(mid) > 0: return True
        bid, ask = float(item.get("bid", 0)), float(item.get("ask", 0))
        return bid > 0 and ask > 0
    except (TypeError, ValueError): return False

async def _fetch_one_quote(client: httpx.AsyncClient, symbol: str) -> dict[str, Any] | None:
    response = await client.get(f"{BIQUOTE_BASE}/{symbol}")
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict):
        if isinstance(payload.get("data"), dict): payload = payload["data"]
        payload.setdefault("symbol", symbol)
        return payload if _quote_is_valid(payload) else None
    return None

async def get_market_quotes(symbols: list[str]) -> list[dict[str, Any]]:
    params = [("symbols", symbol) for symbol in symbols]
    by_symbol: dict[str, dict[str, Any]] = {}
    batch_error: httpx.HTTPError | None = None
    async with httpx.AsyncClient(timeout=12, headers={"Accept": "application/json"}) as client:
        try:
            response = await client.get(f"{BIQUOTE_BASE}/latest", params=params)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list): rows = payload
            elif isinstance(payload, dict) and isinstance(payload.get("items"), list): rows = payload["items"]
            elif isinstance(payload, dict) and isinstance(payload.get("ticks"), list): rows = payload["ticks"]
            elif isinstance(payload, dict): rows = [dict(value, symbol=key) for key, value in payload.items() if isinstance(value, dict)]
            else: rows = []
            wanted = set(symbols)
            for row in rows:
                if isinstance(row, dict):
                    symbol = str(row.get("symbol", "")).upper()
                    if symbol in wanted and _quote_is_valid(row): by_symbol[symbol] = row
        except httpx.HTTPError as exc:
            batch_error = exc
        missing = [symbol for symbol in symbols if symbol not in by_symbol]
        if missing:
            results = await asyncio.gather(*[_fetch_one_quote(client, symbol) for symbol in missing], return_exceptions=True)
            for symbol, result in zip(missing, results):
                if isinstance(result, dict): by_symbol[symbol] = result
    if not by_symbol and batch_error:
        raise batch_error
    return [{"symbol": symbol, **by_symbol[symbol]} if symbol in by_symbol else {"symbol": symbol, "available": False} for symbol in symbols]

def _child_text(node: ET.Element, *names: str) -> str:
    wanted = set(names)
    for child in list(node):
        if child.tag.rsplit("}", 1)[-1] in wanted:
            return (child.text or "").strip()
    return ""

def _parse_published(raw_date: str):
    if not raw_date:
        return None
    try:
        value = raw_date.strip()
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        try:
            from datetime import datetime
            published = datetime.fromisoformat(value)
        except ValueError:
            published = email.utils.parsedate_to_datetime(raw_date)
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        return published.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None

def _parse_feed(source: str, xml_text: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    rows = []
    # Accept both RSS <item> and Atom <entry>; Atom elements are namespace-qualified.
    entries = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1] in {"item", "entry"}]
    for item in entries:
        title = _child_text(item, "title")
        link = _child_text(item, "link")
        if not link:
            for node in list(item):
                if node.tag.rsplit("}", 1)[-1] == "link":
                    rel = node.attrib.get("rel", "alternate")
                    if rel == "alternate" and node.attrib.get("href"):
                        link = node.attrib["href"]
                        break
        raw_date = _child_text(item, "pubDate", "published", "updated", "date")
        published = _parse_published(raw_date)
        summary = _child_text(item, "description", "summary", "content")
        if not title or not link.startswith(("https://", "http://")) or published is None:
            continue
        rows.append({
            "source": source,
            "title": title,
            "url": link,
            "published_at": published.isoformat(),
            "summary": summary[:700],
        })
    return rows

async def _fetch_feed(client: httpx.AsyncClient, source: str, url: str) -> list[dict[str, Any]]:
    response = await client.get(url); response.raise_for_status()
    return _parse_feed(source, response.text)

async def get_latest_news(limit: int = 5) -> list[dict[str, Any]]:
    now = time.monotonic()
    if now - float(_news_cache["at"]) < NEWS_CACHE_SECONDS: return list(_news_cache["items"][:limit])
    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"User-Agent": "SPIDER-NewsDesk/0.1"}) as client:
        results = await asyncio.gather(*[_fetch_feed(client, name, url) for name, url in RSS_FEEDS], return_exceptions=True)
    stories = [story for result in results if isinstance(result, list) for story in result]
    unique = {story["url"]: story for story in stories}
    ordered = sorted(unique.values(), key=lambda x: x["published_at"], reverse=True)
    if ordered: _news_cache.update({"at": now, "items": ordered})
    elif _news_cache["items"]: return list(_news_cache["items"][:limit])
    return ordered[:limit]
