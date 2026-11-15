# 瀏覽器測試（Playwright）
# python3 tests/e2e.py          → 快速：390 深淺色＋1280
# python3 tests/e2e.py --wide   → 另加 320／768
# python3 tests/e2e.py --full   → 四種寬度都測深淺色，所有診斷、預防、藥物、抗藥選項全部點過
import sys, os, re
from playwright.sync_api import sync_playwright
FULL = "--full" in sys.argv
WIDE = "--wide" in sys.argv or FULL
SHOTS = next((a.split("=",1)[1] for a in sys.argv if a.startswith("--shots=")), None)
HTML = "file://" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "index.html"))
WIDTHS = [320, 390, 768, 1280] if WIDE else [390, 1280]
errs, issues, net = [], [], []
BAD = re.compile(r"undefined|NaN|\[object|Infinity|\{(?:KG|AC|BX)")

def check(pg, W, where):
    sw = pg.evaluate("document.documentElement.scrollWidth")
    if sw > W: issues.append(f"{W} {where}: 橫向溢出 {sw}")
    t = pg.inner_text("body")
    m = BAD.search(t)
    if m: issues.append(f"{W} {where}: 文字含 {m.group(0)}")

def tab(pg, k):
    if k == "ref": pg.locator("#foot [data-act=tab][data-v=ref]").click(); return
    pg.locator(f"#tabs [data-v={k}]").click()

def click_chips(pg, act, W, where):
    n = pg.locator(f"#main [data-act={act}]").count()
    for i in range(n):
        loc = pg.locator(f"#main [data-act={act}]").nth(i)
        if loc.is_visible(): loc.click(); check(pg, W, f"{where} {act}#{i}")

with sync_playwright() as p:
    b = p.chromium.launch()
    for W in WIDTHS:
        for scheme in (["light", "dark"] if (W == 390 or FULL) else ["light"]):
            pg = b.new_page(viewport={"width": W, "height": 800}, color_scheme=scheme)
            pg.on("pageerror", lambda e, W=W: errs.append(f"{W}:{e}"))
            pg.on("console", lambda m, W=W: errs.append(f"{W}:{m.text}") if m.type == "error" else None)
            pg.on("request", lambda r: net.append(r.url) if not r.url.startswith(("file:", "data:")) else None)
            pg.goto(HTML); pg.wait_for_timeout(150)
            check(pg, W, "load")
            if pg.locator("#tabs .tab").count() != 5: issues.append(f"{W}: 分頁不是 5 個")
            if pg.evaluate("document.getElementById('tabs').scrollWidth") > pg.locator("#tabs").bounding_box()["width"] + 1: issues.append(f"{W}: 分頁需橫捲")
            # 病人卡
            if W <= 920: pg.locator("#ptBar").click()
            pg.fill("#age", "72"); pg.fill("#wt", "60"); pg.fill("#ht", "165"); pg.fill("#scr", "1.6")
            if "mL/min" not in pg.inner_text("#rsum"): issues.append(f"{W}: CrCl 未計算")
            if W <= 920: pg.locator("[data-act=pt-close]").click()
            # 治療：每個診斷，選項全部點過（快速模式只點每個診斷的第一列選項）
            tab(pg, "tx")
            dxs = pg.evaluate("DX.map(x=>x.id)")
            for d in dxs:
                pg.evaluate(f"UI.dxpick=true;renderMain()")
                pg.locator(f"#main [data-act=dx][data-v={d}]").click(); check(pg, W, f"tx {d}")
                if FULL: click_chips(pg, "dxo", W, f"tx {d}")
            # 出處、更新、縮寫彈出層
            pg.evaluate("S.dx='flu';S.o={};renderMain()")
            pg.locator("#main button.src:visible").first.click()
            if pg.locator("#ov").is_hidden() or not pg.inner_text("#ovB").strip(): issues.append(f"{W}: 出處彈出層無內容")
            pg.locator("#ov [data-act=ov-close]").click()
            if pg.locator("#main button.upd:visible").count():
                pg.locator("#main button.upd:visible").first.click()
                if not pg.inner_text("#ovB").strip(): issues.append(f"{W}: 更新彈出層無內容")
                pg.locator("#ov [data-act=ov-close]").click()
            if pg.locator("#main button.gl:visible").count():
                pg.locator("#main button.gl:visible").first.click()
                if not pg.inner_text("#ovB").strip(): issues.append(f"{W}: 縮寫彈出層無內容")
                pg.locator("#ov [data-act=ov-close]").click()
            # 方案卡：說明、出處、藥名展開
            for act in ["onote", "srcs-tog", "brand"]:
                if pg.locator(f"#main [data-act={act}]:visible").count():
                    pg.locator(f"#main [data-act={act}]:visible").first.click(); check(pg, W, f"tx {act}")
            # 跳到抗藥再返回
            pg.locator("#main [data-act=res-go]").click()
            if pg.evaluate("S.tab") != "res" or pg.evaluate("S.res") != "flu": issues.append(f"{W}: 抗藥連結沒有展開流感")
            pg.locator("#main [data-act=nav-back]").click(); pg.wait_for_timeout(100)
            if pg.evaluate("S.tab") != "tx": issues.append(f"{W}: 返回沒有回到治療")
            # 懷孕
            if W <= 920: pg.locator("#ptBar").click()
            pg.check("#preg")
            if W <= 920: pg.locator("[data-act=pt-close]").click()
            pg.evaluate("S.dx='covid';S.o={};renderMain()")
            if "孕：不建議" not in pg.inner_text("#main"): issues.append(f"{W}: 懷孕未標示禁忌藥")
            check(pg, W, "preg covid")
            # 預防
            tab(pg, "px")
            for x in pg.evaluate("PX.map(x=>x.id)"):
                pg.evaluate("UI.pxpick=true;renderMain()")
                pg.locator(f"#main [data-act=px][data-v={x}]").click(); check(pg, W, f"px {x}")
                if FULL: click_chips(pg, "pxo", W, f"px {x}")
            # 藥物
            tab(pg, "drug")
            ks = pg.evaluate("Object.keys(D)")
            for k in (ks if FULL or W == 390 else ks[:4]):
                pg.evaluate("UI.dpick=true;renderMain()")
                pg.locator(f"#main [data-act=drug][data-v={k}]").click()
                pg.evaluate("document.querySelectorAll('#main details').forEach(d=>d.open=true)")
                check(pg, W, f"drug {k}")
            # 抗病毒譜：點每個符號、開彈出層、點藥名到藥物頁再返回
            tab(pg, "spec"); check(pg, W, "spec")
            n = pg.locator("#main button.mxc").count()
            if n < 60: issues.append(f"{W}: 譜符號只有 {n}")
            for i in range(0, n, 7):
                pg.locator("#main button.mxc").nth(i).click()
                if pg.locator("#ov").is_hidden() or not pg.inner_text("#ovB").strip(): issues.append(f"{W}: 譜彈出層無內容 #{i}")
                check(pg, W, f"spec cell#{i}")
                pg.locator("#ov [data-act=ov-close]").click()
            pg.evaluate("document.querySelectorAll('#main details').forEach(d=>d.open=true)"); check(pg, W, "spec notes")
            pg.locator("#main [data-act=go-drug]").first.click()
            if pg.evaluate("S.tab") != "drug": issues.append(f"{W}: 譜點藥名未到藥物頁")
            pg.locator(".backbar").click()
            if pg.evaluate("S.tab") != "spec": issues.append(f"{W}: 譜返回失敗")
            for a in ("go-dx","go-px","res-go"):
                loc = pg.locator(f"#main [data-act={a}]").first
                loc.click(); check(pg, W, f"spec {a}"); pg.locator(".backbar").click()
            # 抗藥：每項展開
            tab(pg, "res")
            for r in pg.evaluate("RES.map(x=>x.id)"):
                pg.locator(f"#main [data-act=res-k][data-v={r}]").click(); check(pg, W, f"res {r}")
            # 出處頁
            tab(pg, "ref"); check(pg, W, "ref")
            # 搜尋
            pg.fill("#q", "paxlovid"); pg.locator("#qres .qitem").first.click()
            if pg.evaluate("S.tab+':'+S.drug") != "drug:pax": issues.append(f"{W}: 搜尋 paxlovid 失敗")
            # 清除全部
            if W <= 920: pg.locator("#ptBar").click()
            pg.locator("[data-act=clear-all]").click()
            if pg.evaluate("S.pt.age") is not None or pg.evaluate("S.preg"): issues.append(f"{W}: 清除全部未清空")
            if SHOTS and W in (390, 1280):
                os.makedirs(SHOTS, exist_ok=True)
                pg.evaluate("S.tab='tx';S.dx='flu';S.o={};renderMain();scrollTo(0,0)")
                pg.screenshot(path=f"{SHOTS}/{W}_{scheme}.png", full_page=False)
            pg.close()
    b.close()
print("E2E ISSUES", len(issues)); [print("  " + x) for x in issues[:40]]
print("ERRORS", len(errs)); [print("  " + x) for x in errs[:20]]
print("NET", len(net)); [print("  " + x) for x in net[:10]]
sys.exit(1 if issues or errs or net else 0)
