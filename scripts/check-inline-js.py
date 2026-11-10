#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import tempfile

class InlineScriptParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.current = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "script":
            return
        attrs = dict(attrs)
        script_type = (attrs.get("type") or "").split(";")[0].strip().lower()
        self.current = {"src": attrs.get("src"), "type": script_type, "parts": []}

    def handle_data(self, data):
        if self.current is not None and not self.current["src"]:
            self.current["parts"].append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self.current is not None:
            if not self.current["src"]:
                self.scripts.append(self.current)
            self.current = None

def main():
    html_path = Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
    parser = InlineScriptParser()
    parser.feed(html_path.read_text(encoding="utf-8"))
    checked = 0
    with tempfile.TemporaryDirectory(prefix="spider-js-check-") as temp:
        for index, script in enumerate(parser.scripts):
            kind = script["type"]
            if kind not in ("", "text/javascript", "application/javascript", "module"):
                continue
            extension = ".mjs" if kind == "module" else ".js"
            path = Path(temp) / f"inline-{index}{extension}"
            path.write_text("".join(script["parts"]), encoding="utf-8")
            result = subprocess.run(["node", "--check", str(path)], text=True, capture_output=True)
            if result.returncode:
                print(f"JavaScript syntax error in inline script #{index}:")
                print(result.stderr or result.stdout)
                return result.returncode
            checked += 1
    if checked == 0:
        print("No inline JavaScript blocks were found to check.")
        return 1
    print(f"JavaScript syntax check passed for {checked} inline script blocks.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
