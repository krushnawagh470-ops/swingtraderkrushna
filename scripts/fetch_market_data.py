#!/usr/bin/env python3
"""Build cached, public news and economic-calendar snapshots for SwingTraderKrushna."""
import json, os, re, time, urllib.request, urllib.error
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

FEEDS = {
 "global": [("BBC World","https://feeds.bbci.co.uk/news/world/rss.xml"),("Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml"),("The Guardian","https://www.theguardian.com/world/rss"),("DW","https://rss.dw.com/xml/rss-en-all")],
 "usa": [("CBS News","https://www.cbsnews.com/latest/rss/main"),("Fox News","https://moxie.foxnews.com/google-publisher/latest.xml"),("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"),("NPR","https://feeds.npr.org/1001/rss.xml")],
 "forex": [("BBC Business","https://feeds.bbci.co.uk/news/business/rss.xml"),("WSJ World","https://feeds.a.dj.com/rss/RSSWorldNews.xml"),("Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml")],
 "financial": [("BBC Business","https://feeds.bbci.co.uk/news/business/rss.xml"),("Guardian World","https://www.theguardian.com/world/rss"),("New York Times Business","https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"),("DW","https://rss.dw.com/xml/rss-en-all")]
}
FILTERS = {
 "forex": re.compile(r"forex|foreign exchange|currency|currencies|dollar|euro|yen|sterling|pound|central bank|federal reserve|interest rate|treasury|inflation|gold|oil|bond yield|exchange rate|fx market", re.I),
 "financial": re.compile(r"market|stock|shares|wall street|nasdaq|dow|s&p|gold|silver|oil|crypto|bitcoin|forex|currency|inflation|economy|bank|bond|rate|finance|trading", re.I)
}
def get(url):
 req=urllib.request.Request(url, headers={"User-Agent":"SwingTraderKrushna/1.0 (public RSS aggregator)","Accept":"application/rss+xml, application/xml, application/json, */*"})
 with urllib.request.urlopen(req, timeout=18) as r: return r.read()
def txt(node, name):
 x=node.find(name)
 return (x.text or "").strip() if x is not None else ""
def main():
 now=datetime.now(timezone.utc).isoformat()
 news={}
 for category, feeds in FEEDS.items():
  items=[]; errors=[]
  for source,url in feeds:
   try:
    root=ET.fromstring(get(url))
    for item in root.findall(".//item"):
     title=txt(item,"title"); link=txt(item,"link"); raw=txt(item,"pubDate")
     if not title or not link.startswith(("http://","https://")): continue
     try: dt=parsedate_to_datetime(raw).astimezone(timezone.utc)
     except Exception: dt=datetime.now(timezone.utc)
     desc=re.sub(r"<[^>]+>"," ",txt(item,"description"))
     desc=re.sub(r"\s+"," ",desc).strip()[:300]
     if category in FILTERS and not FILTERS[category].search(title+" "+desc): continue
     items.append({"source":source,"title":title,"url":link,"published":dt.isoformat(),"description":desc})
   except Exception as e: errors.append(source+": "+str(e)[:140])
  unique={x["url"]:x for x in items}
  news[category]={"items":sorted(unique.values(),key=lambda x:x["published"],reverse=True)[:60],"feedCount":len(feeds)-len(errors),"feedTotal":len(feeds),"errors":errors}
 os.makedirs("data",exist_ok=True)
 with open("data/news.json","w",encoding="utf-8") as f: json.dump({"updatedAt":now,"provider":"Publisher RSS feeds","categories":news},f,ensure_ascii=False,separators=(",",":"))
 calendar={"updatedAt":now,"provider":"ShowMyTrades public economic calendar","events":[],"error":None}
 try:
  raw=get("https://showmytrades.com/api/public/calendar/v1?currency=USD,EUR,GBP,JPY,CAD,AUD&impact=high,medium,low&days=7&format=json")
  obj=json.loads(raw.decode("utf-8"))
  calendar["events"]=obj.get("events",[])
  if not isinstance(calendar["events"],list): raise ValueError("Unexpected events field")
 except Exception as e: calendar["error"]=str(e)[:240]
 with open("data/calendar.json","w",encoding="utf-8") as f: json.dump(calendar,f,ensure_ascii=False,separators=(",",":"))
 print("News items:",sum(len(v["items"]) for v in news.values()),"Calendar events:",len(calendar["events"]),"Calendar error:",calendar["error"])
if __name__=="__main__": main()
