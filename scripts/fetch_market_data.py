#!/usr/bin/env python3
"""Fetch free public news/calendar data and publish JSON snapshots for SwingTraderKrushna."""
import json, os, re, urllib.request
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET\nfrom urllib.parse import urlencode
BASE="https://biquote.io/api"
FEEDS={
 "global":[("BBC World","https://feeds.bbci.co.uk/news/world/rss.xml"),("Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml"),("The Guardian","https://www.theguardian.com/world/rss"),("DW","https://rss.dw.com/xml/rss-en-all")],
 "usa":[("CBS News","https://www.cbsnews.com/latest/rss/main"),("Fox News","https://moxie.foxnews.com/google-publisher/latest.xml"),("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"),("NPR","https://feeds.npr.org/1001/rss.xml")],
 "forex":[("BBC Business","https://feeds.bbci.co.uk/news/business/rss.xml"),("WSJ World","https://feeds.a.dj.com/rss/RSSWorldNews.xml"),("Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml")],
 "financial":[("BBC Business","https://feeds.bbci.co.uk/news/business/rss.xml"),("Guardian World","https://www.theguardian.com/world/rss"),("NYT Business","https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"),("DW","https://rss.dw.com/xml/rss-en-all")]
}
FILTERS={
 "forex":re.compile(r"forex|foreign exchange|currency|currencies|dollar|euro|yen|sterling|pound|central bank|federal reserve|interest rate|treasury|inflation|gold|oil|bond yield|exchange rate|fx market",re.I),
 "financial":re.compile(r"market|stock|shares|wall street|nasdaq|dow|s&p|gold|silver|oil|crypto|bitcoin|forex|currency|inflation|economy|bank|bond|rate|finance|trading",re.I)
}
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"SwingTraderKrushna/1.0","Accept":"application/json, application/rss+xml, application/xml, */*"})
 with urllib.request.urlopen(req,timeout=20) as res:return res.read()
def get_json(url):return json.loads(get(url).decode("utf-8"))
def clean_html(s):return re.sub(r"\\s+"," ",re.sub(r"<[^>]*>"," ",str(s or ""))).strip()[:320]
def rss_items(source,url,category):
 root=ET.fromstring(get(url));out=[]
 for item in root.findall(".//item"):
  title=(item.findtext("title") or "").strip();link=(item.findtext("link") or "").strip();raw=(item.findtext("pubDate") or "").strip()
  if not title or not link.startswith(("http://","https://")):continue
  try:dt=parsedate_to_datetime(raw).astimezone(timezone.utc)
  except Exception:dt=datetime.now(timezone.utc)
  desc=clean_html(item.findtext("description"))
  if category in FILTERS and not FILTERS[category].search(title+" "+desc):continue
  out.append({"source":source,"title":title,"url":link,"published":dt.isoformat(),"description":desc})
 return out
def fetch_news_category(category):
 specs={
  "global":["/news/market?language=en&country=US&maxResults=20","/news/market?language=en&country=GB&maxResults=15","/news/market?language=en&country=IN&maxResults=15","/news/market?language=en&country=DE&maxResults=10","/news/market?language=en&country=JP&maxResults=10"],
  "usa":["/news/market?language=en&country=US&maxResults=40"],
  "forex":["/news/market?symbol=EURUSD&language=en&maxResults=20","/news/market?symbol=GBPUSD&language=en&maxResults=15","/news/market?symbol=USDJPY&language=en&maxResults=15"],
  "financial":["/news/market?symbol=XAUUSD&language=en&maxResults=20","/news/market?symbol=BTCUSD&language=en&maxResults=20","/news/market?language=en&country=US&maxResults=20"]
 }
 items=[];errors=[];provider="Biquote market news API"
 for path in specs[category]:
  try:
   rows=get_json(BASE+path)
   if isinstance(rows,list):
    for x in rows:
     title=x.get("title");url=x.get("url");published=x.get("publishedDate") or x.get("published") or datetime.now(timezone.utc).isoformat()
     if title and url and str(url).startswith(("http://","https://")):
      items.append({"source":x.get("publisher") or "Biquote","title":title,"url":url,"published":published,"description":clean_html(x.get("description"))})
  except Exception as e:errors.append(str(e)[:160])
 if not items:
  provider="Publisher RSS fallback"
  for source,url in FEEDS[category]:
   try:items.extend(rss_items(source,url,category))
   except Exception as e:errors.append(source+": "+str(e)[:120])
 unique={x["url"]:x for x in items}
 return {"items":sorted(unique.values(),key=lambda x:x["published"],reverse=True)[:60],"feedCount":len(specs[category])-len(errors) if provider.startswith("Biquote") else len(FEEDS[category])-len(errors),"feedTotal":len(specs[category]) if provider.startswith("Biquote") else len(FEEDS[category]),"provider":provider,"errors":errors}
def fetch_calendar():
 now=datetime.now(timezone.utc);end=now+timedelta(days=7)
 url=BASE+"/calendar?"+urlencode({"from":now.isoformat(),"to":end.isoformat(),"countries":"US,EU,GB,JP,CA,AU","limit":250})
 try:
  rows=get_json(url)
  if isinstance(rows,list):return {"provider":"Biquote economic calendar","events":rows,"error":None}
  raise ValueError("Biquote returned an unexpected calendar shape")
 except Exception as primary:
  try:
   obj=get_json("https://showmytrades.com/api/public/calendar/v1?currency=USD,EUR,GBP,JPY,CAD,AUD&impact=high,medium,low&days=7&format=json")
   rows=obj.get("events",[])
   if not isinstance(rows,list):raise ValueError("Fallback response has no events array")
   return {"provider":"ShowMyTrades public calendar fallback","events":rows,"error":"Biquote: "+str(primary)[:160]}
  except Exception as fallback:
   return {"provider":"Unavailable","events":[],"error":"Biquote: "+str(primary)[:120]+"; fallback: "+str(fallback)[:120]}
def main():
 now=datetime.now(timezone.utc).isoformat()
 news={k:fetch_news_category(k) for k in FEEDS}
 os.makedirs("data",exist_ok=True)
 with open("data/news.json","w",encoding="utf-8") as f:json.dump({"updatedAt":now,"provider":"Biquote API with publisher RSS fallback","categories":news},f,ensure_ascii=False,separators=(",",":"))
 calendar=fetch_calendar();calendar["updatedAt"]=now
 with open("data/calendar.json","w",encoding="utf-8") as f:json.dump(calendar,f,ensure_ascii=False,separators=(",",":"))
 print("News items:",sum(len(v["items"]) for v in news.values()),"Calendar events:",len(calendar["events"]),"Calendar status:",calendar["error"] or "ok")
if __name__=="__main__":main()
