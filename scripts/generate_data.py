"""Generate demo data for GDET source tables via Databricks REST API."""
import json
import random
import uuid
import os
import subprocess
from datetime import datetime, timedelta

WH = "4b9b953939869799"
PROFILE = "e2-demo-west"

# Get auth token from CLI
def get_token():
    r = subprocess.run(["databricks", "auth", "token", "--profile", PROFILE], capture_output=True, text=True)
    for line in r.stdout.strip().split("\n"):
        if "access_token" in line:
            return line.split(":")[1].strip().strip('"').strip(',')
    # Try JSON parse
    try:
        d = json.loads(r.stdout)
        return d.get("access_token", "")
    except:
        return r.stdout.strip()

TOKEN = get_token()
HOST = "https://e2-demo-field-eng.cloud.databricks.com"

def run_sql(stmt):
    """Execute SQL via REST API using curl."""
    import urllib.request
    payload = json.dumps({"warehouse_id": WH, "statement": stmt, "wait_timeout": "50s"}).encode()
    req = urllib.request.Request(
        f"{HOST}/api/2.0/sql/statements",
        data=payload,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            d = json.loads(resp.read())
            state = d.get("status", {}).get("state", "UNKNOWN")
            err = d.get("status", {}).get("error", {}).get("message", "")
            if state != "SUCCEEDED":
                print(f"  FAILED: {err[:200]}")
            return state
    except Exception as e:
        print(f"  Error: {e}")
        return "ERROR"


COUNTRIES = ["US", "DE", "CN", "JP", "GB", "FR", "IN", "KR", "TW", "MX"]
CURRENCIES = {"US": "USD", "DE": "EUR", "CN": "CNY", "JP": "JPY", "GB": "GBP", "FR": "EUR", "IN": "INR", "KR": "KRW", "TW": "TWD", "MX": "MXN"}
WAREHOUSES = {"US": ["US-DAL", "US-CHI", "US-LAX"], "DE": ["DE-FRA", "DE-MUN"], "CN": ["CN-SHZ", "CN-SHA"], "JP": ["JP-TKY"], "GB": ["GB-LON"], "FR": ["FR-PAR"], "IN": ["IN-BLR"], "KR": ["KR-SEL"], "TW": ["TW-TPE"], "MX": ["MX-MTY"]}

VENDORS = [
    ("V001", "Texas Instruments"), ("V002", "STMicroelectronics"), ("V003", "Analog Devices"),
    ("V004", "NXP Semiconductors"), ("V005", "Microchip Technology"), ("V006", "Infineon Technologies"),
    ("V007", "ON Semiconductor"), ("V008", "Renesas Electronics"), ("V009", "Broadcom Inc"),
    ("V010", "Maxim Integrated"), ("V011", "Vishay Intertechnology"), ("V012", "TE Connectivity"),
    ("V013", "Murata Manufacturing"), ("V014", "TDK Corporation"), ("V015", "Amphenol Corporation"),
]

CATEGORIES = ["Semiconductors", "Passive Components", "Connectors", "Sensors", "Power Management",
              "Microcontrollers", "Memory", "Optoelectronics", "Electromechanical", "Test Equipment"]

PRODUCTS = []
for i in range(500):
    cat = random.choice(CATEGORIES)
    prefixes = {"Semiconductors": "IC", "Passive Components": "RES", "Connectors": "CON", "Sensors": "SNS",
                "Power Management": "PWR", "Microcontrollers": "MCU", "Memory": "MEM", "Optoelectronics": "OPT",
                "Electromechanical": "EMC", "Test Equipment": "TST"}
    prefix = prefixes.get(cat, "GEN")
    PRODUCTS.append((f"P{i+1:04d}", f"{prefix}-{random.randint(1000,9999)}-{random.choice('ABCDEF')}", cat))

CUSTOMERS = [(f"C{i+1:04d}", f"Customer Corp {i+1}") for i in range(200)]
STORES = [(f"S{i+1:03d}", random.choice(COUNTRIES)) for i in range(50)]

SUBSTANCES = [
    ("Lead", "7439-92-1"), ("Cadmium", "7440-43-9"), ("Mercury", "7439-97-6"),
    ("Hexavalent Chromium", "18540-29-9"), ("PBB", "59536-65-1"), ("PBDE", "32534-81-9"),
    ("DEHP", "117-81-7"), ("BBP", "85-68-7"), ("DBP", "84-74-2"), ("DIBP", "84-69-5"),
]


def gen_inventory(batch_size=200, total=5000):
    print(f"Generating {total} inventory rows...")
    for batch_start in range(0, total, batch_size):
        rows = []
        batch_end = min(batch_start + batch_size, total)
        for _ in range(batch_start, batch_end):
            pid, pname, cat = random.choice(PRODUCTS)
            country = random.choice(COUNTRIES)
            wh = random.choice(WAREHOUSES[country])
            vid, vname = random.choice(VENDORS)
            qty = random.randint(0, 10000)
            reserved = random.randint(0, min(qty, 500))
            reorder = random.randint(50, 500)
            cost = round(random.uniform(0.01, 500.00), 2)
            ts = (datetime.now() - timedelta(hours=random.randint(0, 720))).strftime("%Y-%m-%d %H:%M:%S")
            rows.append(f"('{pid}','{pname}','{cat}','{wh}','{country}',{qty},{reserved},{reorder},{cost},'{ts}','{vid}','{vname}')")
        values = ",".join(rows)
        state = run_sql(f"INSERT INTO parijat_demos.gdet.inventory_data VALUES {values}")
        print(f"  Batch {batch_start}-{batch_end}: {state}")


def gen_pos(batch_size=200, total=5000):
    print(f"Generating {total} POS rows...")
    for batch_start in range(0, total, batch_size):
        rows = []
        batch_end = min(batch_start + batch_size, total)
        for _ in range(batch_start, batch_end):
            tid = str(uuid.uuid4())[:12]
            tdate = (datetime.now() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d %H:%M:%S")
            sid, scountry = random.choice(STORES)
            cid, cname = random.choice(CUSTOMERS)
            pid, pname, _ = random.choice(PRODUCTS)
            vid, _ = random.choice(VENDORS)
            qty = random.randint(1, 100)
            price = round(random.uniform(0.50, 1000.00), 2)
            total_amt = round(qty * price, 2)
            currency = CURRENCIES[scountry]
            rows.append(f"('{tid}','{tdate}','{sid}','{scountry}','{cid}','{cname}','{pid}','{pname}',{qty},{price},{total_amt},'{currency}','{vid}')")
        values = ",".join(rows)
        state = run_sql(f"INSERT INTO parijat_demos.gdet.pos_data VALUES {values}")
        print(f"  Batch {batch_start}-{batch_end}: {state}")


def gen_price_feed(batch_size=200, total=3000):
    print(f"Generating {total} price feed rows...")
    for batch_start in range(0, total, batch_size):
        rows = []
        batch_end = min(batch_start + batch_size, total)
        for _ in range(batch_start, batch_end):
            prid = str(uuid.uuid4())[:12]
            pid, pname, _ = random.choice(PRODUCTS)
            vid, vname = random.choice(VENDORS)
            list_p = round(random.uniform(1.00, 2000.00), 2)
            net_p = round(list_p * random.uniform(0.5, 0.95), 2)
            country = random.choice(COUNTRIES)
            currency = CURRENCIES[country]
            eff = (datetime.now() - timedelta(days=random.randint(0, 180))).strftime("%Y-%m-%d")
            exp = (datetime.now() + timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d")
            ptype = random.choice(["standard", "contract", "promotional", "volume"])
            rows.append(f"('{prid}','{pid}','{pname}','{vid}','{vname}',{list_p},{net_p},'{currency}','{country}','{eff}','{exp}','{ptype}')")
        values = ",".join(rows)
        state = run_sql(f"INSERT INTO parijat_demos.gdet.price_feed_data VALUES {values}")
        print(f"  Batch {batch_start}-{batch_end}: {state}")


def gen_scip_reach(batch_size=200, total=2000):
    print(f"Generating {total} SCIP/REACH rows...")
    for batch_start in range(0, total, batch_size):
        rows = []
        batch_end = min(batch_start + batch_size, total)
        for _ in range(batch_start, batch_end):
            rid = str(uuid.uuid4())[:12]
            pid, pname, _ = random.choice(PRODUCTS)
            subst, cas = random.choice(SUBSTANCES)
            conc = round(random.uniform(0.01, 15.00), 2)
            scip_id = f"SCIP-{random.randint(100000, 999999)}" if random.random() > 0.3 else ""
            reach_no = f"01-{random.randint(1000000, 9999999)}-{random.randint(10, 99)}-{random.randint(1000, 9999)}" if random.random() > 0.2 else ""
            status = random.choice(["compliant", "non_compliant", "pending_review", "exempt"])
            country = random.choice(COUNTRIES)
            vid, _ = random.choice(VENDORS)
            verified = (datetime.now() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d %H:%M:%S")
            rows.append(f"('{rid}','{pid}','{pname}','{subst}','{cas}',{conc},'{scip_id}','{reach_no}','{status}','{country}','{vid}','{verified}')")
        values = ",".join(rows)
        state = run_sql(f"INSERT INTO parijat_demos.gdet.scip_reach_data VALUES {values}")
        print(f"  Batch {batch_start}-{batch_end}: {state}")


def gen_seed_definitions():
    print("Inserting seed extract definitions...")
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    defs = [
        {"id": "def-001", "name": "US Inventory Snapshot", "description": "Daily US warehouse inventory levels",
         "extract_type": "inventory", "source_table": "parijat_demos.gdet.inventory_data",
         "columns_config": json.dumps([{"name":"product_id","alias":"Product ID","order":1,"visible":True},{"name":"product_name","alias":"Product Name","order":2,"visible":True},{"name":"category","alias":"Category","order":3,"visible":True},{"name":"warehouse_code","alias":"Warehouse","order":4,"visible":True},{"name":"quantity_on_hand","alias":"Qty On Hand","order":5,"visible":True},{"name":"unit_cost","alias":"Unit Cost","order":6,"visible":True},{"name":"vendor_name","alias":"Vendor","order":7,"visible":True}]),
         "parameters": json.dumps({"warehouse_country":"US"}),
         "file_format":"csv","delimiter":",","encoding":"utf-8","decimal_format":".","file_naming_template":"inventory_us_{date}",
         "zip_enabled":"false","password_protected":"false","status":"active","country_code":"US",
         "tags":json.dumps(["inventory","daily"]),"sensitivity_level":"internal"},
        {"id": "def-002", "name": "EMEA POS Report", "description": "Weekly point of sale report for European stores",
         "extract_type": "pos", "source_table": "parijat_demos.gdet.pos_data",
         "columns_config": json.dumps([{"name":"transaction_id","alias":"Txn ID","order":1,"visible":True},{"name":"transaction_date","alias":"Date","order":2,"visible":True},{"name":"store_id","alias":"Store","order":3,"visible":True},{"name":"customer_name","alias":"Customer","order":4,"visible":True},{"name":"product_name","alias":"Product","order":5,"visible":True},{"name":"quantity","alias":"Qty","order":6,"visible":True},{"name":"total_amount","alias":"Amount","order":7,"visible":True},{"name":"currency","alias":"Currency","order":8,"visible":True}]),
         "parameters": json.dumps({"store_country":"DE"}),
         "file_format":"xlsx","delimiter":",","encoding":"utf-8","decimal_format":".","file_naming_template":"pos_emea_{date}",
         "zip_enabled":"false","password_protected":"false","status":"active","country_code":"DE",
         "tags":json.dumps(["pos","weekly","emea"]),"sensitivity_level":"internal"},
        {"id": "def-003", "name": "Global Price Feed", "description": "Monthly vendor price feed across all regions",
         "extract_type": "price_feed", "source_table": "parijat_demos.gdet.price_feed_data",
         "columns_config": json.dumps([{"name":"product_name","alias":"Product","order":1,"visible":True},{"name":"vendor_name","alias":"Vendor","order":2,"visible":True},{"name":"list_price","alias":"List Price","order":3,"visible":True},{"name":"net_price","alias":"Net Price","order":4,"visible":True},{"name":"currency","alias":"Currency","order":5,"visible":True},{"name":"country_code","alias":"Country","order":6,"visible":True},{"name":"effective_date","alias":"Effective","order":7,"visible":True},{"name":"expiry_date","alias":"Expiry","order":8,"visible":True}]),
         "parameters": json.dumps({}),
         "file_format":"csv","delimiter":",","encoding":"utf-8","decimal_format":".","file_naming_template":"price_feed_global_{date}",
         "zip_enabled":"true","password_protected":"false","status":"active","country_code":"",
         "tags":json.dumps(["price_feed","monthly","global"]),"sensitivity_level":"confidential"},
        {"id": "def-004", "name": "SCIP Compliance Extract", "description": "Quarterly SCIP/REACH compliance data for EU",
         "extract_type": "scip_reach", "source_table": "parijat_demos.gdet.scip_reach_data",
         "columns_config": json.dumps([{"name":"product_name","alias":"Product","order":1,"visible":True},{"name":"substance_name","alias":"Substance","order":2,"visible":True},{"name":"cas_number","alias":"CAS Number","order":3,"visible":True},{"name":"concentration_pct","alias":"Concentration %","order":4,"visible":True},{"name":"compliance_status","alias":"Status","order":5,"visible":True},{"name":"scip_notification_id","alias":"SCIP ID","order":6,"visible":True},{"name":"reach_registration_no","alias":"REACH No","order":7,"visible":True}]),
         "parameters": json.dumps({"country_code":"DE"}),
         "file_format":"csv","delimiter":",","encoding":"utf-8","decimal_format":",","file_naming_template":"scip_reach_eu_{date}",
         "zip_enabled":"false","password_protected":"false","status":"active","country_code":"DE",
         "tags":json.dumps(["compliance","quarterly","eu"]),"sensitivity_level":"restricted"},
        {"id": "def-005", "name": "Japan Inventory Report", "description": "Weekly inventory for Japan warehouses",
         "extract_type": "inventory", "source_table": "parijat_demos.gdet.inventory_data",
         "columns_config": json.dumps([{"name":"product_id","alias":"Product ID","order":1,"visible":True},{"name":"product_name","alias":"Product Name","order":2,"visible":True},{"name":"category","alias":"Category","order":3,"visible":True},{"name":"warehouse_code","alias":"Warehouse","order":4,"visible":True},{"name":"quantity_on_hand","alias":"Qty On Hand","order":5,"visible":True},{"name":"quantity_reserved","alias":"Reserved","order":6,"visible":True},{"name":"reorder_point","alias":"Reorder Point","order":7,"visible":True},{"name":"vendor_name","alias":"Vendor","order":8,"visible":True}]),
         "parameters": json.dumps({"warehouse_country":"JP"}),
         "file_format":"json","delimiter":",","encoding":"utf-8","decimal_format":".","file_naming_template":"inventory_jp_{date}",
         "zip_enabled":"false","password_protected":"false","status":"active","country_code":"JP",
         "tags":json.dumps(["inventory","weekly","apac"]),"sensitivity_level":"internal"},
    ]
    for d in defs:
        cols_esc = d["columns_config"].replace("'", "''")
        params_esc = d["parameters"].replace("'", "''")
        tags_esc = d["tags"].replace("'", "''")
        stmt = f"""INSERT INTO parijat_demos.gdet.extract_definitions VALUES ('{d["id"]}','{d["name"]}','{d["description"]}','{d["extract_type"]}','{d["source_table"]}',NULL,'{cols_esc}','{params_esc}','{d["file_format"]}','{d["delimiter"]}','{d["encoding"]}','{d["decimal_format"]}','{d["file_naming_template"]}',{d["zip_enabled"]},{d["password_protected"]},'demo_user','{ts}','{ts}','{d["status"]}','{d["country_code"]}','{tags_esc}','{d["sensitivity_level"]}')"""
        state = run_sql(stmt)
        print(f"  {d['id']} ({d['name']}): {state}")


if __name__ == "__main__":
    print(f"Using token: {TOKEN[:10]}...")
    gen_inventory(200, 5000)
    gen_pos(200, 5000)
    gen_price_feed(200, 3000)
    gen_scip_reach(200, 2000)
    gen_seed_definitions()
    print("\nDone!")
