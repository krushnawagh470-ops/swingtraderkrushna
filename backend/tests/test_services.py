from app.services import _parse_feed, _quote_is_valid


def test_quote_validation_accepts_mid_or_bid_ask():
    assert _quote_is_valid({"mid": 2300.5})
    assert _quote_is_valid({"bid": 2300, "ask": 2301})
    assert not _quote_is_valid({"bid": 0, "ask": 0})


def test_rss_parser_extracts_story_and_utc_timestamp():
    xml = """<?xml version='1.0'?><rss><channel><item><title>Market update</title><link>https://example.com/story</link><pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate><description>Brief summary</description></item></channel></rss>"""
    stories = _parse_feed("Test Publisher", xml)
    assert len(stories) == 1
    assert stories[0]["title"] == "Market update"
    assert stories[0]["source"] == "Test Publisher"
    assert stories[0]["published_at"].endswith("+00:00")
